/* ═══════════════════════════════════════════════════════════════════
   REPO HEALTH IQ — models/Analysis.js
   Mongoose schema for persisted analysis results
   ═══════════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  total:      { type: Number, default: 0 },
  complexity: { type: Number, default: 0 },
  hotspot:    { type: Number, default: 0 },
  coverage:   { type: Number, default: 0 },
  dep:        { type: Number, default: 0 },
}, { _id: false });

const RepoMetaSchema = new mongoose.Schema({
  stars:         Number,
  forks:         Number,
  issues:        Number,
  language:      String,
  description:   String,
  defaultBranch: String,
  size:          Number,
  private:       Boolean,
}, { _id: false });

const AnalysisSchema = new mongoose.Schema({
  slug:        { type: String, required: true, index: true },
  analyzedAt:  { type: Date,   default: Date.now, index: true },
  commitCount: { type: Number, default: 0 },
  depth:       { type: Number, default: 200 },

  score:     ScoreSchema,
  repoMeta:  RepoMetaSchema,

  // Stored as plain JSON (flexible schema)
  hotspots:  { type: mongoose.Schema.Types.Mixed, default: [] },
  busFactor: { type: mongoose.Schema.Types.Mixed, default: [] },
  timeline:  { type: mongoose.Schema.Types.Mixed, default: {} },
  graph:     { type: mongoose.Schema.Types.Mixed, default: {} },
  testInfo:  { type: mongoose.Schema.Types.Mixed, default: {} },
  deps:      { type: mongoose.Schema.Types.Mixed, default: {} },
  narrative: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'analyses',
});

// Only one record per slug — upsert on re-analysis
AnalysisSchema.index({ slug: 1, analyzedAt: -1 });

module.exports = mongoose.model('Analysis', AnalysisSchema);
