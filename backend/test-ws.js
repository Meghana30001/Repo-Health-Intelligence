const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3001');
ws.on('open', () => {
  console.log('[TEST] Connected — triggering analysis of Meghana30001/Repo-Health-Intelligence');
  ws.send(JSON.stringify({
    type: 'analyze',
    repo: 'Meghana30001/Repo-Health-Intelligence',
    depth: 50,   // quick for testing
    token: '',
    geminiKey: ''
  }));
});

ws.on('message', (raw) => {
  try {
    const ev = JSON.parse(raw);
    if (ev.type === 'progress') console.log(`[${ev.pct}%] ${ev.message}`);
    if (ev.type === 'score')    console.log('[SCORE]', ev.total);
    if (ev.type === 'done')     { console.log('[DONE] Analysis complete. Closing.'); ws.close(); process.exit(0); }
    if (ev.type === 'error')    { console.error('[ERROR]', ev.message); process.exit(1); }
  } catch (_) {}
});

ws.on('error', (e) => { console.error('[WS ERROR]', e.message); process.exit(1); });

// Timeout safety
setTimeout(() => { console.log('[TIMEOUT] No done event after 60s'); process.exit(1); }, 60000);
