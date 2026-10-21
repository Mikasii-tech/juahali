// TESTING ONLY: adds 10 finished consultations of 8 to 14 minutes today, so the rolling-average wait estimate has data.
// Run: npm run consult-demo      (remove with: npm run demo-data -- --clear)
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const QueueEntry = require('./models/QueueEntry');
const { dayKey } = require('./services/queue');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await QueueEntry.deleteMany({ queueNumber: /^C-9/ });
  const key = dayKey(), docs = [];
  for (let i = 0; i < 10; i++) {
    const len = 8 + Math.floor(Math.random() * 7), done = new Date(Date.now() - (i + 1) * 20 * 60000), start = new Date(done - len * 60000);
    docs.push({ queueNumber: 'C-9' + String(i).padStart(3, '0'), dayKey: key, patientId: new mongoose.Types.ObjectId(), symptomId: 'demo', symptomCategory: 'Demo', symptomLabel: 'Demo patient',
      answers: [], severityTier: 'Moderate', severityWeight: 2, status: 'Completed', inQueue: false, checkInAt: new Date(start - 15 * 60000), calledAt: new Date(start - 60000), consultStartAt: start, completedAt: done });
  }
  await QueueEntry.insertMany(docs);
  console.log('Added 10 finished consultations. Wait estimates now use their average.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
