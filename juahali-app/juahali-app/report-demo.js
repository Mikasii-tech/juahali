// TESTING / DEMO ONLY: creates 7 days of synthetic clinic activity (about 200 visits) so the reports have data.
// A single doctor is simulated, always picking the next patient with the urgency engine.
//   npm run report-demo            add the data (run npm run seed first)
//   npm run report-demo -- --clear remove it
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const QueueEntry = require('./models/QueueEntry');
const StatusLog = require('./models/StatusLog');
const cats = require('./config/symptoms');
const { rankQueue } = require('./services/urgency');
const { ymd } = require('./services/stats');

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const TIERS = ['', 'Mild', 'Moderate', 'Severe', 'Critical'];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const old = await QueueEntry.find({ queueNumber: /^R-/ }).select('_id').lean();
  await StatusLog.deleteMany({ queueEntryId: { $in: old.map((o) => o._id) } });
  await QueueEntry.deleteMany({ queueNumber: /^R-/ });
  if (process.argv[2] === '--clear') { console.log(`Removed ${old.length} report-demo visits.`); return mongoose.disconnect(); }

  const rec = await User.findOne({ role: 'receptionist' }), doc = await User.findOne({ role: 'doctor' });
  if (!rec || !doc) { console.log('Run npm run seed first, so a receptionist and a doctor exist.'); return mongoose.disconnect(); }
  const syms = cats.flatMap((c) => c.symptoms.map((s) => ({ ...s, category: c.label })));
  const ghost = new mongoose.Types.ObjectId();
  const entries = [], logs = []; let n = 0;

  for (let d = 7; d >= 1; d--) {
    const base = new Date(); base.setUTCDate(base.getUTCDate() - d); base.setUTCHours(5, 0, 0, 0);          // about 08:00 local
    const arrivals = Array.from({ length: rnd(24, 36) }, () => new Date(base.getTime() + Math.random() * 8 * 3600e3)).sort((a, b) => a - b);
    let pending = arrivals.map((at) => {
      const s = syms[rnd(0, syms.length - 1)], r = Math.random();
      const w = r < 0.06 ? 4 : Math.min(3, s.base + (Math.random() < 0.35 ? 1 : 0));
      return { _id: new mongoose.Types.ObjectId(), at, w, s };
    });
    let t = pending[0].at.getTime();
    while (pending.length) {
      const arrived = pending.filter((p) => p.at.getTime() <= t);
      if (!arrived.length) { t = Math.min(...pending.map((p) => p.at.getTime())); continue; }
      const top = rankQueue(arrived.map((p) => ({ _id: p._id, severityWeight: p.w, checkInAt: p.at })), t)[0];
      const p = pending.find((x) => String(x._id) === String(top._id));
      const called = new Date(t + rnd(0, 2) * 60000), start = new Date(called.getTime() + rnd(1, 3) * 60000), end = new Date(start.getTime() + rnd(7, 16) * 60000);
      const noShow = Math.random() < 0.05, done = noShow ? new Date(called.getTime() + 8 * 60000) : end;
      entries.push({ _id: p._id, queueNumber: 'R-' + String(++n).padStart(4, '0'), dayKey: ymd(p.at), patientId: ghost, symptomId: p.s.id, symptomCategory: p.s.category, symptomLabel: p.s.label,
        answers: [], severityTier: TIERS[p.w], severityWeight: p.w, redFlag: p.w === 4, status: noShow ? 'No-show' : 'Completed', inQueue: false, checkInAt: p.at, calledAt: called,
        consultStartAt: noShow ? undefined : start, completedAt: done, calledBy: rec._id });
      const L = (from, to, by, role, at) => logs.push({ queueEntryId: p._id, queueNumber: 'R-' + String(n).padStart(4, '0'), from, to, changedBy: by._id, changedByName: by.fullName, changedByRole: role, at });
      L('Waiting', 'Called', rec, 'receptionist', called);
      if (noShow) L('Called', 'No-show', rec, 'receptionist', done); else { L('Called', 'In Consultation', doc, 'doctor', start); L('In Consultation', 'Completed', doc, 'doctor', end); }
      pending = pending.filter((x) => x !== p); t = (noShow ? done : end).getTime();
    }
  }
  await QueueEntry.insertMany(entries); await StatusLog.insertMany(logs);
  console.log(`Added ${entries.length} synthetic visits over 7 days. Open the admin Reports page. Remove with: npm run report-demo -- --clear`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
