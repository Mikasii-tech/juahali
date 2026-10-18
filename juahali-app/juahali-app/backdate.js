// TESTING ONLY: pretends a patient checked in earlier, so you can watch aging and the ceiling work.
// Run: npm run backdate Q-001 45     (Q-001 checked in 45 minutes ago)
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const QueueEntry = require('./models/QueueEntry');

const [num, mins] = process.argv.slice(2);
if (!num || !(Number(mins) >= 0)) { console.log('Usage: npm run backdate Q-001 45'); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const e = await QueueEntry.findOne({ queueNumber: num.toUpperCase(), inQueue: true }).sort({ createdAt: -1 });
  if (!e) console.log('No active entry found for', num);
  else { e.checkInAt = new Date(Date.now() - Number(mins) * 60000); await e.save(); console.log(`${e.queueNumber} now checked in ${mins} minutes ago`); }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
