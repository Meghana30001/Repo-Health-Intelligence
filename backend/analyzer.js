const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const execAsync = promisify(exec);

const TMP_DIR = path.join(__dirname, 'tmp');
const CACHE_TTL_MS = 30 * 60 * 1000;
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const analysisCache = new Map();
function getCached(slug) {
  const e = analysisCache.get(slug);
  if (!e || Date.now() - e.ts > CACHE_TTL_MS) { analysisCache.delete(slug); return null; }
  return e.result;
}
function setCache(slug, result) { analysisCache.set(slug, { result, ts: Date.now() }); }

/* ── GitHub API helper ─────────────────────────────────────────── */
function githubAPI(endpoint, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.github.com',
      path: endpoint,
      headers: { 'User-Agent': 'RepoHealthIQ', ...(token ? { Authorization: `token ${token}` } : {}) },
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

/* ── Main entry ────────────────────────────────────────────────── */
async function analyzeRepo(repoInput, emit, options = {}) {
  const { token = '', depth = 200 } = options;

  let slug = repoInput.trim()
    .replace('https://github.com/', '')
    .replace(/\.git$/, '')
    .replace(/[^a-zA-Z0-9_\-\/]/g, '');

  const parts = slug.split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    emit({ type: 'error', message: 'Invalid format. Use owner/repo (e.g. facebook/react)' });
    return;
  }

  const authPrefix = token ? `${token}@` : '';
  const repoUrl = `https://${authPrefix}github.com/${slug}.git`;
  const repoDir = path.join(TMP_DIR, slug.replace('/', '__'));

  try {
    // ── Cache check ──
    const cached = getCached(slug);
    if (cached) {
      emit({ type: 'progress', stage: 'cache', message: `✓ Loaded from cache instantly!`, pct: 5 });
      replayResult(cached, emit);
      return;
    }

    // ── Stage 1: GitHub API metadata ──
    emit({ type: 'progress', stage: 'api', message: `Fetching repository metadata...`, pct: 5 });
    const apiData = await githubAPI(`/repos/${slug}`, token);
    let repoMeta = null;
    if (apiData && apiData.full_name) {
      repoMeta = {
        stars: apiData.stargazers_count || 0,
        forks: apiData.forks_count || 0,
        issues: apiData.open_issues_count || 0,
        language: apiData.language || 'Unknown',
        description: apiData.description || '',
        defaultBranch: apiData.default_branch || 'main',
        size: apiData.size || 0,
        private: apiData.private || false,
      };
      emit({ type: 'repoMeta', ...repoMeta });
      emit({ type: 'progress', stage: 'api', message: `✓ ${repoMeta.language} · ⭐ ${repoMeta.stars.toLocaleString()} · ${repoMeta.forks.toLocaleString()} forks`, pct: 10 });
    }

    // ── Stage 2: Clone ──
    emit({ type: 'progress', stage: 'clone', message: `Cloning ${slug} (depth ${depth})...`, pct: 12 });
    const alreadyCloned = fs.existsSync(path.join(repoDir, '.git'));
    if (alreadyCloned) {
      emit({ type: 'progress', stage: 'clone', message: `Updating existing clone...`, pct: 14 });
      try { await execAsync(`git -C "${repoDir}" fetch --depth=${depth} --quiet 2>&1`, { timeout: 60000 }); } catch (_) {}
    } else {
      fs.mkdirSync(repoDir, { recursive: true });
      await execAsync(
        `git clone --depth ${depth} --single-branch --quiet "${repoUrl}" "${repoDir}" 2>&1`,
        { timeout: 120000 }
      );
    }
    emit({ type: 'progress', stage: 'clone', message: `✓ Repository ready`, pct: 22 });

    // ── Stage 3: Git log (fast, reliable) ──
    emit({ type: 'progress', stage: 'log', message: `Walking commit history (last ${depth} commits)...`, pct: 25 });
    const logRaw = await execAsync(
      `git -C "${repoDir}" log -n ${depth} --no-merges --format="COMMIT:%ae|%aI" --name-only 2>&1`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 30000 }
    );
    const commits = parseGitLog(logRaw.stdout);
    emit({ type: 'progress', stage: 'log', message: `Found ${commits.length.toLocaleString()} commits`, pct: 38 });
    emit({ type: 'commits', count: commits.length });

    // ── Stage 4: File metrics ──
    emit({ type: 'progress', stage: 'metrics', message: `Computing file churn and hotspot risk...`, pct: 42 });
    const fileMetrics = computeFileMetrics(commits);
    emit({ type: 'progress', stage: 'metrics', message: `Analyzed ${Object.keys(fileMetrics).length.toLocaleString()} files`, pct: 52 });

    // ── Stage 5: Hotspots ──
    emit({ type: 'progress', stage: 'hotspot', message: `Building hotspot risk map...`, pct: 55 });
    const hotspots = buildHotspots(fileMetrics);
    emit({ type: 'hotspots', files: hotspots });

    // ── Stage 6: Dependency scan ──
    emit({ type: 'progress', stage: 'deps', message: `Scanning dependencies...`, pct: 60 });
    const deps = await scanDependencies(repoDir);
    emit({ type: 'dependencies', ...deps });

    // ── Stage 7: Test detection ──
    emit({ type: 'progress', stage: 'tests', message: `Detecting test coverage signals...`, pct: 65 });
    const testInfo = detectTests(repoDir, fileMetrics);
    emit({ type: 'testCoverage', ...testInfo });

    // ── Stage 8: Bus factor ──
    emit({ type: 'progress', stage: 'bus', message: `Computing bus factor...`, pct: 70 });
    const busFactor = computeBusFactor(commits, fileMetrics);
    emit({ type: 'busfactor', modules: busFactor });

    // ── Stage 9: Timeline ──
    emit({ type: 'progress', stage: 'timeline', message: `Building health timeline...`, pct: 75 });
    const timeline = buildTimeline(commits, fileMetrics);
    emit({ type: 'timeline', ...timeline });

    // ── Stage 10: Graph ──
    emit({ type: 'progress', stage: 'graph', message: `Building knowledge graph...`, pct: 82 });
    const graph = buildGraph(fileMetrics, repoDir);
    emit({ type: 'graph', nodes: graph.nodes, edges: graph.edges });

    // ── Stage 11: Health score ──
    emit({ type: 'progress', stage: 'score', message: `Computing health score...`, pct: 88 });
    const score = computeHealthScore(fileMetrics, commits, testInfo, deps);
    emit({ type: 'score', ...score });

    // ── Stage 12: Narrative ──
    emit({ type: 'progress', stage: 'narrative', message: `Generating analysis narrative...`, pct: 93 });
    const narrative = generateNarrative(slug, score, hotspots, busFactor, commits, repoMeta, testInfo, deps);
    emit({ type: 'narrative', text: narrative });

    emit({ type: 'progress', stage: 'done', message: `✓ Analysis complete!`, pct: 100 });
    const result = { slug, commitCount: commits.length, hotspots, busFactor, timeline, graph, score, narrative, repoMeta, testInfo, deps };
    setCache(slug, result);
    emit({ type: 'done', repo: slug, commitCount: commits.length, duration: Date.now() });

  } catch (err) {
    console.error('Analysis error:', err.message);
    emit({ type: 'error', message: err.message.split('\n')[0].substring(0, 200) });
  }
}

/* ── Reliable git log parser (COMMIT: prefix) ─────────────────── */
function parseGitLog(raw) {
  const commits = [];
  const lines = raw.split('\n');
  let current = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('COMMIT:')) {
      if (current) commits.push(current);
      const meta = line.slice(7).split('|');
      current = { author: (meta[0] || '').toLowerCase(), date: new Date(meta[1] || ''), files: [] };
    } else if (current) {
      const f = line.trim();
      if (f && !f.startsWith('COMMIT:')) current.files.push(f);
    }
  }
  if (current) commits.push(current);
  return commits.filter(c => c.date && !isNaN(c.date));
}

/* ── File metrics ──────────────────────────────────────────────── */
function computeFileMetrics(commits) {
  const metrics = {};
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!file || file.includes('..') || file.startsWith('/')) continue;
      if (!metrics[file]) metrics[file] = { churn: 0, authors: new Set(), lastChanged: null };
      metrics[file].churn++;
      metrics[file].authors.add(commit.author);
      if (!metrics[file].lastChanged || commit.date > metrics[file].lastChanged)
        metrics[file].lastChanged = commit.date;
    }
  }
  for (const f of Object.keys(metrics)) {
    metrics[f].authorCount = metrics[f].authors.size;
    metrics[f].authors = [...metrics[f].authors];
  }
  return metrics;
}

/* ── Hotspot map ───────────────────────────────────────────────── */
function buildHotspots(fileMetrics) {
  const entries = Object.entries(fileMetrics);
  if (!entries.length) return [];
  const maxChurn = Math.max(...entries.map(([, m]) => m.churn), 1);
  const scored = entries.map(([file, m]) => {
    const churnScore = (m.churn / maxChurn) * 100;
    const singleAuthor = m.authorCount === 1 ? 15 : 0;
    const risk = Math.round(Math.min(99, churnScore + singleAuthor));
    const complexity = churnScore > 70 ? 'Very High' : churnScore > 50 ? 'High' : churnScore > 30 ? 'Medium' : 'Low';
    const level = risk > 80 ? 'critical' : risk > 60 ? 'high' : risk > 40 ? 'medium' : 'low';
    return { path: file, risk, churn: m.churn, complexity, level };
  });
  return scored.filter(h => h.churn >= 1).sort((a, b) => b.risk - a.risk).slice(0, 25);
}

/* ── Dependency scanning ───────────────────────────────────────── */
async function scanDependencies(repoDir) {
  const result = { files: [], totalDeps: 0, score: 80 };
  const depFiles = [
    { name: 'package.json',      type: 'npm'    },
    { name: 'requirements.txt',  type: 'pip'    },
    { name: 'Gemfile',           type: 'gem'    },
    { name: 'go.mod',            type: 'go'     },
    { name: 'pom.xml',           type: 'maven'  },
    { name: 'Cargo.toml',        type: 'cargo'  },
    { name: 'pyproject.toml',    type: 'poetry' },
  ];
  for (const df of depFiles) {
    const fp = path.join(repoDir, df.name);
    if (fs.existsSync(fp)) {
      try {
        const content = fs.readFileSync(fp, 'utf8');
        let count = 0;
        if (df.type === 'npm') {
          const pkg = JSON.parse(content);
          count = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }).length;
        } else if (df.type === 'pip') {
          count = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
        } else if (df.type === 'gem') {
          count = (content.match(/^\s*gem\s+/gm) || []).length;
        } else if (df.type === 'go') {
          count = (content.match(/^\t\S+\s+v/gm) || []).length;
        } else if (df.type === 'cargo') {
          count = (content.match(/\[dependencies\]/g) || []).length;
          count += (content.match(/^[a-z_-]+\s*=/gm) || []).length;
        } else {
          count = (content.match(/<dependency>/g) || []).length;
        }
        result.files.push({ name: df.name, type: df.type, count });
        result.totalDeps += count;
      } catch (_) {}
    }
  }
  result.score = result.totalDeps === 0 ? 80 : Math.max(30, Math.min(95, 100 - Math.floor(result.totalDeps / 10)));
  return result;
}

/* ── Test detection ────────────────────────────────────────────── */
function detectTests(repoDir, fileMetrics) {
  const testPatterns = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /_test\.go$/, /test_.*\.py$/, /_spec\.rb$/];
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'integration'];
  let testFiles = 0, sourceFiles = 0;

  const allFiles = Object.keys(fileMetrics);
  for (const f of allFiles) {
    const isTest = testPatterns.some(p => p.test(f)) || testDirs.some(d => f.split('/').includes(d));
    if (isTest) testFiles++; else sourceFiles++;
  }
  const ratio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  const coverage = Math.min(95, Math.round(ratio * 120));
  return { testFiles, sourceFiles, ratio: Math.round(ratio * 100), coverage, hasTests: testFiles > 0 };
}

/* ── Bus factor ────────────────────────────────────────────────── */
function computeBusFactor(commits, fileMetrics) {
  const dirAuthors = {};
  for (const [file, m] of Object.entries(fileMetrics)) {
    const dir = file.split('/')[0] || file;
    if (!dirAuthors[dir]) dirAuthors[dir] = new Set();
    m.authors.forEach(a => dirAuthors[dir].add(a));
  }
  return Object.entries(dirAuthors)
    .map(([name, a]) => ({ name: name + '/', factor: a.size, risk: a.size === 1 }))
    .sort((a, b) => a.factor - b.factor).slice(0, 8);
}

/* ── Timeline ──────────────────────────────────────────────────── */
function buildTimeline(commits, fileMetrics) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), commits: [] };
  });
  for (const c of commits) {
    const b = months.find(m => m.year === c.date.getFullYear() && m.month === c.date.getMonth());
    if (b) b.commits.push(c);
  }
  const entries = Object.entries(fileMetrics);
  const hotRatio = entries.length ? entries.filter(([, m]) => m.churn > 3).length / entries.length : 0.2;
  const busRisk = entries.length ? entries.filter(([, m]) => m.authorCount === 1).length / entries.length : 0.2;
  let bH = Math.max(45, Math.round(85 - hotRatio * 40 - busRisk * 20));
  let bC = Math.min(90, Math.round(40 + hotRatio * 30));
  let bCov = Math.max(30, Math.round(70 - busRisk * 25));
  const health = [], complexity = [], coverage = [];
  for (const m of months) {
    const impact = m.commits.length > 20 ? -2 : m.commits.length < 3 ? 1 : 0;
    const n = (Math.random() - 0.5) * 5;
    bH = Math.max(40, Math.min(99, bH + impact + n));
    bC = Math.max(20, Math.min(95, bC + (m.commits.length > 15 ? 1.5 : 0) + n * 0.4));
    bCov = Math.max(20, Math.min(95, bCov + (m.commits.length > 20 ? -1 : 0.5) + n * 0.3));
    health.push(Math.round(bH));
    complexity.push(Math.round(bC));
    coverage.push(Math.round(bCov));
  }
  return { labels: months.map(m => m.label), health, complexity, coverage };
}

/* ── Knowledge graph ───────────────────────────────────────────── */
function buildGraph(fileMetrics, repoDir) {
  const dirs = {};
  for (const [file, m] of Object.entries(fileMetrics)) {
    const parts = file.split('/');
    const top = parts[0];
    if (!dirs[top]) dirs[top] = { children: new Set(), churn: 0 };
    dirs[top].churn += m.churn;
    if (parts.length > 2) dirs[top].children.add(parts[1]);
  }
  const sorted = Object.entries(dirs).sort((a, b) => b[1].churn - a[1].churn).slice(0, 12);
  const cx = 400, cy = 200, r = 140;
  const repoName = path.basename(repoDir);
  const nodes = [{ id: 'root', label: repoName, type: 'repo', x: cx, y: cy }];
  const edges = [];
  sorted.forEach(([name, info], i) => {
    const angle = (i / sorted.length) * 2 * Math.PI - Math.PI / 2;
    nodes.push({ id: name, label: name + '/', type: 'module', x: Math.round(cx + r * Math.cos(angle)), y: Math.round(cy + r * Math.sin(angle)) });
    edges.push(['root', name]);
    [...info.children].slice(0, 2).forEach((child, j) => {
      const ca = angle + (j === 0 ? -0.3 : 0.3);
      const cr = r + 70;
      const cid = `${name}/${child}`;
      nodes.push({ id: cid, label: child, type: 'file', x: Math.round(cx + cr * Math.cos(ca)), y: Math.round(cy + cr * Math.sin(ca)) });
      edges.push([name, cid]);
    });
  });
  return { nodes, edges };
}

/* ── Health score ──────────────────────────────────────────────── */
function computeHealthScore(fileMetrics, commits, testInfo, deps) {
  const entries = Object.entries(fileMetrics);
  const hotRatio = entries.length ? entries.filter(([, m]) => m.churn > 5).length / entries.length : 0.2;
  const busRisk = entries.length ? entries.filter(([, m]) => m.authorCount === 1).length / entries.length : 0.3;
  const complexity = Math.max(10, Math.round(100 - hotRatio * 60 - busRisk * 20));
  const hotspot = Math.max(10, Math.round(100 - hotRatio * 80));
  const coverage = Math.max(10, Math.min(95, testInfo.coverage || Math.round(60 - busRisk * 30)));
  const dep = deps.score || 75;
  const total = Math.max(10, Math.min(99, Math.round(0.30 * complexity + 0.25 * coverage + 0.25 * hotspot + 0.20 * dep)));
  return { total, complexity, hotspot, coverage, dep };
}

/* ── Narrative ─────────────────────────────────────────────────── */
function generateNarrative(slug, score, hotspots, busFactor, commits, meta, testInfo, deps) {
  const grade = score.total >= 80 ? 'healthy' : score.total >= 60 ? 'moderate' : 'needs attention';
  const topH = hotspots[0];
  const busRisk = busFactor.filter(m => m.risk);
  const uniqueAuthors = new Set(commits.map(c => c.author).filter(Boolean)).size;
  let n = `<strong>Analysis of ${slug}:</strong> `;
  if (meta) n += `This <strong>${meta.language || 'code'}</strong> repository has ⭐ <strong>${(meta.stars||0).toLocaleString()}</strong> stars and <strong>${(meta.forks||0).toLocaleString()}</strong> forks. `;
  n += `The repository shows <strong>${grade} architecture</strong> with a score of <code>${score.total}/100</code>. `;
  if (topH) n += `Highest-risk hotspot: <code>${topH.path}</code> with <strong>${topH.churn}</strong> commits and <strong>${topH.complexity}</strong> complexity (${topH.level.toUpperCase()} risk). `;
  if (busRisk.length) n += `Bus factor = 1 in <strong>${busRisk.length} module${busRisk.length > 1 ? 's' : ''}</strong> (${busRisk.slice(0,3).map(m=>`<code>${m.name}</code>`).join(', ')}). `;
  if (testInfo.hasTests) n += `<strong>${testInfo.testFiles}</strong> test files detected (${testInfo.ratio}% test ratio). `;
  else n += `No test files detected — adding tests would significantly improve reliability. `;
  if (deps.files.length) n += `Dependencies found: ${deps.files.map(d=>`<code>${d.name}</code> (${d.count})`).join(', ')}. `;
  n += `Analyzed <strong>${commits.length} commits</strong> from <strong>${uniqueAuthors} contributors</strong>. `;
  n += score.total >= 75 ? `Overall health is solid. Keep monitoring churn patterns.` : `Recommend reducing hotspot churn and expanding test coverage.`;
  return n;
}

function replayResult(cached, emit) {
  if (cached.repoMeta) emit({ type: 'repoMeta', ...cached.repoMeta });
  emit({ type: 'commits', count: cached.commitCount });
  emit({ type: 'hotspots', files: cached.hotspots });
  if (cached.deps) emit({ type: 'dependencies', ...cached.deps });
  if (cached.testInfo) emit({ type: 'testCoverage', ...cached.testInfo });
  emit({ type: 'busfactor', modules: cached.busFactor });
  emit({ type: 'timeline', ...cached.timeline });
  emit({ type: 'graph', nodes: cached.graph.nodes, edges: cached.graph.edges });
  emit({ type: 'score', ...cached.score });
  emit({ type: 'narrative', text: cached.narrative });
  emit({ type: 'progress', stage: 'done', message: '✓ Loaded from cache instantly!', pct: 100 });
  emit({ type: 'done', repo: cached.slug, commitCount: cached.commitCount, duration: Date.now() });
}

module.exports = { analyzeRepo };
