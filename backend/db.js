/* ═══════════════════════════════════════════════════════════════════
   REPO HEALTH IQ — db.js
   MongoDB connection via Mongoose
   ═══════════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/repohealth';

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,  // fail fast if Mongo not available
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected → ${MONGO_URI.replace(/:\/\/.*@/, '://***@')}`);
  } catch (err) {
    console.warn(`[MongoDB] Could not connect: ${err.message}`);
    console.warn('[MongoDB] Falling back to in-memory cache only.');
  }
}

function isReady() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, isReady };
