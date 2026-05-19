/* ═══════════════════════════════════════════════════════════════════
   REPO HEALTH IQ — server.js
   Express HTTP + WebSocket server
   • Connects to MongoDB on startup
   • Serves static frontend files
   • Accepts WebSocket connections for real-time analysis
   • REST API: GET /api/analyses, GET /api/analyses/:slug, DELETE /api/analyses/:slug
   ═══════════════════════════════════════════════════════════════════ */

const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { analyzeRepo } = require('./analyzer');
const { connectDB, isReady } = require('./db');
const Analysis = require('./models/Analysis');

const PORT = 3001;
const FRONTEND_DIR = path.join(__dirname, '..');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ─── CORS & JSON body parser ────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.use(express.json());

/* ─── Static frontend ────────────────────────────────────────────── */
app.use(express.static(FRONTEND_DIR));

/* ─── Health check ───────────────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), db: isReady() ? 'connected' : 'unavailable' });
});

/* ─── REST: List recent analyses ─────────────────────────────────── */
app.get('/api/analyses', async (req, res) => {
  try {
    if (!isReady()) return res.json({ analyses: [], db: false });
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const analyses = await Analysis.find({})
      .sort({ analyzedAt: -1 })
      .limit(limit)
      .select('slug analyzedAt commitCount score repoMeta depth')
      .lean();
    res.json({ analyses, db: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── REST: Get single analysis ──────────────────────────────────── */
app.get('/api/analyses/:owner/:repo', async (req, res) => {
  try {
    const slug = `${req.params.owner}/${req.params.repo}`;
    if (!isReady()) return res.status(503).json({ error: 'Database unavailable' });
    const doc = await Analysis.findOne({ slug }).sort({ analyzedAt: -1 }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── REST: Delete cached analysis ──────────────────────────────── */
app.delete('/api/analyses/:owner/:repo', async (req, res) => {
  try {
    const slug = `${req.params.owner}/${req.params.repo}`;
    if (!isReady()) return res.status(503).json({ error: 'Database unavailable' });
    await Analysis.deleteMany({ slug });
    res.json({ deleted: true, slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─── WebSocket handler ──────────────────────────────────────────── */
wss.on('connection', (ws, req) => {
  console.log(`[WS] Client connected from ${req.socket.remoteAddress}`);

  let analysisRunning = false;

  ws.on('message', async (rawMsg) => {
    let msg;
    try {
      msg = JSON.parse(rawMsg.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      return;
    }

    if (msg.type === 'analyze') {
      if (analysisRunning) {
        ws.send(JSON.stringify({ type: 'error', message: 'Analysis already running. Please wait.' }));
        return;
      }
      const repo = (msg.repo || '').trim();
      if (!repo) { ws.send(JSON.stringify({ type: 'error', message: 'No repo specified.' })); return; }

      const token = (msg.token || '').trim();
      const geminiKey = (msg.geminiKey || '').trim();
      const depth = Math.min(Math.max(parseInt(msg.depth) || 200, 50), 1000);

      console.log(`[Analysis] Starting: ${repo} (depth=${depth}, auth=${!!token}, db=${isReady()})`);
      analysisRunning = true;

      function emit(event) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event)); }

      try {
        await analyzeRepo(repo, emit, { token, depth, geminiKey });
      } catch (err) {
        console.error('[Analysis] Uncaught error:', err.message);
        emit({ type: 'error', message: `Unexpected error: ${err.message.substring(0, 150)}` });
      } finally {
        analysisRunning = false;
      }
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => { console.log('[WS] Client disconnected'); });
  ws.on('error', (err) => { console.error('[WS] Error:', err.message); });

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'RepoHealthIQ backend ready. Send { type: "analyze", repo: "owner/repo" } to begin.',
    db: isReady(),
  }));
});

/* ─── Start: Connect DB first, then listen ───────────────────────── */
(async () => {
  await connectDB();   // graceful — won't crash if Mongo is absent
  server.listen(PORT, () => {
    console.log(`\n  ╔═══════════════════════════════════════╗`);
    console.log(`  ║   RepoHealthIQ Backend — Ready        ║`);
    console.log(`  ║   http://localhost:${PORT}              ║`);
    console.log(`  ║   WebSocket: ws://localhost:${PORT}    ║`);
    console.log(`  ║   MongoDB: ${isReady() ? 'Connected ✓         ' : 'Unavailable (memory) '}║`);
    console.log(`  ╚═══════════════════════════════════════╝\n`);
  });
})();

module.exports = { app, server };
