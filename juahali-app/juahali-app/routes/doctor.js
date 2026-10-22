const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const QueueEntry = require('../models/QueueEntry');
const Consultation = require('../models/Consultation');
const cats = require('../config/symptoms');
const { requireRole } = require('../middleware/auth');
const { dayKey, consultMin } = require('../services/queue');
const { rankQueue } = require('../services/urgency');
const { changeStatus } = require('../services/status');

const router = express.Router();
router.use(requireRole('doctor'));
const fail = (res, e) => { console.error(e); res.status(500).json({ message: 'Something went wrong. Please try again.' }); };
const MSG = { not_found: 'That patient is no longer in the queue.', forbidden: 'You are not allowed to do that.', conflict: 'Someone else just updated this patient. The screen has been refreshed.' };
const send = (res, r) => r.entry ? res.json({ ok: true, queueNumber: r.entry.queueNumber })
  : res.status({ not_found: 404, invalid: 409, forbidden: 403, conflict: 409 }[r.error] || 400).json({ message: r.message || MSG[r.error] });
const QTEXT = {}; cats.forEach((c) => c.symptoms.forEach((s) => s.questions.forEach((q) => { QTEXT[q.id] = q.text; })));
const mins = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);

// Everything the doctor may see about the current patient, including full history and earlier notes
async function detail(e) {
  const [p, past, note] = await Promise.all([
    User.findById(e.patientId).select('fullName studentId').lean(),
    QueueEntry.find({ patientId: e.patientId, inQueue: false, _id: { $ne: e._id } }).sort({ checkInAt: -1 }).limit(30).lean(),
    Consultation.findOne({ queueEntryId: e._id }).lean()
  ]);
  const notes = await Consultation.find({ queueEntryId: { $in: past.map((x) => x._id) } }).lean();
  const nmap = Object.fromEntries(notes.map((n) => [String(n.queueEntryId), n]));
  return {
    id: e._id, queueNumber: e.queueNumber, status: e.status, name: p ? p.fullName : 'Demo patient', studentId: p ? p.studentId || '' : '',
    tier: e.severityTier, redFlag: e.redFlag, symptom: e.symptomLabel, area: e.symptomCategory, waited: mins(e.checkInAt, e.calledAt || new Date()),
    consultStartAt: e.consultStartAt || null, notes: note ? note.notes : '', advice: note ? note.advice || '' : '',
    answers: (e.answers || []).map((a) => ({ q: QTEXT[a.questionId] || a.questionId, a: a.answer })),
    history: past.map((x) => ({ date: x.checkInAt, symptom: x.symptomLabel, area: x.symptomCategory, tier: x.severityTier, outcome: x.status, notes: (nmap[String(x._id)] || {}).notes || '', advice: (nmap[String(x._id)] || {}).advice || '' }))
  };
}

router.get('/queue', async (req, res) => {
  try {
    const key = dayKey();
    const rows = await QueueEntry.find({ dayKey: key, inQueue: true }).lean();
    const inCons = rows.filter((r) => r.status === 'In Consultation').sort((a, b) => new Date(a.consultStartAt) - new Date(b.consultStartAt))[0];
    const called = rows.filter((r) => r.status === 'Called').sort((a, b) => new Date(a.calledAt) - new Date(b.calledAt));
    const active = inCons || called[0];
    const ranked = rankQueue(rows.filter((r) => r.status === 'Waiting'));
    const ids = ranked.slice(0, 5).map((r) => r.patientId);
    const [users, seen, avg] = await Promise.all([User.find({ _id: { $in: ids } }).select('fullName').lean(), QueueEntry.countDocuments({ dayKey: key, status: 'Completed' }), consultMin()]);
    const name = Object.fromEntries(users.map((u) => [String(u._id), u.fullName]));
    res.json({
      current: active ? await detail(active) : null, calledWaiting: called.length - (inCons ? 0 : 1),
      next: ranked.slice(0, 5).map((r) => ({ rank: r.rank, queueNumber: r.queueNumber, name: name[String(r.patientId)] || 'Demo patient', tier: r.severityTier, area: r.symptomCategory, minutes: Math.round(r.minutes) })),
      stats: { waiting: ranked.length, seenToday: seen, avgConsult: Math.round(avg), longestWait: ranked.reduce((m, r) => Math.max(m, Math.round(r.minutes)), 0) }
    });
  } catch (e) { fail(res, e); }
});

router.post('/start', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.id)) return res.status(400).json({ message: 'Invalid patient.' });
    send(res, await changeStatus(req.body.id, 'In Consultation', req.user));
  } catch (e) { fail(res, e); }
});

async function saveNotes(entry, doctor, notes, advice) {
  const set = { doctorId: doctor._id, patientId: entry.patientId };
  if (typeof notes === 'string') set.notes = notes.slice(0, 4000);
  if (typeof advice === 'string') set.advice = advice.slice(0, 2000);
  return Consultation.findOneAndUpdate({ queueEntryId: entry._id }, { $set: set }, { upsert: true, new: true });
}

router.put('/notes', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.id)) return res.status(400).json({ message: 'Invalid patient.' });
    const e = await QueueEntry.findOne({ _id: req.body.id, inQueue: true, status: 'In Consultation' });
    if (!e) return res.status(409).json({ message: 'This consultation is not open.' });
    await saveNotes(e, req.user, req.body.notes, req.body.advice);
    res.json({ ok: true, savedAt: new Date() });
  } catch (e) { fail(res, e); }
});

router.post('/complete', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.id)) return res.status(400).json({ message: 'Invalid patient.' });
    const e = await QueueEntry.findOne({ _id: req.body.id, inQueue: true, status: 'In Consultation' });
    if (!e) return res.status(409).json({ message: 'This consultation is not open.' });
    await saveNotes(e, req.user, req.body.notes, req.body.advice);
    send(res, await changeStatus(e._id, 'Completed', req.user));
  } catch (e) { fail(res, e); }
});

// Today's finished visits. Notes are not included here.
router.get('/today', async (req, res) => {
  try {
    const rows = await QueueEntry.find({ dayKey: dayKey(), status: { $in: ['Completed', 'No-show'] } }).sort({ completedAt: -1 }).limit(100).lean();
    const users = await User.find({ _id: { $in: rows.map((r) => r.patientId) } }).select('fullName').lean();
    const name = Object.fromEntries(users.map((u) => [String(u._id), u.fullName]));
    res.json({ rows: rows.map((r) => ({ queueNumber: r.queueNumber, name: name[String(r.patientId)] || 'Demo patient', tier: r.severityTier, area: r.symptomCategory, outcome: r.status, at: r.completedAt, minutes: r.consultStartAt && r.completedAt ? mins(r.consultStartAt, r.completedAt) : null })) });
  } catch (e) { fail(res, e); }
});

module.exports = router;
