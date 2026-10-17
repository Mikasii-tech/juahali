// TESTING / DEMO ONLY: fills the analytics with synthetic history so the charts look alive.
//   npm run demo-data you@school.ac.ke     add demo history for that patient
//   npm run demo-data -- --clear           remove all demo entries (D- and C- numbers)
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const QueueEntry = require('./models/QueueEntry');
const cats = require('./config/symptoms');
const { ymd } = require('./services/stats');

const arg = process.argv[2];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const removed = await QueueEntry.deleteMany({ queueNumber: /^[DC]-/ });
  if (arg === '--clear') { console.log(`Removed ${removed.deletedCount} demo entries.`); return mongoose.disconnect(); }
  const user = await User.findOne({ email: String(arg || '').toLowerCase(), role: 'patient' });
  if (!user) { console.log('Usage: npm run demo-data you@school.ac.ke   (the patient must already be registered)'); return mongoose.disconnect(); }

  const syms = cats.flatMap((c) => c.symptoms.map((s) => ({ ...s, category: c.label })));
  const ghost = new mongoose.Types.ObjectId(); // stands in for "other patients" so the clinic chart has data
  const docs = []; let n = 0;
  const make = (pid, daysAgo, prefix) => {
    const s = syms[rnd(0, syms.length - 1)];
    const d = new Date(Date.now() - daysAgo * 864e5); d.setUTCHours(rnd(6, 14), rnd(0, 59));
    const w = Math.min(3, s.base);
    docs.push({ queueNumber: prefix + '-' + String(++n).padStart(4, '0'), dayKey: ymd(d), patientId: pid, symptomId: s.id,
      symptomCategory: s.category, symptomLabel: s.label, answers: [], severityTier: ['', 'Mild', 'Moderate', 'Severe'][w], severityWeight: w,
      status: Math.random() < 0.9 ? 'Completed' : 'No-show', inQueue: false, checkInAt: d });
  };
  for (let i = 0; i < 40; i++) make(user._id, Math.floor(Math.pow(Math.random(), 1.6) * 330) + 1, 'D');
  for (let day = 0; day < 7; day++) for (let k = rnd(8, 26); k > 0; k--) make(ghost, day, 'C');
  await QueueEntry.insertMany(docs, { ordered: false });
  console.log(`Added ${docs.length} demo entries (${user.email}). Remove them with: npm run demo-data -- --clear`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
