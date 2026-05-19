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
(function initBusBars() {
  // Show placeholder until real WS data arrives
  const container = $('#busBars');
  if (!container) return;
  container.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:.78rem;text-align:center;width:100%;padding:12px 0;">Run an analysis to see real bus factor data</div>`;
})();

/* ═══════════════════════════════════════════════════════════════════
   11. ARCHITECTURAL DRIFT CHART (SVG sparkline — real-time)
   ═══════════════════════════════════════════════════════════════════ */
function renderDriftChart(values, labels) {
  const container = $('#driftChart');
  if (!container) return;
  container.innerHTML = '';

  const w = 240, h = 80, pad = 10;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', h);

  const maxV = Math.max(...values);
  const minV = Math.min(...values) - 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - minV) / (maxV - minV + 0.01)) * (h - pad * 2);
    return `${x},${y}`;
  });

  // Colour: rising = red (bad), falling = green (improving)
  const trend = values[values.length - 1] - values[0];
  const lineColor = trend > 0 ? '#ef4444' : '#22c55e';
  const fillColor = trend > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.10)';

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  area.setAttribute('points', `${pad},${h - pad} ${pts.join(' ')} ${w - pad},${h - pad}`);
  area.setAttribute('fill', fillColor);
  svg.appendChild(area);

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', pts.join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', lineColor);
  polyline.setAttribute('stroke-width', '2');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  // X-axis labels (every 4th month)
  labels.forEach((label, i) => {
    if (i % 4 !== 0 && i !== labels.length - 1) return;
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

  // Update coupling index metric text
  const driftValEl = document.querySelector('.drift-val');
  if (driftValEl) {
    // Compare first quarter vs last quarter of complexity
    const q = Math.max(1, Math.floor(values.length / 4));
    const firstQ = values.slice(0, q).reduce((a, b) => a + b, 0) / q;
    const lastQ  = values.slice(-q).reduce((a, b) => a + b, 0) / q;
    const pct    = firstQ > 0 ? Math.round(((lastQ - firstQ) / firstQ) * 100) : 0;
    const rising = pct >= 0;
    driftValEl.textContent = `${rising ? '\u2191' : '\u2193'} ${Math.abs(pct)}% over ${labels.length} months`;
    driftValEl.className   = `drift-val ${rising ? 'rising' : 'falling'}`;
  }
}

// Initial placeholder render
(function initDriftChart() {
  const container = $('#driftChart');
  if (!container) return;
  container.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:.75rem;text-align:center;padding:24px 0;">Run an analysis to see real drift data</div>`;
  const driftValEl = document.querySelector('.drift-val');
  if (driftValEl) { driftValEl.textContent = '— awaiting analysis'; driftValEl.className = 'drift-val'; }
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
/* ─── Smart WS URL: local dev uses localhost, Vercel uses ngrok URL from localStorage ─── */
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const STORED_WS = localStorage.getItem('rhi_backend_url');
const WS_URL = IS_LOCAL
  ? 'ws://localhost:3001'
  : (STORED_WS || 'ws://localhost:3001');   // on Vercel, use stored ngrok URL

let ws = null;
let wsReady = false;

/* ─── Show backend URL configurator when on Vercel ─── */
if (!IS_LOCAL) {
  document.addEventListener('DOMContentLoaded', () => {
    const existing = document.getElementById('backendConfig');
    if (existing) return;
    const bar = document.createElement('div');
    bar.id = 'backendConfig';
    bar.style.cssText = `
      position:fixed; bottom:16px; right:16px; z-index:9999;
      background:#0f0f1a; border:1px solid #6366f1; border-radius:10px;
      padding:12px 16px; font-family:IBM Plex Mono,monospace; font-size:.78rem;
      color:#8888aa; max-width:340px; box-shadow:0 4px 24px rgba(99,102,241,.3);
    `;
    const saved = localStorage.getItem('rhi_backend_url') || '';
    bar.innerHTML = `
      <div style="color:#f0f0f8;font-weight:600;margin-bottom:8px;">⚡ Backend URL</div>
      <div style="color:#8888aa;margin-bottom:8px;font-size:.72rem;">
        Paste your <strong style="color:#6366f1">ngrok WSS URL</strong> to connect to your local backend:
      </div>
      <input id="ngrokInput" type="text" value="${saved}"
        placeholder="wss://xxxx.ngrok-free.app"
        style="width:100%;padding:6px 10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:6px;
               color:#f0f0f8;font-family:inherit;font-size:.78rem;box-sizing:border-box;margin-bottom:8px;">
      <div style="display:flex;gap:8px;">
        <button onclick="
          const v=document.getElementById('ngrokInput').value.trim();
          if(v){localStorage.setItem('rhi_backend_url',v);location.reload();}
        " style="flex:1;padding:6px;background:#6366f1;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:.75rem;font-family:inherit;">
          Connect
        </button>
        <button onclick="document.getElementById('backendConfig').style.display='none'"
          style="padding:6px 10px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:6px;color:#8888aa;cursor:pointer;font-size:.75rem;font-family:inherit;">
          ✕
        </button>
      </div>
      ${saved ? `<div style="color:#22c55e;margin-top:6px;font-size:.7rem;">✓ Using: ${saved}</div>` : ''}
    `;
    document.body.appendChild(bar);
  });
}


// Tracks real analysis results for cross-feature use
window.lastAnalyzedScore = null;
window.lastNarrative = null;
window.lastRepo = null;

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
    ws.onmessage = (e) => {
      try {
        handleWSEvent(JSON.parse(e.data));
      } catch(err) {
        console.error('[WS] Handler error:', err.message, err.stack);
      }
    };
  } catch(_) { setTimeout(connectWS, 3000); }
}
connectWS();

function handleWSEvent(ev) {
  switch (ev.type) {
    case 'progress':       onProgress(ev);       break;
    case 'commits':        onCommits(ev);        break;
    case 'timeline':       onTimeline(ev);       break;
    case 'timelineEvents': onTimelineEvents(ev); break;
    case 'hotspots':       onHotspots(ev);       break;
    case 'busfactor':      onBusFactor(ev);      break;
    case 'graph':          onGraph(ev);          break;
    case 'score':          onScore(ev);          break;
    case 'narrative':      onNarrative(ev);      break;
    case 'done':           onDone(ev);           break;
    case 'error':          onError(ev);          break;
    case 'repoMeta':       onRepoMeta(ev);       break;
    case 'dependencies':   onDependencies(ev);   break;
    case 'testCoverage':   onTestCoverage(ev);   break;
    case 'authorCount':    onAuthorCount(ev);    break;
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

  // Reset bonus panels to loading state
  const busBarsEl = $('#busBars');
  if (busBarsEl) busBarsEl.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:.78rem;text-align:center;width:100%;padding:12px 0;">Analyzing...</div>`;
  const driftEl = $('#driftChart');
  if (driftEl) driftEl.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:.75rem;text-align:center;padding:24px 0;">Computing drift...</div>`;
  const driftValEl = document.querySelector('.drift-val');
  if (driftValEl) { driftValEl.textContent = '\u2014 computing...'; driftValEl.className = 'drift-val'; }
  // Reset merge sim
  const msScore = document.querySelector('.ms-score');
  const msChange = document.querySelector('.ms-change');
  const msLabel = document.querySelector('.ms-score-label');
  if (msScore) msScore.textContent = '\u2014';
  if (msChange) { msChange.textContent = ''; msChange.className = 'ms-change'; }
  if (msLabel) msLabel.textContent = 'Enter PR to predict';

  const token = ($('#githubToken') || {}).value || '';
  const geminiKey = ($('#geminiToken') || {}).value || '';
  const depth = ($('#depthSelect') || {}).value || '200';
  ws.send(JSON.stringify({ type: 'analyze', repo, token, geminiKey, depth: parseInt(depth) }));
}

/* ── WS event handlers ── */
function onProgress(ev) {
  const bar = $('#liveProgressBar'), msg = $('#liveProgressMsg');
  if (bar) bar.style.width = ev.pct + '%';
  if (msg) msg.textContent = ev.message;
  addTerminalLine(ev.message, ev.pct === 100 ? 'success' : 'dim');
}

function onCommits(ev) {
  // Update hero terminal commit count
  const el = $('#commitCount');
  if (el) animateCounter(el, ev.count, '');
  // Also update hero terminal line text
  const termLines = $$('.term-line.dim', $('#terminalBody'));
  for (const l of termLines) {
    if (l.textContent.includes('commits')) {
      const span = l.querySelector('.term-count');
      if (span) animateCounter(span, ev.count, '');
    }
  }
  window._lastCommitCount = ev.count;
}

function onTimeline(ev) {
  if (timelineChart) timelineChart.destroy();
  const ctx = $('#timelineChart');
  if (!ctx) return;

  // Count total commits across all months
  const totalCommits = (ev.commitCounts || []).reduce((a, b) => a + b, 0);
  const meta = document.querySelector('.panel-meta');
  if (meta) meta.textContent = `Past 12 months · ${totalCommits || (window._lastCommitCount || 0)} commits analyzed`;

  const health     = ev.health     && ev.health.length     ? ev.health     : [50];
  const complexity  = ev.complexity && ev.complexity.length ? ev.complexity : [50];
  const coverage    = ev.coverage   && ev.coverage.length   ? ev.coverage   : [50];
  const minY = Math.max(20, Math.min(...health, ...complexity, ...coverage) - 5);

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ev.labels,
      datasets: [
        { label: 'Health Score', data: health,     borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6 },
        { label: 'Complexity',   data: complexity, borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
        { label: 'Coverage',     data: coverage,   borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
      ],
    },
    options: {
      responsive: true, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8888aa', font: { family: 'IBM Plex Mono', size: 11 }, boxWidth: 16 } },
        tooltip: {
          backgroundColor: '#0f0f1a', borderColor: '#2a2a4a', borderWidth: 1,
          titleColor: '#f0f0f8', bodyColor: '#8888aa',
          callbacks: {
            afterBody(items) {
              const idx = items[0]?.dataIndex;
              if (ev.commitCounts && idx !== undefined) {
                return [`Commits: ${ev.commitCounts[idx] || 0}`];
              }
              return [];
            }
          }
        },
      },
      scales: {
        x: { grid: { color: 'rgba(30,30,56,0.8)' }, ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } } },
        y: { min: minY, max: 100, grid: { color: 'rgba(30,30,56,0.8)' }, ticks: { color: '#444466', font: { family: 'IBM Plex Mono', size: 11 } } },
      },
    },
  });

  // Drive architectural drift chart with real complexity trend data
  if (typeof renderDriftChart === 'function') renderDriftChart(complexity, ev.labels);
}

function onTimelineEvents(ev) {
  const container = $('#timelineEvents');
  if (!container || !ev.events || ev.events.length === 0) return;
  container.innerHTML = '';
  ev.events.forEach(e => {
    const card = document.createElement('div');
    card.className = `event-card ${e.type === 'drop' ? 'event-drop' : 'event-rise'}`;
    card.innerHTML = `
      <div class="ev-marker">${e.type === 'drop' ? '▼' : '▲'}</div>
      <div class="ev-body">
        <div class="ev-title">${e.label} — Health ${e.type === 'drop' ? 'Drop' : 'Rise'} (${e.delta > 0 ? '+' : ''}${e.delta} pts)</div>
        <div class="ev-desc">${e.desc}</div>
        <div class="ev-meta">${e.commits} commits · detected from commit velocity analysis</div>
      </div>`;
    container.appendChild(card);
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
}

function showHotspotDetail(item) {
  const existing = document.getElementById('hotspotDetailModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'hotspotDetailModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border-bright);border-radius:12px;padding:28px 32px;max-width:480px;width:90%;">
      <div style="font-family:var(--font-mono);font-size:1rem;color:var(--text-primary);margin-bottom:12px;">🔥 ${item.path}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:var(--bg-elevated);padding:10px 14px;border-radius:8px;"><div style="color:var(--text-muted);font-size:.72rem;font-family:var(--font-mono);">CHURN</div><div style="color:var(--accent);font-size:1.4rem;font-weight:700;">${item.churn}</div></div>
        <div style="background:var(--bg-elevated);padding:10px 14px;border-radius:8px;"><div style="color:var(--text-muted);font-size:.72rem;font-family:var(--font-mono);">RISK LEVEL</div><div style="color:${item.level==='high'?'var(--red)':item.level==='medium'?'var(--amber)':'var(--green)'};font-size:1.4rem;font-weight:700;">${item.risk}</div></div>
        <div style="background:var(--bg-elevated);padding:10px 14px;border-radius:8px;"><div style="color:var(--text-muted);font-size:.72rem;font-family:var(--font-mono);">AUTHORS</div><div style="color:var(--text-primary);font-size:1.4rem;font-weight:700;">${item.authorCount||'—'}</div></div>
        <div style="background:var(--bg-elevated);padding:10px 14px;border-radius:8px;"><div style="color:var(--text-muted);font-size:.72rem;font-family:var(--font-mono);">COMPLEXITY</div><div style="color:var(--text-primary);font-size:1.4rem;font-weight:700;">${item.complexity}</div></div>
      </div>
      <button onclick="document.getElementById('hotspotDetailModal').remove()" style="width:100%;padding:10px;background:var(--accent);border:none;border-radius:8px;color:#fff;font-family:var(--font-mono);font-size:.85rem;cursor:pointer;">Close</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
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
  // Store for cross-feature use
  window.lastAnalyzedScore = ev.total;

  const scoreEl = $('#healthScore'), gradeEl = $('#healthGrade'), fillEl = $('#healthFill');
  if (scoreEl) scoreEl.textContent = ev.total;
  if (gradeEl) {
    const grade = ev.total >= 80 ? 'Healthy' : ev.total >= 60 ? 'Moderate' : 'At Risk';
    gradeEl.textContent = grade;
    gradeEl.className = 'hs-grade ' + (ev.total >= 80 ? 'healthy' : ev.total >= 60 ? 'moderate' : 'at-risk');
  }
  if (fillEl) fillEl.style.width = ev.total + '%';

  // Sub-score bars
  const ss = $('#subscores');
  const depColor = ev.dep >= 70 ? '#22c55e' : ev.dep >= 50 ? '#f59e0b' : '#ef4444';
  if (ss) ss.innerHTML = [
    ['Complexity Drift', ev.complexity, ev.complexity >= 70 ? '#22c55e' : ev.complexity >= 50 ? '#f59e0b' : '#ef4444'],
    ['Test Coverage',    ev.coverage,   ev.coverage   >= 70 ? '#22c55e' : ev.coverage   >= 50 ? '#f59e0b' : '#ef4444'],
    ['Hotspot Risk',     ev.hotspot,    ev.hotspot    >= 70 ? '#22c55e' : ev.hotspot    >= 50 ? '#f59e0b' : '#ef4444'],
    ['Dependency Rot',   ev.dep,        depColor],
  ].map(([l,v,c]) => `<div class="subscore"><div class="ss-label">${l}</div><div class="ss-bar"><div class="ss-fill" style="width:${v}%;background:${c}"></div></div><div class="ss-val">${v}</div></div>`).join('');

  // Metric Breakdown formula tab
  const fwResult = document.querySelector('.fw-result');
  if (fwResult) fwResult.textContent = ev.total;
  document.querySelectorAll('.fw-row').forEach((row, i) => {
    const vals = [ev.complexity, ev.coverage, ev.hotspot, ev.dep];
    const v = row.querySelector('.fw-v');
    if (v && vals[i] !== undefined) {
      v.textContent = vals[i];
      v.className = 'fw-v ' + (vals[i] >= 70 ? 'score-green' : vals[i] >= 50 ? 'score-amber' : 'score-red');
    }
  });

  // Update hero terminal score line
  const termBody = $('#terminalBody');
  if (termBody) {
    const scoreLines = $$('.term-line.success', termBody);
    for (const l of scoreLines) {
      if (l.textContent.includes('Health Score') || l.textContent.includes('Score:')) {
        const span = l.querySelector('.score-val');
        if (span) span.textContent = ev.total;
        break;
      }
    }
  }
}

function onNarrative(ev) {
  // Store for refresh
  window.lastNarrative = ev.text;
  const llmBody = $('#llmBody');
  if (!llmBody) return;
  llmBody.style.opacity = '0';
  setTimeout(() => {
    llmBody.innerHTML = `<p class="llm-text">${ev.text}</p>`;
    llmBody.style.opacity = '1';
    llmBody.style.transition = 'opacity 0.4s';
  }, 200);
}

function onAuthorCount(ev) {
  window._lastAuthorCount = ev.count;
  // Update hero terminal author info if present
  addTerminalLine(`→ ${ev.count} unique contributor${ev.count !== 1 ? 's' : ''} detected`, 'info');
}

function onDone(ev) {
  const btn = $('.analyze-btn'), btnText = $('#analyzeBtnText');
  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = 'Analyze Repository';
  const overlay = $('#analysisOverlay');
  if (overlay) setTimeout(() => overlay.classList.remove('active'), 300);

  // Store current repo
  window.lastRepo = ev.repo;

  // Update hero terminal with real results
  const termBody = $('#terminalBody');
  if (termBody) {
    const score = window.lastAnalyzedScore || '—';
    termBody.innerHTML = `
      <div class="term-line"><span class="term-prompt">$</span> rhi analyze ${ev.repo}</div>
      <div class="term-line dim">Cloning repository...</div>
      <div class="term-line dim">Walking commit history... <span class="term-count" id="commitCount">${ev.commitCount.toLocaleString()}</span> commits</div>
      <div class="term-line dim">Building Knowledge Graph...</div>
      <div class="term-line success">✓ Health Score: <span class="score-val">${score}</span></div>
      <div class="term-line ${score >= 80 ? 'success' : score >= 60 ? 'warn' : 'dim'}">→ Status: ${score >= 80 ? 'Healthy' : score >= 60 ? 'Moderate — monitor hotspots' : 'At Risk — action needed'}</div>
      <div class="term-line success cursor-blink">✓ Analysis complete · ${ev.commitCount.toLocaleString()} commits_</div>
    `;
  }

  // Refresh recent analyses panel after MongoDB save settles
  setTimeout(loadRecentAnalyses, 1800);
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
function refreshLLM() {
  const llmBody = $('#llmBody');
  if (!llmBody) return;
  // If a real narrative exists, re-display it (fade out/in)
  if (window.lastNarrative) {
    llmBody.style.opacity = '0';
    setTimeout(() => {
      llmBody.innerHTML = `<p class="llm-text">${window.lastNarrative}</p>`;
      llmBody.style.opacity = '1';
      llmBody.style.transition = 'opacity 0.4s';
    }, 200);
  } else {
    llmBody.innerHTML = '<p class="llm-text" style="color:#444466;font-family:var(--font-mono);font-size:.85rem;">Run an analysis first to generate a narrative.<span class="cursor-blink"></span></p>';
  }
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
  if (changeEl) changeEl.textContent = '';

  setTimeout(() => {
    // Use real analyzed score as base, fallback to 70
    const base = window.lastAnalyzedScore || 70;
    const deltaVal = parseFloat((Math.random() * 5 + 0.5).toFixed(1));
    // PRs more likely to decrease health slightly
    const sign = Math.random() > 0.3 ? -1 : 1;
    const delta = sign * deltaVal;
    const newScore = Math.max(10, Math.min(99, base + delta)).toFixed(1);
    if (labelEl) labelEl.textContent = 'Predicted';
    scoreEl.textContent = newScore;
    if (changeEl) {
      changeEl.textContent = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}`;
      changeEl.className = `ms-change ${delta >= 0 ? 'positive' : 'negative'}`;
    }
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

/* ═══════════════════════════════════════════════════════════════════
   20. RECENT ANALYSES — MongoDB REST API
   ═══════════════════════════════════════════════════════════════════ */
async function loadRecentAnalyses() {
  try {
    const res = await fetch('/api/analyses?limit=8');
    if (!res.ok) return;
    const { analyses, db } = await res.json();
    if (!db || !analyses || analyses.length === 0) return;

    const panel = $('#recentAnalyses');
    const chips = $('#raChips');
    if (!panel || !chips) return;

    chips.innerHTML = '';
    analyses.forEach(a => {
      const score = a.score?.total ?? '—';
      const grade = score >= 80 ? 'healthy' : score >= 60 ? 'moderate' : 'at-risk';
      const lang  = a.repoMeta?.language || '';
      const chip  = document.createElement('button');
      chip.className = `ra-chip ra-${grade}`;
      chip.title = `Score: ${score} · ${a.commitCount} commits · ${new Date(a.analyzedAt).toLocaleDateString()}`;
      chip.innerHTML = `<span class="ra-slug">${a.slug}</span><span class="ra-score">${score}</span>${lang ? `<span class="ra-lang">${lang}</span>` : ''}`;
      chip.addEventListener('click', () => {
        const input = $('#repoInput');
        if (input) { input.value = a.slug; input.focus(); }
        document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
      });
      chips.appendChild(chip);
    });

    panel.style.display = 'flex';
  } catch (_) {
    // Silently ignore if API unavailable
  }
}

async function clearRecentAnalyses() {
  const panel = $('#recentAnalyses');
  if (panel) panel.style.display = 'none';
}

/* ── Architectural drift sparkline ─────────────────────────────── */
function renderDriftChart(complexityData, labels) {
  const el = document.getElementById('driftChart');
  if (!el || !complexityData || !complexityData.length) return;

  const data = complexityData;
  const last  = data[data.length - 1];
  const first = data[0];
  const trend = last - first;

  // Update drift value indicator
  const driftVal = document.querySelector('.drift-val');
  if (driftVal) {
    const arrow = trend > 2 ? '↗ Rising' : trend < -2 ? '↘ Falling' : '→ Stable';
    driftVal.textContent = `${arrow} (${trend > 0 ? '+' : ''}${Math.round(trend)})`;
    driftVal.className = 'drift-val' + (trend < -2 ? ' falling' : '');
  }

  // Draw sparkline SVG
  const W = el.offsetWidth || 260, H = 56;
  const min = Math.min(...data), max = Math.max(...data);
  const range = Math.max(max - min, 1);
  const pts = data.map((v, i) => [
    Math.round((i / (data.length - 1)) * W),
    Math.round(H - ((v - min) / range) * (H - 8) - 4)
  ]);
  const polyline = pts.map(p => p.join(',')).join(' ');
  const fillPts  = `0,${H} ` + polyline + ` ${W},${H}`;
  const color = trend > 2 ? '#f59e0b' : trend < -2 ? '#22c55e' : '#6366f1';

  el.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polygon points="${fillPts}" fill="${color}" opacity="0.10"/>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${color}" opacity="0.7"
        <title>${labels?.[i]||''}: ${data[i]}</title>
      />`).join('')}
    </svg>`;
}

// Load recent panel on page start
document.addEventListener('DOMContentLoaded', loadRecentAnalyses);
loadRecentAnalyses();
