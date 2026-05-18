/* ═══════════════════════════════════════════════════════════════════
   REPO HEALTH INTELLIGENCE — app.js
   Handles: animations, charts, graph viz, hotspot map, LLM panel,
            terminal simulation, tab switching, scroll effects
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Utility ───────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ═══════════════════════════════════════════════════════════════════
   1. NAVBAR SCROLL EFFECT
   ═══════════════════════════════════════════════════════════════════ */
const navbar = $('#navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

function toggleMenu() {
  $('#navMobile').classList.toggle('open');
}

/* ═══════════════════════════════════════════════════════════════════
   2. COUNTER ANIMATION (Hero Stats)
   ═══════════════════════════════════════════════════════════════════ */
function animateCounter(el, target, suffix = '') {
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || (target > 99 ? '+' : '');
    animateCounter(el, target, suffix);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.5 });

$$('.stat-number').forEach(el => counterObserver.observe(el));

/* ═══════════════════════════════════════════════════════════════════
   3. TERMINAL ANIMATION
   ═══════════════════════════════════════════════════════════════════ */
(function terminalSim() {
  const countEl = $('#commitCount');
  if (!countEl) return;
  let count = 0;
  const target = 847;
  const interval = setInterval(() => {
    count = Math.min(count + Math.floor(Math.random() * 60 + 20), target);
    countEl.textContent = count.toLocaleString();
    if (count >= target) clearInterval(interval);
  }, 80);
})();

/* ═══════════════════════════════════════════════════════════════════
   4. SCROLL REVEAL (Architecture Steps + general)
   ═══════════════════════════════════════════════════════════════════ */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (!e.isIntersecting) return;
    setTimeout(() => e.target.classList.add('visible'), i * 80);
    revealObserver.unobserve(e.target);
  });
}, { threshold: 0.15 });

$$('.arch-step').forEach(el => revealObserver.observe(el));

/* ═══════════════════════════════════════════════════════════════════
   5. MINI GRAPH (Feature Card)
   ═══════════════════════════════════════════════════════════════════ */
(function buildMiniGraph() {
  const container = $('#graphMini');
  if (!container) return;

  const nodes = [
    { id: 'auth', label: 'auth', x: 0.15, y: 0.2 },
    { id: 'db', label: 'db', x: 0.5, y: 0.1 },
    { id: 'api', label: 'api', x: 0.85, y: 0.25 },
    { id: 'core', label: 'core', x: 0.5, y: 0.55 },
    { id: 'ui', label: 'ui', x: 0.2, y: 0.82 },
    { id: 'test', label: 'test', x: 0.8, y: 0.78 },
  ];
  const edges = [
    ['auth', 'core'], ['db', 'core'], ['api', 'core'],
    ['core', 'ui'], ['core', 'test'], ['api', 'db'],
  ];

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';

  const w = 240, h = 120;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Edges
  edges.forEach(([a, b]) => {
    const na = nodes.find(n => n.id === a);
    const nb = nodes.find(n => n.id === b);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', na.x * w);
    line.setAttribute('y1', na.y * h);
    line.setAttribute('x2', nb.x * w);
    line.setAttribute('y2', nb.y * h);
    line.setAttribute('stroke', 'rgba(99,102,241,0.3)');
    line.setAttribute('stroke-width', '1.2');
    svg.appendChild(line);
  });

  // Nodes
  nodes.forEach(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x * w);
    circle.setAttribute('cy', n.y * h);
    circle.setAttribute('r', 6);
    circle.setAttribute('fill', n.id === 'core' ? '#6366f1' : 'rgba(99,102,241,0.4)');
    circle.setAttribute('stroke', '#6366f1');
    circle.setAttribute('stroke-width', '1.5');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', n.x * w);
    text.setAttribute('y', n.y * h + 16);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', 'rgba(170,170,220,0.7)');
    text.setAttribute('font-family', 'IBM Plex Mono, monospace');
    text.textContent = n.label;

    g.appendChild(circle);
    g.appendChild(text);
    svg.appendChild(g);
  });

  container.appendChild(svg);
})();

/* ═══════════════════════════════════════════════════════════════════
   6. TAB SWITCHING
   ═══════════════════════════════════════════════════════════════════ */
function switchTab(name, btn) {
  // Deactivate all tabs
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
  // Hide all panels — clear both class and inline display style
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  // Activate chosen tab button
  btn.classList.add('active');

  // Show chosen panel
  const panel = document.getElementById(`tab-${name}`);
  if (panel) { panel.classList.add('active'); panel.style.display = 'block'; }

  // Lazy-init
  if (name === 'hotspot' && !hotspotRendered) renderHotspotGrid();
  if (name === 'graph'   && !graphRendered)   renderKnowledgeGraph('current');
}

/* ═══════════════════════════════════════════════════════════════════
   7. TIMELINE CHART (Chart.js)
   ═══════════════════════════════════════════════════════════════════ */
let timelineChart = null;

function buildTimelineChart() {
  const ctx = $('#timelineChart');
  if (!ctx) return;

  const labels = [
    'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
    'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May',
  ];

  const health = [82, 80, 79, 81, 77, 75, 74, 72, 70, 62, 68, 74];
  const complexity = [58, 59, 60, 58, 61, 63, 65, 67, 68, 74, 70, 67];
  const coverage  = [72, 73, 74, 75, 73, 74, 74, 72, 70, 68, 72, 78];

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Health Score',
          data: health,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Complexity',
          data: complexity,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.4,
          borderDash: [4, 4],
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: 'Coverage',
          data: coverage,
          borderColor: '#22c55e',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.4,
          borderDash: [4, 4],
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#8888aa', font: { family: 'IBM Plex Mono', size: 11 }, boxWidth: 16 },
        },
        tooltip: {
          backgroundColor: '#0f0f1a',
          borderColor: '#2a2a4a',
          borderWidth: 1,
          titleColor: '#f0f0f8',
          bodyColor: '#8888aa',
          callbacks: {
            afterBody(items) {
              // Mark the March dip
              if (items[0].label === 'Mar') return ['⚠ PR #4821 — Auth Refactor'];
              if (items[0].label === 'May') return ['✓ PR #5103 — Tests expanded'];
              return [];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,30,56,0.8)' },
          ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } },
        },
        y: {
          min: 50, max: 100,
          grid: { color: 'rgba(30,30,56,0.8)' },
          ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } },
        },
      },
    },
  });
}

buildTimelineChart();

/* ═══════════════════════════════════════════════════════════════════
   8. HOTSPOT GRID
   ═══════════════════════════════════════════════════════════════════ */
let hotspotRendered = false; // true once real WS data has been rendered

function renderHotspotGrid() {
  // Only show placeholder if no real data has arrived yet
  if (hotspotRendered) return;
  const grid = $('#hotspotGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div style="grid-column:1/-1;padding:48px 24px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:.85rem;">
      ⬡ Enter a GitHub repository above and click <strong style="color:var(--accent)">Analyze Repository</strong> to see real hotspot data.
    </div>
  `;
}

function showHotspotDetail(item) {
  const llmBody = $('#llmBody');
  if (!llmBody) return;
  llmBody.innerHTML = `
    <p class="llm-text">
      <strong>Hotspot Analysis: ${item.path}</strong><br><br>
      Risk Score <code>${item.risk}/100</code> — This file has been edited <strong>${item.churn} times</strong>
      with <strong>${item.complexity}</strong> cyclomatic complexity, placing it in the
      <strong class="${item.level === 'critical' ? 'score-red' : item.level === 'high' ? 'score-amber' : 'score-green'}">${item.level.toUpperCase()}</strong> risk category.
      Files with this churn-to-complexity ratio are statistically 3–4× more likely to introduce regression bugs.
      Recommendation: add integration tests before any further modification, and consider breaking this module
      into smaller, single-responsibility units.
    </p>
  `;
  document.getElementById('llm-panel') && document.getElementById('llm-panel').scrollIntoView({ behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════════════════════
   9. KNOWLEDGE GRAPH (D3-like SVG)
   ═══════════════════════════════════════════════════════════════════ */
const graphNodes = {
  current: [
    { id: 'tensorflow', label: 'tensorflow', type: 'repo', x: 400, y: 200 },
    { id: 'core', label: 'core/', type: 'module', x: 220, y: 120 },
    { id: 'auth', label: 'auth/', type: 'module', x: 580, y: 100 },
    { id: 'ops', label: 'ops/', type: 'module', x: 150, y: 270 },
    { id: 'python', label: 'python/', type: 'module', x: 650, y: 260 },
    { id: 'kernels', label: 'kernels/', type: 'file', x: 100, y: 160 },
    { id: 'oauth', label: 'oauth.py', type: 'file', x: 560, y: 40 },
    { id: 'session', label: 'session.py', type: 'file', x: 720, y: 160 },
    { id: 'graph', label: 'graph.py', type: 'file', x: 300, y: 320 },
    { id: 'nn', label: 'nn/', type: 'module', x: 480, y: 340 },
  ],
};

const graphEdges = {
  current: [
    ['tensorflow', 'core'], ['tensorflow', 'auth'], ['tensorflow', 'python'],
    ['core', 'ops'], ['core', 'kernels'], ['core', 'graph'],
    ['auth', 'oauth'], ['auth', 'session'],
    ['python', 'nn'], ['python', 'session'],
    ['ops', 'kernels'], ['nn', 'ops'],
  ],
};

const diffNodes = [
  { id: 'newclass1', label: 'NewCls1', type: 'new', x: 400, y: 40 },
  { id: 'newclass2', label: 'NewCls2', type: 'new', x: 520, y: 40 },
];

const diffEdges = [
  ['tensorflow', 'newclass1'], ['tensorflow', 'newclass2'],
];

let graphMode = 'current';
let graphRendered = false;

function setGraphMode(mode, btn) {
  $$('.gc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  graphMode = mode;
  renderKnowledgeGraph(mode);
  const legend = $('#graphDiffLegend');
  if (legend) legend.style.display = mode === 'diff' ? 'flex' : 'none';
}

function renderKnowledgeGraph(mode) {
  const svg = document.getElementById('knowledgeGraph');
  if (!svg) return;

  const W = svg.getBoundingClientRect().width || 800;
  const H = 400;
  svg.innerHTML = '';

  const typeColors = { repo: '#6366f1', module: '#22d3ee', file: '#f59e0b', new: '#22c55e', removed: '#ef4444' };

  const nodes = [...graphNodes.current, ...(mode === 'diff' ? diffNodes : [])];
  const edges = [...graphEdges.current, ...(mode === 'diff' ? diffEdges : [])];

  // Scale nodes to SVG size
  const scaleX = W / 800;
  const scaleY = H / 400;

  // Draw edges
  edges.forEach(([a, b]) => {
    const na = nodes.find(n => n.id === a);
    const nb = nodes.find(n => n.id === b);
    if (!na || !nb) return;

    const isDiff = mode === 'diff' && (diffEdges.some(e => e[0] === a && e[1] === b));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', na.x * scaleX);
    line.setAttribute('y1', na.y * scaleY);
    line.setAttribute('x2', nb.x * scaleX);
    line.setAttribute('y2', nb.y * scaleY);
    line.setAttribute('stroke', isDiff ? 'rgba(34,197,94,0.5)' : 'rgba(99,102,241,0.25)');
    line.setAttribute('stroke-width', isDiff ? '2' : '1.5');
    if (isDiff) line.setAttribute('stroke-dasharray', '5,3');
    svg.appendChild(line);
  });

  // Draw nodes
  nodes.forEach(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'graph-node');
    g.style.cursor = 'pointer';

    const isNew = n.type === 'new';
    const r = n.type === 'repo' ? 18 : n.type === 'module' ? 12 : 8;
    const color = typeColors[n.type] || '#6366f1';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x * scaleX);
    circle.setAttribute('cy', n.y * scaleY);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', `${color}33`);
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', isNew ? '2.5' : '1.5');
    if (isNew) {
      circle.style.animation = 'pulse 2s ease-in-out infinite';
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', n.x * scaleX);
    text.setAttribute('y', n.y * scaleY + r + 13);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', n.type === 'repo' ? '10' : '9');
    text.setAttribute('fill', n.type === 'repo' ? '#f0f0f8' : '#8888aa');
    text.setAttribute('font-family', 'IBM Plex Mono, monospace');
    text.textContent = n.label;

    g.appendChild(circle);
    g.appendChild(text);

    // Hover glow
    g.addEventListener('mouseenter', () => {
      circle.setAttribute('fill', `${color}55`);
      circle.setAttribute('r', r + 3);
    });
    g.addEventListener('mouseleave', () => {
      circle.setAttribute('fill', `${color}33`);
      circle.setAttribute('r', r);
    });

    svg.appendChild(g);
  });

  graphRendered = true;
}

// Auto-render graph when tab first opens
document.addEventListener('DOMContentLoaded', () => {
  // render if graph tab visible initially (it won't be)
});

/* ═══════════════════════════════════════════════════════════════════
   10. BUS FACTOR VISUALIZATION
   ═══════════════════════════════════════════════════════════════════ */
(function buildBusBars() {
  const container = $('#busBars');
  if (!container) return;

  const modules = [
    { name: 'auth/', factor: 1, risk: true },
    { name: 'kernels/', factor: 1, risk: true },
    { name: 'graph.py', factor: 1, risk: true },
    { name: 'core/', factor: 3, risk: false },
    { name: 'python/', factor: 5, risk: false },
    { name: 'ops/', factor: 4, risk: false },
  ];

  modules.forEach(m => {
    const bar = document.createElement('div');
    bar.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; font-family: 'IBM Plex Mono', monospace;
    `;

    const val = document.createElement('div');
    val.style.cssText = `
      font-size: 0.75rem; font-weight: 600;
      color: ${m.risk ? '#ef4444' : '#22c55e'};
    `;
    val.textContent = m.factor;

    const rect = document.createElement('div');
    const h = Math.max(m.factor * 14, 14);
    rect.style.cssText = `
      width: 28px; height: ${h}px; border-radius: 4px 4px 2px 2px;
      background: ${m.risk ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'};
      border: 1px solid ${m.risk ? '#ef4444' : '#22c55e'};
      transition: height 1s ease;
    `;

    const label = document.createElement('div');
    label.style.cssText = `font-size: 0.65rem; color: #444466; max-width: 32px; text-align: center; word-break: break-all;`;
    label.textContent = m.name.replace('/', '');

    bar.appendChild(val);
    bar.appendChild(rect);
    bar.appendChild(label);
    container.appendChild(bar);
  });
})();

/* ═══════════════════════════════════════════════════════════════════
   11. ARCHITECTURAL DRIFT CHART (SVG sparkline)
   ═══════════════════════════════════════════════════════════════════ */
(function buildDriftChart() {
  const container = $('#driftChart');
  if (!container) return;

  const values = [34, 35, 34, 36, 37, 38, 37, 39, 40, 42, 43, 40];
  const w = 240, h = 80;
  const pad = 10;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', h);

  const maxV = Math.max(...values);
  const minV = Math.min(...values) - 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - minV) / (maxV - minV)) * (h - pad * 2);
    return `${x},${y}`;
  });

  // Area fill
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  area.setAttribute('points',
    `${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}`
  );
  area.setAttribute('fill', 'rgba(239,68,68,0.12)');
  svg.appendChild(area);

  // Line
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', pts.join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#ef4444');
  polyline.setAttribute('stroke-width', '2');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  // X-axis labels
  ['Jun', '', '', 'Sep', '', '', 'Dec', '', '', 'Mar', '', 'May'].forEach((label, i) => {
    if (!label) return;
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', h - 1);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '7');
    text.setAttribute('fill', '#444466');
    text.setAttribute('font-family', 'IBM Plex Mono');
    text.textContent = label;
    svg.appendChild(text);
  });

  container.appendChild(svg);
})();

/* ═══════════════════════════════════════════════════════════════════
   12. HEALTH SCORE ANIMATION ON LOAD
   ═══════════════════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  setTimeout(() => {
    const fill = $('#healthFill');
    if (fill) fill.style.width = '74.2%';
  }, 400);
});

/* ═══════════════════════════════════════════════════════════════════
   13. ANALYZE REPO — Real-time WebSocket powered
   ═══════════════════════════════════════════════════════════════════ */
const WS_URL = 'ws://localhost:3001';
let ws = null;
let wsReady = false;

function connectWS() {
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen  = () => {
      wsReady = true;
      console.log('[WS] Connected to backend');
      const dot = document.getElementById('wsStatusDot');
      if (dot) { dot.classList.add('ws-connected'); dot.title = 'Backend connected ✓'; }
    };
    ws.onclose = () => {
      wsReady = false;
      const dot = document.getElementById('wsStatusDot');
      if (dot) { dot.classList.remove('ws-connected'); dot.title = 'Backend disconnected — reconnecting...'; }
      setTimeout(connectWS, 3000);
    };
    ws.onerror = () => { wsReady = false; };
    ws.onmessage = (e) => { try { handleWSEvent(JSON.parse(e.data)); } catch(_) {} };
  } catch(_) { setTimeout(connectWS, 3000); }
}
connectWS();

function handleWSEvent(ev) {
  switch (ev.type) {
    case 'progress':      onProgress(ev);      break;
    case 'commits':       onCommits(ev);       break;
    case 'timeline':      onTimeline(ev);      break;
    case 'hotspots':      onHotspots(ev);      break;
    case 'busfactor':     onBusFactor(ev);     break;
    case 'graph':         onGraph(ev);         break;
    case 'score':         onScore(ev);         break;
    case 'narrative':     onNarrative(ev);     break;
    case 'done':          onDone(ev);          break;
    case 'error':         onError(ev);         break;
    case 'repoMeta':      onRepoMeta(ev);      break;
    case 'dependencies':  onDependencies(ev);  break;
    case 'testCoverage':  onTestCoverage(ev);  break;
  }
}

function runAnalysis() {
  const btn = $('.analyze-btn');
  const input = $('#repoInput');
  const repo = input ? input.value.trim() : '';
  if (!repo) { alert('Please enter a GitHub repo (e.g. facebook/react)'); return; }

  if (!wsReady) {
    const llmBody = $('#llmBody');
    if (llmBody) llmBody.innerHTML = '<p class="llm-text" style="color:#f59e0b">⚠ Connecting to backend server... Make sure <code>node backend/server.js</code> is running on port 3001.</p>';
    return;
  }

  if (btn) { btn.classList.add('loading'); }
  $('#analyzeBtnText') && ($('#analyzeBtnText').textContent = 'Analyzing...');

  // Reset flags so panels re-render with new data
  hotspotRendered = false;
  graphRendered = false;

  // Show overlay
  const overlay = $('#analysisOverlay');
  if (overlay) overlay.classList.add('active');
  const bar = $('#liveProgressBar');
  if (bar) bar.style.width = '0%';

  // Clear terminal
  const tb = $('#terminalBody');
  if (tb) tb.innerHTML = `<div class="term-line"><span class="term-prompt">$</span> rhi analyze ${repo}</div>`;

  // Reset LLM
  const llmBody = $('#llmBody');
  if (llmBody) llmBody.innerHTML = '<p class="llm-text" style="color:#444466;font-family:var(--font-mono);font-size:.85rem;">Analyzing<span class="cursor-blink"></span></p>';

  const token = ($('#githubToken') || {}).value || '';
  const depth = ($('#depthSelect') || {}).value || '200';
  ws.send(JSON.stringify({ type: 'analyze', repo, token, depth: parseInt(depth) }));
}

/* ── WS event handlers ── */
function onProgress(ev) {
  const bar = $('#liveProgressBar'), msg = $('#liveProgressMsg');
  if (bar) bar.style.width = ev.pct + '%';
  if (msg) msg.textContent = ev.message;
  addTerminalLine(ev.message, ev.pct === 100 ? 'success' : 'dim');
}

function onCommits(ev) {
  const el = $('#commitCount');
  if (el) animateCounter(el, ev.count, '');
}

function onTimeline(ev) {
  if (timelineChart) timelineChart.destroy();
  const ctx = $('#timelineChart');
  if (!ctx) return;
  const meta = document.querySelector('.panel-meta');
  if (meta) meta.textContent = `Past 12 months · ${ev.health.length} data points`;
  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ev.labels,
      datasets: [
        { label: 'Health Score', data: ev.health,     borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6 },
        { label: 'Complexity',   data: ev.complexity, borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
        { label: 'Coverage',     data: ev.coverage,   borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
      ],
    },
    options: {
      responsive: true, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8888aa', font: { family: 'IBM Plex Mono', size: 11 }, boxWidth: 16 } },
        tooltip: { backgroundColor: '#0f0f1a', borderColor: '#2a2a4a', borderWidth: 1, titleColor: '#f0f0f8', bodyColor: '#8888aa' },
      },
      scales: {
        x: { grid: { color: 'rgba(30,30,56,0.8)' }, ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { min: 30, max: 100, grid: { color: 'rgba(30,30,56,0.8)' }, ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
    },
  });
}

function onHotspots(ev) {
  const grid = document.getElementById('hotspotGrid');
  if (!grid) { console.warn('[onHotspots] #hotspotGrid not found'); return; }

  grid.innerHTML = '';

  if (!ev.files || ev.files.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:.85rem;">No hotspot data found — try a different repo or increase depth.</div>`;
  } else {
    ev.files.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = `hotspot-item ${item.level || 'medium'}`;
      el.style.animationDelay = `${i * 40}ms`;
      const filename = item.path.split('/').pop();
      el.innerHTML = `<div class="hs-path" title="${item.path}">${filename}</div><div class="hs-risk">${item.risk}</div><div class="hs-detail"><span>Churn: ${item.churn}</span><span>${item.complexity}</span></div>`;
      el.addEventListener('click', () => showHotspotDetail(item));
      grid.appendChild(el);
    });
  }

  hotspotRendered = true;

  // ── Reliable tab switch using id ──
  const allBtns   = document.querySelectorAll('.dash-tab');
  const allPanels = document.querySelectorAll('.tab-panel');
  const hotspotBtn   = document.getElementById('tabBtnHotspot');
  const hotspotPanel = document.getElementById('tab-hotspot');

  allBtns.forEach(b => b.classList.remove('active'));
  allPanels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });

  if (hotspotBtn)   { hotspotBtn.classList.add('active'); hotspotBtn.innerHTML = 'Hotspot Map <span class="tab-badge">LIVE</span>'; setTimeout(() => { hotspotBtn.innerHTML = 'Hotspot Map'; }, 4000); }
  if (hotspotPanel) { hotspotPanel.classList.add('active'); hotspotPanel.style.display = 'block'; }
}

function onBusFactor(ev) {
  const c = $('#busBars');
  if (!c) return;
  c.innerHTML = '';
  const riskN = ev.modules.filter(m => m.risk).length;
  const alert = document.querySelector('.bus-alert span:last-child');
  if (alert) alert.textContent = `${riskN} module${riskN !== 1 ? 's' : ''} have bus factor = 1`;
  ev.modules.forEach(m => {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;font-family:IBM Plex Mono,monospace;';
    const val = document.createElement('div');
    val.style.cssText = `font-size:.75rem;font-weight:600;color:${m.risk ? '#ef4444' : '#22c55e'};`;
    val.textContent = m.factor;
    const rect = document.createElement('div');
    rect.style.cssText = `width:28px;height:${Math.min(m.factor * 12, 60)}px;border-radius:4px 4px 2px 2px;background:${m.risk ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'};border:1px solid ${m.risk ? '#ef4444' : '#22c55e'};`;
    const label = document.createElement('div');
    label.style.cssText = 'font-size:.65rem;color:#444466;max-width:36px;text-align:center;word-break:break-all;';
    label.textContent = m.name.replace('/', '');
    bar.appendChild(val); bar.appendChild(rect); bar.appendChild(label);
    c.appendChild(bar);
  });
}

function onGraph(ev) {
  const svg = document.getElementById('knowledgeGraph');
  if (!svg) return;
  const W = svg.getBoundingClientRect().width || 800, H = 400;
  svg.innerHTML = '';
  const typeColors = { repo: '#6366f1', module: '#22d3ee', file: '#f59e0b' };
  const sX = W / 800, sY = H / 400;
  ev.edges.forEach(([a, b]) => {
    const na = ev.nodes.find(n => n.id === a), nb = ev.nodes.find(n => n.id === b);
    if (!na || !nb) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ['x1','y1','x2','y2'].forEach((attr, i) => line.setAttribute(attr, [na.x*sX, na.y*sY, nb.x*sX, nb.y*sY][i]));
    line.setAttribute('stroke','rgba(99,102,241,0.25)'); line.setAttribute('stroke-width','1.5');
    svg.appendChild(line);
  });
  ev.nodes.forEach(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const r = n.type === 'repo' ? 18 : n.type === 'module' ? 12 : 8;
    const color = typeColors[n.type] || '#6366f1';
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x*sX); circle.setAttribute('cy', n.y*sY);
    circle.setAttribute('r', r); circle.setAttribute('fill', color+'33');
    circle.setAttribute('stroke', color); circle.setAttribute('stroke-width','1.5');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', n.x*sX); text.setAttribute('y', n.y*sY + r + 13);
    text.setAttribute('text-anchor','middle'); text.setAttribute('font-size', n.type === 'repo' ? '10' : '9');
    text.setAttribute('fill', n.type === 'repo' ? '#f0f0f8' : '#8888aa');
    text.setAttribute('font-family','IBM Plex Mono, monospace'); text.textContent = n.label;
    g.addEventListener('mouseenter', () => { circle.setAttribute('fill', color+'55'); circle.setAttribute('r', r+3); });
    g.addEventListener('mouseleave', () => { circle.setAttribute('fill', color+'33'); circle.setAttribute('r', r); });
    g.appendChild(circle); g.appendChild(text); svg.appendChild(g);
  });
  graphRendered = true;
}

function onScore(ev) {
  const scoreEl = $('#healthScore'), gradeEl = $('#healthGrade'), fillEl = $('#healthFill');
  if (scoreEl) scoreEl.textContent = ev.total;
  if (gradeEl) {
    const grade = ev.total >= 80 ? 'Healthy' : ev.total >= 60 ? 'Moderate' : 'At Risk';
    gradeEl.textContent = grade;
    gradeEl.className = 'hs-grade ' + (ev.total >= 80 ? 'healthy' : ev.total >= 60 ? 'moderate' : 'at-risk');
  }
  if (fillEl) fillEl.style.width = ev.total + '%';
  const ss = $('#subscores');
  if (ss) ss.innerHTML = [
    ['Complexity Drift', ev.complexity, '#f59e0b'],
    ['Test Coverage',    ev.coverage,   '#22c55e'],
    ['Hotspot Risk',     ev.hotspot,    '#ef4444'],
    ['Dependency Rot',   ev.dep,        '#22c55e'],
  ].map(([l,v,c]) => `<div class="subscore"><div class="ss-label">${l}</div><div class="ss-bar"><div class="ss-fill" style="width:${v}%;background:${c}"></div></div><div class="ss-val">${v}</div></div>`).join('');
  const fwResult = document.querySelector('.fw-result');
  if (fwResult) fwResult.textContent = ev.total;
  document.querySelectorAll('.fw-row').forEach((row, i) => {
    const vals = [ev.complexity, ev.coverage, ev.hotspot, ev.dep];
    const v = row.querySelector('.fw-v');
    if (v && vals[i] !== undefined) { v.textContent = vals[i]; v.className = 'fw-v ' + (vals[i] >= 70 ? 'score-green' : vals[i] >= 50 ? 'score-amber' : 'score-red'); }
  });
}

function onNarrative(ev) {
  const llmBody = $('#llmBody');
  if (!llmBody) return;
  llmBody.style.opacity = '0';
  setTimeout(() => { llmBody.innerHTML = `<p class="llm-text">${ev.text}</p>`; llmBody.style.opacity = '1'; llmBody.style.transition = 'opacity 0.4s'; }, 200);
}

function onDone(ev) {
  const btn = $('.analyze-btn'), btnText = $('#analyzeBtnText');
  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = 'Analyze Repository';
  const overlay = $('#analysisOverlay');
  if (overlay) setTimeout(() => overlay.classList.remove('active'), 1500);
  addTerminalLine(`✓ ${ev.repo} — ${ev.commitCount} commits analyzed`, 'success');
}

function onError(ev) {
  const btn = $('.analyze-btn'), btnText = $('#analyzeBtnText');
  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = 'Analyze Repository';
  const overlay = $('#analysisOverlay');
  if (overlay) overlay.classList.remove('active');
  const llmBody = $('#llmBody');
  if (llmBody) llmBody.innerHTML = `<p class="llm-text" style="color:#ef4444"><strong>Error:</strong> ${ev.message}</p>`;
  addTerminalLine('✗ ' + ev.message, 'dim');
}

function addTerminalLine(text, cls = 'dim') {
  const body = $('#terminalBody');
  if (!body) return;
  const line = document.createElement('div');
  line.className = `term-line ${cls}`;
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
  while (body.children.length > 14) body.removeChild(body.firstChild);
}

/* ═══════════════════════════════════════════════════════════════════
   14. LLM REFRESH
   ═══════════════════════════════════════════════════════════════════ */
const llmNarratives = [
  `<strong>Analysis of tensorflow/tensorflow:</strong> The repository demonstrates moderate health at <code>74.2/100</code>. The primary concern is hotspot risk in <code>src/core/kernels/</code> — this directory accounts for 31% of all commits but carries a cyclomatic complexity index of 2.4× the project average. The auth module saw significant coupling increase in March (PR #4821), introducing a new OAuth2 dependency chain without corresponding test coverage.`,
  `<strong>Architectural Assessment:</strong> Dependency analysis reveals 14 transitive dependencies added over the last 90 days in the authentication layer. Three of these are sub-maintained packages (last commit >18 months). The knowledge graph shows a tightening coupling between <code>auth/</code> and <code>core/</code> — an architectural drift pattern that historically precedes integration failures.`,
  `<strong>Risk Forecast:</strong> Based on churn-complexity analysis, <code>src/core/kernels/</code> has an 83% probability of containing a defect in the next 30 days if left unaddressed. The bus factor of 1 for the OAuth module means any developer absence will create a knowledge bottleneck. Immediate actions: pair-program the OAuth refactor, add regression tests for kernels, audit dependency versions.`,
];
let llmIndex = 0;

function refreshLLM() {
  llmIndex = (llmIndex + 1) % llmNarratives.length;
  const llmBody = $('#llmBody');
  if (!llmBody) return;
  llmBody.style.opacity = '0';
  setTimeout(() => {
    llmBody.innerHTML = `<p class="llm-text">${llmNarratives[llmIndex]}</p>`;
    llmBody.style.opacity = '1';
    llmBody.style.transition = 'opacity 0.4s';
  }, 200);
}

/* ═══════════════════════════════════════════════════════════════════
   15. PRE-MERGE PR SIMULATION
   ═══════════════════════════════════════════════════════════════════ */
function simulatePR() {
  const input = $('.pr-input');
  const pr = input ? input.value.trim() || 'PR #5201' : 'PR #5201';
  const scoreEl = $('.ms-score');
  const changeEl = $('.ms-change');
  const labelEl = $('.ms-score-label');
  const prEl = $('.ms-pr');

  if (!scoreEl) return;

  if (prEl) prEl.textContent = pr.startsWith('PR') ? pr : `PR #${pr}`;
  if (labelEl) labelEl.textContent = 'Predicting...';
  scoreEl.textContent = '—';

  setTimeout(() => {
    const delta = -(Math.random() * 6 + 0.5).toFixed(1);
    const newScore = (74.2 + parseFloat(delta)).toFixed(1);
    if (labelEl) labelEl.textContent = 'Predicted';
    scoreEl.textContent = newScore;
    changeEl.textContent = `▼ ${Math.abs(delta)}`;
    changeEl.className = 'ms-change negative';
  }, 1200);
}

/* ═══════════════════════════════════════════════════════════════════
   16. INTERSECTION OBSERVER — feature cards stagger
   ═══════════════════════════════════════════════════════════════════ */
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (!e.isIntersecting) return;
    setTimeout(() => {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }, i * 60);
    cardObserver.unobserve(e.target);
  });
}, { threshold: 0.1 });

$$('.feature-card, .bonus-card, .tech-col, .md-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  cardObserver.observe(el);
});

/* ═══════════════════════════════════════════════════════════════════
   17. MOBILE NAV close on link click
   ═══════════════════════════════════════════════════════════════════ */
$$('.nav-mobile a').forEach(a => {
  a.addEventListener('click', () => {
    $('#navMobile').classList.remove('open');
  });
});

/* ═══════════════════════════════════════════════════════════════════
   18. INITIAL RENDER — graph tab on first view
   ═══════════════════════════════════════════════════════════════════ */
// Render hotspot on page load (first tab is timeline)
document.addEventListener('DOMContentLoaded', () => {
  // Initial graph render once the SVG is in the DOM
  const graphObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      if (!graphRendered) renderKnowledgeGraph(graphMode);
      graphObserver.unobserve(e.target);
    });
  }, { threshold: 0.2 });

  const graphEl = $('#knowledgeGraph');
  if (graphEl) graphObserver.observe(graphEl);
});

/* ═══════════════════════════════════════════════════════════════════
   19. NEW EVENT HANDLERS — repoMeta, dependencies, testCoverage
   ═══════════════════════════════════════════════════════════════════ */
function onRepoMeta(ev) {
  // Show / update the meta banner below the input bar
  let banner = $('#repoMetaBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'repoMetaBanner';
    banner.className = 'repo-meta-banner';
    const inputBar = document.querySelector('.repo-input-bar');
    if (inputBar) inputBar.insertAdjacentElement('afterend', banner);
  }
  const lang = ev.language || 'Unknown';
  const langColor = { JavaScript:'#f7df1e', TypeScript:'#3178c6', Python:'#3572A5', Go:'#00ADD8', Rust:'#dea584', Java:'#b07219', Ruby:'#701516', 'C++':'#f34b7d', C:'#555555' }[lang] || '#6366f1';
  banner.innerHTML = `
    <span class="rmt-item"><span class="rmt-dot" style="background:${langColor}"></span>${lang}</span>
    <span class="rmt-divider">·</span>
    <span class="rmt-item">⭐ ${(ev.stars||0).toLocaleString()}</span>
    <span class="rmt-divider">·</span>
    <span class="rmt-item">🍴 ${(ev.forks||0).toLocaleString()}</span>
    <span class="rmt-divider">·</span>
    <span class="rmt-item">🐛 ${(ev.issues||0).toLocaleString()} open issues</span>
    ${ev.private ? '<span class="rmt-badge">PRIVATE</span>' : ''}
  `;
  banner.style.opacity = '1';
}

function onDependencies(ev) {
  // Update dep score bar + list in the Metric Breakdown tab
  const depScoreEl = $('#depScore');
  if (depScoreEl) {
    depScoreEl.textContent = ev.score || 80;
    const fill = depScoreEl.closest('.subscore')?.querySelector('.ss-fill');
    if (fill) fill.style.width = (ev.score || 80) + '%';
  }
  // Also write to the dep panel if it exists
  let depPanel = $('#depScanPanel');
  if (!depPanel) return;
  if (!ev.files || ev.files.length === 0) {
    depPanel.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;font-family:var(--font-mono);">No dependency files detected.</p>';
    return;
  }
  depPanel.innerHTML = ev.files.map(f =>
    `<div class="dep-row"><span class="dep-name">${f.name}</span><span class="dep-type">${f.type}</span><span class="dep-count">${f.count} deps</span></div>`
  ).join('');
}

function onTestCoverage(ev) {
  const el = $('#testCoverageInfo');
  if (!el) return;
  el.innerHTML = `
    <span class="${ev.hasTests ? 'tc-yes' : 'tc-no'}">${ev.hasTests ? '✓ Tests detected' : '✗ No tests found'}</span>
    &nbsp;·&nbsp; ${ev.testFiles} test files / ${ev.sourceFiles} source files
    &nbsp;·&nbsp; Test ratio: <strong>${ev.ratio}%</strong>
  `;
}

