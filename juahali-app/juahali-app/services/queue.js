const QueueEntry = require('../models/QueueEntry');
const { rankQueue } = require('./urgency');

const CONSULT_MIN = Number(process.env.DEFAULT_CONSULT_MIN) || 10; // placeholder until real consultation times exist
const dayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.CLINIC_TZ || 'Africa/Nairobi' });

// Position now comes from the urgency engine (Critical, then ceiling-promoted, then urgency score)
async function view(e) {
  let ahead = 0, boosted = false;
  if (e.status === 'Waiting') {
    const waiting = await QueueEntry.find({ dayKey: e.dayKey, inQueue: true, status: 'Waiting' }).select('severityWeight checkInAt').lean();
    const ranked = rankQueue(waiting);
    const i = ranked.findIndex((r) => String(r._id) === String(e._id));
    if (i >= 0) { ahead = i; boosted = ranked[i].promoted; }
  }
  return { queueNumber: e.queueNumber, status: e.status, symptom: e.symptomLabel, position: ahead + 1, ahead, boosted, estWaitMin: ahead * CONSULT_MIN, checkInAt: e.checkInAt };
}
module.exports = { CONSULT_MIN, dayKey, view };
