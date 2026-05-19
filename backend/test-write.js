require('dotenv').config();
const mongoose = require('mongoose');
const Analysis = require('./models/Analysis');

mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/RepoHealthIntelligence',
  { dbName: 'RepoHealthIntelligence' }
).then(async () => {

  // 1. Show what's currently in MongoDB
  const all = await Analysis.find({}).select('slug commitCount depth score analyzedAt').lean();
  console.log('=== Current docs in MongoDB (' + all.length + ') ===');
  all.forEach(d => console.log(
    '  slug:', d.slug,
    '| commits:', d.commitCount,
    '| depth:', d.depth,
    '| score:', d.score && d.score.total,
    '| saved:', d.analyzedAt
  ));

  // 2. Test live upsert with $set
  console.log('\n=== Testing live upsert ===');
  const update = {
    $set: {
      slug: 'test/write-check',
      commitCount: 500,
      depth: 500,
      score: { total: 77, complexity: 80, hotspot: 75, coverage: 60, dep: 85 },
      analyzedAt: new Date(),
    }
  };

  const saved = await Analysis.findOneAndUpdate(
    { slug: 'test/write-check' },
    update,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  console.log('Write OK  → slug:', saved.slug, '| score:', saved.score.total);

  // 3. Read it back
  const found = await Analysis.findOne({ slug: 'test/write-check' }).lean();
  console.log('Read back → slug:', found.slug, '| score:', found.score.total);

  // 4. Cleanup
  await Analysis.deleteOne({ slug: 'test/write-check' });
  console.log('Cleanup done\n');
  console.log('SUCCESS: MongoDB write/read pipeline is working correctly.');
  process.exit(0);

}).catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
