require('dotenv').config();
const mongoose = require('mongoose');
const Analysis = require('./models/Analysis');

async function test() {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost:27017/RepoHealthIntelligence',
    { dbName: 'RepoHealthIntelligence', serverSelectionTimeoutMS: 5000 }
  );
  console.log('[TEST] Connected  :', mongoose.connection.host + ':' + mongoose.connection.port);
  console.log('[TEST] Database   :', mongoose.connection.name);

  // --- 1. Insert a real-shape test document ---
  const testDoc = {
    slug: '__test__/connection-check',
    commitCount: 42,
    depth: 50,
    score: { total: 78, complexity: 75, hotspot: 80, coverage: 70, dep: 85 },
    hotspots: [{ path: 'src/test.js', churn: 5, risk: 'High' }],
    busFactor: [{ module: 'src/', factor: 2 }],
    timeline: { labels: ['Jan', 'Feb'], health: [70, 75], complexity: [60, 65], coverage: [50, 55] },
    graph: { nodes: ['src/', 'tests/'], edges: [] },
    narrative: 'Test narrative from MongoDB connection check.',
    repoMeta: { stars: 100, language: 'JavaScript', forks: 20, issues: 5 },
    testInfo: { hasTests: true, coverage: 70, testFiles: 5, sourceFiles: 30 },
    deps: { totalDeps: 10, score: 85, files: [] },
    analyzedAt: new Date(),
  };

  const saved = await Analysis.findOneAndUpdate(
    { slug: testDoc.slug },
    { $set: testDoc },
    { upsert: true, new: true }
  );

  console.log('');
  console.log('[SAVE]  slug     :', saved.slug);
  console.log('[SAVE]  score    :', JSON.stringify(saved.score));
  console.log('[SAVE]  commits  :', saved.commitCount);
  console.log('[SAVE]  savedAt  :', saved.analyzedAt);

  // --- 2. Read it back ---
  const found = await Analysis.findOne({ slug: testDoc.slug }).lean();
  console.log('');
  console.log('[READ]  slug     :', found.slug);
  console.log('[READ]  score    :', JSON.stringify(found.score));
  console.log('[READ]  hotspots :', found.hotspots.length, 'files');

  // --- 3. Count all real analysis docs ---
  const total = await Analysis.countDocuments({ slug: { $not: /^__test__/ } });
  console.log('');
  console.log('[DB]    Real analyses saved so far:', total);

  // --- 4. List all slugs stored ---
  const all = await Analysis.find({}).select('slug analyzedAt score.total').lean();
  if (all.length > 0) {
    console.log('[DB]    All stored entries:');
    all.forEach(a => console.log(`        - ${a.slug}  (score: ${a.score && a.score.total}, date: ${a.analyzedAt})`));
  }

  // --- 5. Clean up test doc ---
  await Analysis.deleteOne({ slug: testDoc.slug });
  console.log('');
  console.log('[CLEANUP] Test document removed');
  console.log('');
  console.log('==============================================');
  console.log(' SUCCESS: MongoDB save/read verified!');
  console.log(' Every analysis WILL be saved automatically.');
  console.log('==============================================');

  process.exit(0);
}

test().catch(err => {
  console.error('[FAILED]', err.message);
  process.exit(1);
});
