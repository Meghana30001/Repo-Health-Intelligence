/* ═══════════════════════════════════════════════════════════════════
   Repo Health Intelligence — db.js
   MongoDB connection via Mongoose + dotenv
   Database: RepoHealthIntelligence
   ═══════════════════════════════════════════════════════════════════ */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/RepoHealthIntelligence';

// Mongoose connection options
const CONNECTION_OPTIONS = {
  dbName: 'RepoHealthIntelligence',          // explicit DB name
  serverSelectionTimeoutMS: 5000,             // timeout if MongoDB not reachable
  socketTimeoutMS: 45000,
  maxPoolSize: 10,                            // connection pool
};

let connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'

async function connectDB() {
  if (connectionState === 'connected') return;
  connectionState = 'connecting';

  try {
    await mongoose.connect(MONGODB_URI, CONNECTION_OPTIONS);
    connectionState = 'connected';

    const dbName = mongoose.connection.db.databaseName;
    const host   = mongoose.connection.host;
    console.log(`[MongoDB] ✓ Connected`);
    console.log(`[MongoDB]   Host     : ${host}`);
    console.log(`[MongoDB]   Database : ${dbName}`);

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      connectionState = 'disconnected';
      console.warn('[MongoDB] Disconnected from database');
    });
    mongoose.connection.on('reconnected', () => {
      connectionState = 'connected';
      console.log('[MongoDB] Reconnected to database');
    });
    mongoose.connection.on('error', (err) => {
      connectionState = 'error';
      console.error('[MongoDB] Connection error:', err.message);
    });

  } catch (err) {
    connectionState = 'error';
    console.warn('[MongoDB] ✗ Could not connect:', err.message);
    console.warn('[MongoDB]   URI used:', MONGODB_URI.replace(/:\/\/([^:]+:[^@]+)@/, '://***:***@'));
    console.warn('[MongoDB]   Falling back to in-memory cache only.');
  }
}

function isReady() {
  return mongoose.connection.readyState === 1;
}

function getStatus() {
  return {
    state:    connectionState,
    ready:    isReady(),
    dbName:   isReady() ? mongoose.connection.db?.databaseName : null,
    host:     isReady() ? mongoose.connection.host : null,
  };
}

module.exports = { connectDB, isReady, getStatus };
