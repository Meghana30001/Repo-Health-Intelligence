/* ═══════════════════════════════════════════════════════════════════
   REPO HEALTH IQ — server.js
   Express HTTP + WebSocket server
   • Serves static frontend files
   • Accepts WebSocket connections
   • Streams real-time analysis events
   ═══════════════════════════════════════════════════════════════════ */

const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { analyzeRepo } = require('./analyzer');

const PORT = 3001;
const FRONTEND_DIR = path.join(__dirname, '..');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/* ─── CORS & static files ────────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve frontend static files
app.use(express.static(FRONTEND_DIR));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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

      console.log(`[Analysis] Starting: ${repo} (depth=${depth}, auth=${!!token})`);
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

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });

  // Send welcome
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'RepoHealthIQ backend ready. Send { type: "analyze", repo: "owner/repo" } to begin.',
  }));
});

/* ─── Start server ───────────────────────────────────────────────── */
server.listen(PORT, () => {
  console.log(`\n  ╔═══════════════════════════════════════╗`);
  console.log(`  ║   RepoHealthIQ Backend — Ready        ║`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ║   WebSocket: ws://localhost:${PORT}    ║`);
  console.log(`  ╚═══════════════════════════════════════╝\n`);
});

module.exports = { app, server };
