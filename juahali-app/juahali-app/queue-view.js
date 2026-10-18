// TESTING ONLY: prints today's waiting queue in the order the engine ranks it. Run: npm run queue-view
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const QueueEntry = require('./models/QueueEntry');
const { rankQueue } = require('./services/urgency');
const { dayKey } = require('./services/queue');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await QueueEntry.find({ dayKey: dayKey(), inQueue: true, status: 'Waiting' }).lean();
  console.table(rankQueue(rows).map((x) => ({ rank: x.rank, number: x.queueNumber, tier: x.severityTier, waited_min: Math.round(x.minutes), score: +x.score.toFixed(2), rule: x.critical ? 'critical first' : x.promoted ? 'ceiling promoted' : 'score' })));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
