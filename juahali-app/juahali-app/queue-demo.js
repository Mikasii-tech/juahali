// TESTING ONLY: adds 6 synthetic waiting patients with different tiers and waits, then prints the ranking.
// Run: npm run queue-demo     (remove everything with: npm run clear-queue)
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const QueueEntry = require('./models/QueueEntry');
const { rankQueue } = require('./services/urgency');
const { dayKey } = require('./services/queue');

const tiers = ['', 'Mild', 'Moderate', 'Severe', 'Critical'];
const demo = [['T-001', 1, 0], ['T-002', 2, 5], ['T-003', 3, 15], ['T-004', 1, 45], ['T-005', 1, 65], ['T-006', 4, 2]];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await QueueEntry.deleteMany({ queueNumber: /^T-/ });
  const key = dayKey();
  await QueueEntry.insertMany(demo.map(([n, w, mins]) => ({
    queueNumber: n, dayKey: key, patientId: new mongoose.Types.ObjectId(), symptomId: 'demo', symptomCategory: 'Demo', symptomLabel: 'Demo patient',
    answers: [], severityTier: tiers[w], severityWeight: w, redFlag: w === 4, checkInAt: new Date(Date.now() - mins * 60000)
  })));
  const rows = await QueueEntry.find({ dayKey: key, inQueue: true, status: 'Waiting' }).lean();
  console.table(rankQueue(rows).map((x) => ({ rank: x.rank, number: x.queueNumber, tier: x.severityTier, waited_min: Math.round(x.minutes), score: +x.score.toFixed(2), rule: x.critical ? 'critical first' : x.promoted ? 'ceiling promoted' : 'score' })));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
