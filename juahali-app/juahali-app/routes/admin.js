const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const QueueEntry = require('../models/QueueEntry');
const StatusLog = require('../models/StatusLog');
const { requireRole } = require('../middleware/auth');
const { dayKeys, dayLabel } = require('../services/stats');
const { waitByTier, timeSaved, avg, mins } = require('../services/reports');

const router = express.Router();
router.use(requireRole('admin'));
const fail = (res, e) => { console.error(e); res.status(500).json({ message: 'Something went wrong. Please try again.' }); };
const tempPassword = () => crypto.randomBytes(6).toString('base64url') + '7a';
const TZ = () => process.env.CLINIC_TZ || 'Africa/Nairobi';
const hourOf = (d) => Number(new Date(d).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ() })) % 24;
const userOut = (u) => ({ id: u._id, fullName: u.fullName, email: u.email, role: u.role, isActive: u.isActive, studentId: u.studentId || '', createdAt: u.createdAt });

/* ---------- Users and staff (FR-ADM-01) ---------- */
router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 60), role = String(req.query.role || '');
    const f = {};
    if (['patient', 'receptionist', 'doctor', 'admin'].includes(role)) f.role = role;
    if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); f.$or = [{ fullName: re }, { email: re }]; }
    const [rows, counts] = await Promise.all([User.find(f).sort({ role: 1, fullName: 1 }).limit(100).lean(), User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }])]);
    res.json({ users: rows.map(userOut), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
  } catch (e) { fail(res, e); }
});

router.post('/staff', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), role = String(req.body.role || '');
    if (fullName.length < 2) return res.status(400).json({ message: 'Enter the full name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!['receptionist', 'doctor', 'admin'].includes(role)) return res.status(400).json({ message: 'Choose a staff role.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const pw = tempPassword();
    const u = await User.create({ fullName, email, role, passwordHash: await bcrypt.hash(pw, 12) });
    res.status(201).json({ user: userOut(u), tempPassword: pw });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' }); fail(res, e); }
});

router.patch('/users/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user.' });
    if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    const u = await User.findByIdAndUpdate(req.params.id, { $set: { isActive: !!req.body.isActive } }, { new: true });
    if (!u) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: userOut(u) });
  } catch (e) { fail(res, e); }
});

router.post('/users/:id/reset', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid user.' });
    const pw = tempPassword();
    const u = await User.findByIdAndUpdate(req.params.id, { $set: { passwordHash: await bcrypt.hash(pw, 12) } }, { new: true });
    if (!u) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: userOut(u), tempPassword: pw });
  } catch (e) { fail(res, e); }
});

/* ---------- Reports (FR-REP-01 to FR-REP-04) ---------- */
router.get('/reports', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7)), keys = dayKeys(days);
    const rows = await QueueEntry.find({ dayKey: { $in: keys } }).select('dayKey checkInAt calledAt consultStartAt completedAt severityTier status').lean();
    const logs = await StatusLog.find({ at: { $gte: new Date(Date.now() - days * 864e5) } }).select('changedBy changedByName changedByRole to').lean();

    const completed = rows.filter((r) => r.status === 'Completed'), noShows = rows.filter((r) => r.status === 'No-show');
    const waits = rows.filter((r) => r.calledAt).map((r) => Math.max(0, mins(r.checkInAt, r.calledAt)));
    const cons = completed.filter((r) => r.consultStartAt && r.completedAt).map((r) => mins(r.consultStartAt, r.completedAt)).filter((m) => m >= 1 && m <= 120);

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    rows.forEach((r) => { byHour[hourOf(r.checkInAt)].count++; });
    const perDay = Object.fromEntries(keys.map((k) => [k, 0])); rows.forEach((r) => { if (r.dayKey in perDay) perDay[r.dayKey]++; });

    const staff = {};
    logs.forEach((l) => {
      const s = staff[String(l.changedBy)] = staff[String(l.changedBy)] || { name: l.changedByName, role: l.changedByRole, calls: 0, noShows: 0, started: 0, completed: 0 };
      if (l.to === 'Called') s.calls++; else if (l.to === 'No-show') s.noShows++; else if (l.to === 'In Consultation') s.started++; else if (l.to === 'Completed') s.completed++;
    });

    const byDay = {}; rows.forEach((r) => { (byDay[r.dayKey] = byDay[r.dayKey] || []).push(r); });
    res.json({
      days, totals: { checkIns: rows.length, completed: completed.length, noShows: noShows.length, noShowRate: rows.length ? Math.round((100 * noShows.length) / rows.length) : 0, avgWait: Math.round(avg(waits) * 10) / 10, avgConsult: Math.round(avg(cons) * 10) / 10 },
      byHour, daily: keys.map((k) => ({ key: k, label: days <= 7 ? dayLabel(k) : k.slice(5), count: perDay[k] })),
      waitByTier: waitByTier(rows), timeSaved: timeSaved(Object.values(byDay)), staff: Object.values(staff).sort((a, b) => a.role.localeCompare(b.role))
    });
  } catch (e) { fail(res, e); }
});

module.exports = router;
