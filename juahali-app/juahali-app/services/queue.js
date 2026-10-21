const QueueEntry = require('../models/QueueEntry');
const { rankQueue } = require('./urgency');
const { avgMinutes } = require('./waittime');

const CONSULT_MIN = Number(process.env.DEFAULT_CONSULT_MIN) || 10; // used only until real consultations exist
const dayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.CLINIC_TZ || 'Africa/Nairobi' });

// Rolling average of the last 10 real consultations, read from the audit timestamps (cached for 30 seconds)
let cache = { at: 0, val: CONSULT_MIN };
async function consultMin() {
  if (Date.now() - cache.at < 30000) return cache.val;
  const rows = await QueueEntry.find({ status: 'Completed', consultStartAt: { $ne: null }, completedAt: { $ne: null } })
    .sort({ completedAt: -1 }).limit(30).select('consultStartAt completedAt').lean();
  cache = { at: Date.now(), val: avgMinutes(rows, CONSULT_MIN, 10) };
  return cache.val;
}

// Position comes from the urgency engine; the wait estimate uses the real rolling average
async function view(e) {
  let ahead = 0, boosted = false, queueSize = 1;
  const per = await consultMin();
  if (e.status === 'Waiting') {
    const waiting = await QueueEntry.find({ dayKey: e.dayKey, inQueue: true, status: 'Waiting' }).select('severityWeight checkInAt').lean();
    const ranked = rankQueue(waiting);
    const i = ranked.findIndex((r) => String(r._id) === String(e._id));
    queueSize = ranked.length;
    if (i >= 0) { ahead = i; boosted = ranked[i].promoted; }
  }
  return { queueNumber: e.queueNumber, status: e.status, symptom: e.symptomLabel, position: ahead + 1, ahead, boosted, queueSize, estWaitMin: Math.round(ahead * per), avgConsultMin: Math.round(per), checkInAt: e.checkInAt };
}
module.exports = { CONSULT_MIN, dayKey, view, consultMin };
