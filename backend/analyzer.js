const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const execAsync = promisify(exec);
const { isReady } = require('./db');
const Analysis = require('./models/Analysis');

const TMP_DIR = path.join(__dirname, 'tmp');
const CACHE_TTL_MS = 30 * 60 * 1000;
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// In-memory fallback cache (used when MongoDB is unavailable)
const memCache = new Map();

async function getCached(slug) {
  // Try MongoDB first
  if (isReady()) {
    try {
      const cutoff = new Date(Date.now() - CACHE_TTL_MS);
      const doc = await Analysis.findOne({ slug, analyzedAt: { $gte: cutoff } })
        .sort({ analyzedAt: -1 }).lean();
      if (doc) {
        console.log(`[Cache] MongoDB hit for ${slug} (saved ${Math.round((Date.now() - new Date(doc.analyzedAt)) / 60000)}m ago)`);
        return doc;
      } else {
        console.log(`[Cache] MongoDB miss for ${slug} — will run fresh analysis`);
      }
    } catch (err) {
      console.warn('[Cache] MongoDB read error:', err.message);
    }
  } else {
    console.warn('[Cache] MongoDB not ready — skipping DB lookup');
  }
  // Fallback: in-memory
  const e = memCache.get(slug);
  if (e && Date.now() - e.ts < CACHE_TTL_MS) { console.log(`[Cache] Memory hit for ${slug}`); return e.result; }
  memCache.delete(slug);
  return null;
}

async function setCache(slug, result) {
  // Persist to MongoDB
  if (isReady()) {
    try {
      console.log(`[MongoDB] Saving analysis for ${slug}...`);
      const saved = await Analysis.findOneAndUpdate(
        { slug },
        { $set: { ...result, slug, analyzedAt: new Date() } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      console.log(`[MongoDB] ✓ Saved: ${slug} | score: ${saved.score?.total} | commits: ${saved.commitCount}`);
    } catch (err) {
      console.error('[MongoDB] ✗ Write FAILED:', err.message);
    }
  } else {
    console.warn('[MongoDB] Not ready — analysis NOT saved to DB for:', slug);
  }
  // Always keep in-memory copy too for speed
  memCache.set(slug, { result, ts: Date.now() });
}

/* ── GitHub API helper (5s timeout) ───────────────────────────── */
function githubAPI(endpoint, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.github.com',
      path: endpoint,
      headers: { 'User-Agent': 'RepoHealthIQ', ...(token ? { Authorization: `token ${token}` } : {}) },
      timeout: 5000,
    };
    const req = https.get(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/* ── Main entry ────────────────────────────────────────────────── */
async function analyzeRepo(repoInput, emit, options = {}) {
  const { token = '', depth = 200, geminiKey = process.env.GEMINI_API_KEY || '' } = options;

  let slug = repoInput.trim();
  try {
    if (slug.startsWith('http')) {
      slug = new URL(slug).pathname.substring(1);
    }
  } catch(e) {}
  slug = slug.replace(/\.git$/, '').replace(/\/+$/, '');
  
  const parts = slug.split('/');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    emit({ type: 'error', message: 'Invalid format. Use owner/repo (e.g. facebook/react)' });
    return;
  }
  
  slug = `${parts[0]}/${parts[1]}`.replace(/[^a-zA-Z0-9_\-\/]/g, '');

  const authPrefix = token ? `${token}@` : '';
  const repoUrl = `https://${authPrefix}github.com/${slug}.git`;
  const repoDir = path.join(TMP_DIR, slug.replace('/', '__'));

  try {
    // ── Cache check ──
    const cached = await getCached(slug);
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

    // ── Stage 2: Clone (blobless for speed) ──
    emit({ type: 'progress', stage: 'clone', message: `Cloning ${slug} (depth ${depth})...`, pct: 12 });
    const alreadyCloned = fs.existsSync(path.join(repoDir, '.git'));
    if (alreadyCloned) {
      emit({ type: 'progress', stage: 'clone', message: `Updating existing clone...`, pct: 14 });
      try { await execAsync(`git -C "${repoDir}" fetch --depth=${depth} --quiet 2>&1`, { timeout: 30000 }); } catch (_) {}
    } else {
      fs.mkdirSync(repoDir, { recursive: true });
      await execAsync(
        `git clone --depth ${depth} --single-branch --filter=blob:none --quiet "${repoUrl}" "${repoDir}" 2>&1`,
        { timeout: 90000 }
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

    // ── Stage 5-10: Run independent stages IN PARALLEL ──
    emit({ type: 'progress', stage: 'parallel', message: `Running analysis stages in parallel...`, pct: 55 });

    const [hotspots, deps, testInfo, busFactor, timeline, graph] = await Promise.all([
      // Stage 5: Hotspots (sync, from fileMetrics)
      Promise.resolve(buildHotspots(fileMetrics)),

      // Stage 6: Dependency scan (async, I/O bound)
      scanDependencies(repoDir),

      // Stage 7: Test detection (sync, file-system checks)
      Promise.resolve(detectTests(repoDir, fileMetrics)),

      // Stage 8: Bus factor (sync, from commits + fileMetrics)
      Promise.resolve(computeBusFactor(commits, fileMetrics)),

      // Stage 9: Timeline (sync, from commits + fileMetrics)
      Promise.resolve(buildTimeline(commits, fileMetrics)),

      // Stage 10: Graph (sync, from fileMetrics)
      Promise.resolve(buildGraph(fileMetrics, repoDir)),
    ]);

    // Emit all parallel results at once
    emit({ type: 'hotspots', files: hotspots });
    emit({ type: 'dependencies', ...deps });
    emit({ type: 'testCoverage', ...testInfo });
    emit({ type: 'busfactor', modules: busFactor });
    emit({ type: 'timeline', ...timeline });
    if (timeline.events && timeline.events.length > 0) emit({ type: 'timelineEvents', events: timeline.events });
    emit({ type: 'graph', nodes: graph.nodes, edges: graph.edges });
    emit({ type: 'progress', stage: 'parallel', message: `✓ All stages complete`, pct: 85 });

    // ── Stage 11: Health score ──
    emit({ type: 'progress', stage: 'score', message: `Computing health score...`, pct: 88 });
    const score = computeHealthScore(fileMetrics, commits, testInfo, deps);
    emit({ type: 'score', ...score });

    // ── Stage 12: Narrative (capped at 8s) ──
    emit({ type: 'progress', stage: 'narrative', message: `Generating analysis narrative...`, pct: 93 });
    const narrative = await generateNarrative(slug, score, hotspots, busFactor, commits, repoMeta, testInfo, deps, geminiKey);
    emit({ type: 'narrative', text: narrative });

    emit({ type: 'progress', stage: 'done', message: `✓ Analysis complete!`, pct: 100 });
    const result = { slug, commitCount: commits.length, depth, hotspots, busFactor, timeline, graph, score, narrative, repoMeta, testInfo, deps };
    await setCache(slug, result);
    // Also store unique authors count for frontend use
    const uniqueAuthors = new Set(commits.map(c => c.author).filter(Boolean)).size;
    emit({ type: 'authorCount', count: uniqueAuthors });
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
      // REDUCE INDEXING: skip binaries, assets, and lockfiles
      if (/\.(png|jpe?g|gif|svg|ico|webp|mp4|mp3|wav|pdf|csv|lock|zip|tar|gz)$/i.test(file)) continue;
      if (file.endsWith('package-lock.json') || file.endsWith('yarn.lock')) continue;

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
  const testPatterns = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /_test\.go$/, /test_.*\.py$/, /_spec\.rb$/, /Test\.java$/, /Tests\.java$/];
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'integration', 'cypress', 'playwright'];
  // CI config files are a strong signal that tests exist and run
  const ciSignals = [
    '.github/workflows', '.travis.yml', 'circle.yml', '.circleci',
    'Makefile', 'tox.ini', 'jest.config.js', 'jest.config.ts',
    'vitest.config.ts', 'vitest.config.js', 'pytest.ini', 'setup.cfg',
    '.mocharc.js', '.mocharc.yml', 'karma.conf.js',
  ];
  let testFiles = 0, sourceFiles = 0;
  let ciBonus = 0;

  // Check for CI/test-config signals in repo root
  for (const sig of ciSignals) {
    const sigPath = require('path').join(repoDir, sig);
    if (require('fs').existsSync(sigPath)) { ciBonus += 8; break; }
  }

  const allFiles = Object.keys(fileMetrics);
  for (const f of allFiles) {
    const isTest = testPatterns.some(p => p.test(f)) || testDirs.some(d => f.split('/').includes(d));
    if (isTest) testFiles++; else sourceFiles++;
  }
  const ratio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  // More realistic coverage estimate: ratio*150 (most repos have partial coverage)
  // plus CI bonus capped at 95
  const rawCoverage = Math.round(ratio * 150) + ciBonus;
  const coverage = Math.max(0, Math.min(95, rawCoverage));
  return { testFiles, sourceFiles, ratio: Math.round(ratio * 100), coverage, hasTests: testFiles > 0, hasCI: ciBonus > 0 };
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
    return { label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth(), commits: [] };
  });
  for (const c of commits) {
    const b = months.find(m => m.year === c.date.getFullYear() && m.month === c.date.getMonth());
    if (b) b.commits.push(c);
  }
  const entries = Object.entries(fileMetrics);
  const hotRatio = entries.length ? entries.filter(([, m]) => m.churn > 3).length / entries.length : 0.2;
  const busRisk = entries.length ? entries.filter(([, m]) => m.authorCount === 1).length / entries.length : 0.2;

  // Deterministic base scores derived from actual metrics (no random noise)
  const baseH   = Math.max(45, Math.min(90, Math.round(85 - hotRatio * 40 - busRisk * 20)));
  const baseC   = Math.max(20, Math.min(90, Math.round(40 + hotRatio * 30)));
  const baseCov = Math.max(20, Math.min(85, Math.round(70 - busRisk * 25)));

  // Compute avg monthly commits for normalisation
  const commitCounts = months.map(m => m.commits.length);
  const maxMonthly = Math.max(...commitCounts, 1);
  const avgMonthly = commitCounts.reduce((a, b) => a + b, 0) / 12;

  const health = [], complexity = [], coverage = [];
  let runH = baseH, runC = baseC, runCov = baseCov;

  for (const m of months) {
    const cnt = m.commits.length;
    // High-activity months → slightly more complexity/churn, potential health dip
    const activityRatio = cnt / (avgMonthly || 1);
    const hImpact   = activityRatio > 1.8 ? -3 : activityRatio > 1.3 ? -1 : activityRatio < 0.3 && cnt === 0 ? 0 : 0.5;
    const cImpact   = activityRatio > 1.5 ? 2  : activityRatio < 0.3 ? -0.5 : 0;
    const covImpact = activityRatio > 2.0 ? -1 : 0.3;

    runH   = Math.max(35, Math.min(99, runH   + hImpact));
    runC   = Math.max(15, Math.min(95, runC   + cImpact));
    runCov = Math.max(15, Math.min(95, runCov + covImpact));

    health.push(Math.round(runH));
    complexity.push(Math.round(runC));
    coverage.push(Math.round(runCov));
  }

  // Detect notable months: biggest drop and biggest rise in health
  const events = [];
  for (let i = 1; i < health.length; i++) {
    const delta = health[i] - health[i - 1];
    const cnt   = months[i].commits.length;
    if (delta <= -4) {
      events.push({
        type: 'drop',
        label: months[i].label,
        delta: Math.round(delta),
        commits: cnt,
        desc: `Health dropped ${Math.abs(Math.round(delta))} points. ${cnt > 0 ? `${cnt} commits this month increased churn/complexity.` : 'Low activity period.'}`
      });
    } else if (delta >= 3) {
      events.push({
        type: 'rise',
        label: months[i].label,
        delta: Math.round(delta),
        commits: cnt,
        desc: `Health improved ${Math.round(delta)} points. ${cnt > 0 ? `${cnt} commits this month.` : ''} Complexity stabilised.`
      });
    }
  }

  return {
    labels: months.map(m => m.label),
    health, complexity, coverage,
    events: events.slice(0, 4),   // at most 4 notable events
    commitCounts,
  };
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
  const totalFiles = entries.length || 1;

  // Hotspot ratio: files with high churn (> 5 commits)
  const hotRatio = entries.filter(([, m]) => m.churn > 5).length / totalFiles;
  // Bus risk: single-author files
  const busRisk  = entries.filter(([, m]) => m.authorCount === 1).length / totalFiles;

  // Complexity score: penalise hotspots + single-owner files
  const complexity = Math.max(10, Math.min(99, Math.round(100 - hotRatio * 55 - busRisk * 18)));

  // Hotspot score: purely churn-complexity based
  // With 0 files or 0 churn, it means we have no data — score 60 (neutral)
  const hotspot = totalFiles <= 1
    ? 60
    : Math.max(10, Math.min(99, Math.round(100 - hotRatio * 75)));

  // Coverage: use testInfo.coverage if available, else estimate from busRisk
  // If no dep files at all, don't assume 80 — assume unknown (55)
  const coverage = testInfo.coverage > 0
    ? Math.max(10, Math.min(95, testInfo.coverage))
    : Math.max(10, Math.round(55 - busRisk * 25));

  // Dependency score: unknown state (no dep files) → 60, not 80
  const dep = deps.totalDeps === 0 && deps.files.length === 0
    ? 60
    : Math.max(20, Math.min(99, deps.score || 60));

  // Weighted total
  const total = Math.max(10, Math.min(99, Math.round(
    0.30 * complexity +
    0.25 * coverage   +
    0.25 * hotspot    +
    0.20 * dep
  )));

  return { total, complexity, hotspot, coverage, dep };
}

/* ── Narrative ─────────────────────────────────────────────────── */
async function generateNarrative(slug, score, hotspots, busFactor, commits, meta, testInfo, deps, geminiKey) {
  const grade = score.total >= 80 ? 'healthy' : score.total >= 60 ? 'moderate' : 'needs attention';
  const topH = hotspots[0];
  const busRisk = busFactor.filter(m => m.risk);
  const uniqueAuthors = new Set(commits.map(c => c.author).filter(Boolean)).size;

  if (geminiKey) {
    const prompt = `You are a strict, senior software architect analyzing the repository "${slug}".
Provide a concise, 3-sentence architectural health summary using HTML tags for styling (e.g. <strong>, <code>, <span style="color:#f59e0b">).
Data:
- Health Score: ${score.total}/100 (${grade})
- Commits analyzed: ${commits.length} from ${uniqueAuthors} authors
- Top Hotspot: ${topH ? topH.path + ' (churn: ' + topH.churn + ')' : 'None'}
- Bus Factor Risk: ${busRisk.length} modules (${busRisk.map(m => m.name).join(', ')})
- Test Coverage: ${testInfo.ratio}% (${testInfo.testFiles} test files)
Output HTML only without markdown blocks.`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      const data = await response.json();
      if (data && data.candidates && data.candidates[0]) {
        let text = data.candidates[0].content.parts[0].text.trim();
        if (text.startsWith('\`\`\`html')) text = text.replace(/^\`\`\`html|\`\`\`$/g, '').trim();
        return text + ` <br><br><small style="color:var(--text-muted)"><em>Narrative generated by <strong>Gemini 1.5 Flash</strong></em></small>`;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[LLM] Gemini timed out after 8s — using fallback narrative');
      } else {
        console.error('[LLM] Gemini error:', err.message);
      }
    }
  }


  // Fallback to local heuristic string
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
  n += ` <br><br><small style="color:var(--text-muted)"><em>Provide a Gemini API key for AI-generated narrative.</em></small>`;
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
  if (cached.timeline && cached.timeline.events && cached.timeline.events.length > 0) {
    emit({ type: 'timelineEvents', events: cached.timeline.events });
  }
  emit({ type: 'graph', nodes: cached.graph.nodes, edges: cached.graph.edges });
  emit({ type: 'score', ...cached.score });
  emit({ type: 'narrative', text: cached.narrative });
  emit({ type: 'progress', stage: 'done', message: '✓ Loaded from cache instantly!', pct: 100 });
  emit({ type: 'done', repo: cached.slug, commitCount: cached.commitCount, duration: Date.now() });
}

module.exports = { analyzeRepo };
