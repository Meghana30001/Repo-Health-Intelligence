/* WebSocket client — appended into app.js */
const WS_URL = 'ws://localhost:3001';
let ws = null;
let wsReady = false;

function connectWS() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => { wsReady = true; };
  ws.onclose = () => { wsReady = false; setTimeout(connectWS, 3000); };
  ws.onerror = () => { wsReady = false; };
  ws.onmessage = (e) => handleWSEvent(JSON.parse(e.data));
}
connectWS();

function handleWSEvent(ev) {
  switch (ev.type) {
    case 'progress': onProgress(ev); break;
    case 'commits':  onCommits(ev); break;
    case 'timeline': onTimeline(ev); break;
    case 'hotspots': onHotspots(ev); break;
    case 'busfactor': onBusFactor(ev); break;
    case 'graph':    onGraph(ev); break;
    case 'score':    onScore(ev); break;
    case 'narrative': onNarrative(ev); break;
    case 'done':     onDone(ev); break;
    case 'error':    onError(ev); break;
  }
}

/* Progress bar */
function onProgress(ev) {
  const bar = document.getElementById('liveProgressBar');
  const msg = document.getElementById('liveProgressMsg');
  if (bar) bar.style.width = ev.pct + '%';
  if (msg) msg.textContent = ev.message;
  addTerminalLine(ev.message, ev.pct === 100 ? 'success' : 'dim');
}

/* Commit count → hero terminal */
function onCommits(ev) {
  const el = document.getElementById('commitCount');
  if (el) animateCounter(el, ev.count, '');
}

/* Timeline chart with real data */
function onTimeline(ev) {
  if (timelineChart) timelineChart.destroy();
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;
  const meta = document.querySelector('.panel-meta');
  if (meta) meta.textContent = `Past 12 months · ${(ev.health||[]).length} data points`;
  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ev.labels,
      datasets: [
        { label: 'Health Score', data: ev.health, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6 },
        { label: 'Complexity',   data: ev.complexity, borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
        { label: 'Coverage',     data: ev.coverage,   borderColor: '#22c55e', backgroundColor: 'transparent', borderWidth: 1.5, tension: 0.4, borderDash: [4,4], pointRadius: 2 },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
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

/* Hotspot grid with real files */
function onHotspots(ev) {
  const grid = document.getElementById('hotspotGrid');
  if (!grid) return;
  grid.innerHTML = '';
  ev.files.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = `hotspot-item ${item.level}`;
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `<div class="hs-path">${item.path}</div><div class="hs-risk">${item.risk}</div><div class="hs-detail">Churn: ${item.churn} · ${item.complexity}</div>`;
    el.addEventListener('click', () => showHotspotDetail(item));
    grid.appendChild(el);
  });
  hotspotRendered = true;
}

/* Bus factor bars */
function onBusFactor(ev) {
  const container = document.getElementById('busBars');
  if (!container) return;
  container.innerHTML = '';
  const busAlert = document.querySelector('.bus-alert span:last-child');
  const riskCount = ev.modules.filter(m => m.risk).length;
  if (busAlert) busAlert.textContent = `${riskCount} module${riskCount !== 1 ? 's' : ''} have bus factor = 1`;
  ev.modules.forEach(m => {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;font-family:IBM Plex Mono,monospace;';
    const val = document.createElement('div');
    val.style.cssText = `font-size:.75rem;font-weight:600;color:${m.risk ? '#ef4444' : '#22c55e'};`;
    val.textContent = m.factor;
    const rect = document.createElement('div');
    const h = Math.max(m.factor * 12, 12);
    rect.style.cssText = `width:28px;height:${Math.min(h,60)}px;border-radius:4px 4px 2px 2px;background:${m.risk ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.3)'};border:1px solid ${m.risk ? '#ef4444' : '#22c55e'};`;
    const label = document.createElement('div');
    label.style.cssText = 'font-size:.65rem;color:#444466;max-width:36px;text-align:center;word-break:break-all;overflow:hidden;';
    label.textContent = m.name.replace('/', '');
    bar.appendChild(val); bar.appendChild(rect); bar.appendChild(label);
    container.appendChild(bar);
  });
}

/* Knowledge graph with real dirs */
function onGraph(ev) {
  const svg = document.getElementById('knowledgeGraph');
  if (!svg) return;
  const W = svg.getBoundingClientRect().width || 800;
  const H = 400;
  svg.innerHTML = '';
  const typeColors = { repo: '#6366f1', module: '#22d3ee', file: '#f59e0b' };
  const scaleX = W / 800, scaleY = H / 400;
  ev.edges.forEach(([a, b]) => {
    const na = ev.nodes.find(n => n.id === a);
    const nb = ev.nodes.find(n => n.id === b);
    if (!na || !nb) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', na.x * scaleX); line.setAttribute('y1', na.y * scaleY);
    line.setAttribute('x2', nb.x * scaleX); line.setAttribute('y2', nb.y * scaleY);
    line.setAttribute('stroke', 'rgba(99,102,241,0.25)'); line.setAttribute('stroke-width', '1.5');
    svg.appendChild(line);
  });
  ev.nodes.forEach(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = 'pointer';
    const r = n.type === 'repo' ? 18 : n.type === 'module' ? 12 : 8;
    const color = typeColors[n.type] || '#6366f1';
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', n.x * scaleX); circle.setAttribute('cy', n.y * scaleY);
    circle.setAttribute('r', r); circle.setAttribute('fill', color + '33');
    circle.setAttribute('stroke', color); circle.setAttribute('stroke-width', '1.5');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', n.x * scaleX); text.setAttribute('y', n.y * scaleY + r + 13);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', n.type === 'repo' ? '10' : '9');
    text.setAttribute('fill', n.type === 'repo' ? '#f0f0f8' : '#8888aa');
    text.setAttribute('font-family', 'IBM Plex Mono, monospace');
    text.textContent = n.label;
    g.addEventListener('mouseenter', () => { circle.setAttribute('fill', color + '55'); circle.setAttribute('r', r + 3); });
    g.addEventListener('mouseleave', () => { circle.setAttribute('fill', color + '33'); circle.setAttribute('r', r); });
    g.appendChild(circle); g.appendChild(text); svg.appendChild(g);
  });
  graphRendered = true;
}

/* Health score card */
function onScore(ev) {
  const scoreEl = document.getElementById('healthScore');
  const gradeEl = document.getElementById('healthGrade');
  const fillEl  = document.getElementById('healthFill');
  if (scoreEl) scoreEl.textContent = ev.total;
  if (gradeEl) {
    const grade = ev.total >= 80 ? 'Healthy' : ev.total >= 60 ? 'Moderate' : 'At Risk';
    gradeEl.textContent = grade;
    gradeEl.className = 'hs-grade ' + (ev.total >= 80 ? 'healthy' : ev.total >= 60 ? 'moderate' : 'at-risk');
  }
  if (fillEl) fillEl.style.width = ev.total + '%';

  // Sub-scores
  const ss = document.getElementById('subscores');
  if (ss) {
    ss.innerHTML = `
      <div class="subscore"><div class="ss-label">Complexity Drift</div><div class="ss-bar"><div class="ss-fill" style="width:${ev.complexity}%;background:#f59e0b"></div></div><div class="ss-val">${ev.complexity}</div></div>
      <div class="subscore"><div class="ss-label">Test Coverage</div><div class="ss-bar"><div class="ss-fill" style="width:${ev.coverage}%;background:#22c55e"></div></div><div class="ss-val">${ev.coverage}</div></div>
      <div class="subscore"><div class="ss-label">Hotspot Risk</div><div class="ss-bar"><div class="ss-fill" style="width:${ev.hotspot}%;background:#ef4444"></div></div><div class="ss-val">${ev.hotspot}</div></div>
      <div class="subscore"><div class="ss-label">Dependency Rot</div><div class="ss-bar"><div class="ss-fill" style="width:${ev.dep}%;background:#22c55e"></div></div><div class="ss-val">${ev.dep}</div></div>
    `;
  }

  // Metric breakdown formula
  const fwRows = document.querySelectorAll('.fw-row');
  const vals = [ev.complexity, ev.coverage, ev.hotspot, ev.dep];
  fwRows.forEach((row, i) => {
    const v = row.querySelector('.fw-v');
    if (v && vals[i] !== undefined) {
      v.textContent = vals[i];
      v.className = 'fw-v ' + (vals[i] >= 70 ? 'score-green' : vals[i] >= 50 ? 'score-amber' : 'score-red');
    }
  });
  const fwResult = document.querySelector('.fw-result');
  if (fwResult) fwResult.textContent = ev.total;
}

/* LLM narrative */
function onNarrative(ev) {
  const llmBody = document.getElementById('llmBody');
  if (llmBody) {
    llmBody.style.opacity = '0';
    setTimeout(() => {
      llmBody.innerHTML = `<p class="llm-text">${ev.text}</p>`;
      llmBody.style.opacity = '1';
      llmBody.style.transition = 'opacity 0.4s';
    }, 200);
  }
}

/* Done */
function onDone(ev) {
  const btn = document.querySelector('.analyze-btn');
  const btnText = document.getElementById('analyzeBtnText');
  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = 'Analyze Repository';
  const overlay = document.getElementById('analysisOverlay');
  if (overlay) setTimeout(() => overlay.classList.remove('active'), 1200);
  addTerminalLine(`✓ ${ev.repo} analyzed — ${ev.commitCount} commits`, 'success');
}

/* Error */
function onError(ev) {
  const btn = document.querySelector('.analyze-btn');
  const btnText = document.getElementById('analyzeBtnText');
  if (btn) btn.classList.remove('loading');
  if (btnText) btnText.textContent = 'Analyze Repository';
  const overlay = document.getElementById('analysisOverlay');
  if (overlay) overlay.classList.remove('active');
  const llmBody = document.getElementById('llmBody');
  if (llmBody) llmBody.innerHTML = `<p class="llm-text" style="color:#ef4444"><strong>Error:</strong> ${ev.message}</p>`;
  addTerminalLine('✗ ' + ev.message, 'error');
}

/* Add line to hero terminal */
function addTerminalLine(text, cls = 'dim') {
  const body = document.getElementById('terminalBody');
  if (!body) return;
  const line = document.createElement('div');
  line.className = `term-line ${cls}`;
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
  // Keep only last 12 lines
  while (body.children.length > 12) body.removeChild(body.firstChild);
}
