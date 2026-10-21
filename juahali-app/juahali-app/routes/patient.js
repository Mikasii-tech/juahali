const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const QueueEntry = require("../models/QueueEntry");
const { requireRole } = require("../middleware/auth");
const { view, dayKey, consultMin } = require("../services/queue");
const {
  ymd,
  monthKeys,
  monthLabel,
  dayKeys,
  dayLabel,
  weekdayOf,
} = require("../services/stats");

const router = express.Router();
router.use(requireRole("patient"));
const fail = (res, e) => {
  console.error(e);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};
const pwLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait 15 minutes." },
});
const userOut = (u) => ({
  fullName: u.fullName,
  email: u.email,
  studentId: u.studentId || "",
  since: u.createdAt,
});

router.get("/summary", async (req, res) => {
  try {
    const [active, visits, last] = await Promise.all([
      QueueEntry.findOne({ patientId: req.user._id, inQueue: true }),
      QueueEntry.countDocuments({
        patientId: req.user._id,
        status: "Completed",
      }),
      QueueEntry.findOne({ patientId: req.user._id, inQueue: false }).sort({
        checkInAt: -1,
      }),
    ]);
    res.json({
      user: userOut(req.user),
      entry: active ? await view(active) : null,
      visits,
      lastVisit: last ? last.checkInAt : null,
    });
  } catch (e) {
    fail(res, e);
  }
});

// Own visits only. Consultation notes are never included.
router.get("/history", async (req, res) => {
  try {
    const rows = await QueueEntry.find({
      patientId: req.user._id,
      inQueue: false,
    })
      .sort({ checkInAt: -1 })
      .limit(200);
    res.json({
      visits: rows.map((r) => ({
        queueNumber: r.queueNumber,
        date: r.checkInAt,
        category: r.symptomCategory,
        symptom: r.symptomLabel,
        outcome: r.status,
      })),
    });
  } catch (e) {
    fail(res, e);
  }
});

// Analytics: the patient's own history, plus anonymous clinic-wide counts (no names, no details)
router.get("/insights", async (req, res) => {
  try {
    const today = dayKey(),
      days = dayKeys(7),
      months = monthKeys(12);
    const [mine, waiting, inCons, doneToday, act] = await Promise.all([
      QueueEntry.find({ patientId: req.user._id, inQueue: false })
        .select("checkInAt symptomCategory status")
        .lean(),
      QueueEntry.countDocuments({
        dayKey: today,
        inQueue: true,
        status: "Waiting",
      }),
      QueueEntry.countDocuments({
        dayKey: today,
        inQueue: true,
        status: "In Consultation",
      }),
      QueueEntry.countDocuments({ dayKey: today, status: "Completed" }),
      QueueEntry.aggregate([
        { $match: { dayKey: { $in: days } } },
        { $group: { _id: "$dayKey", count: { $sum: 1 } } },
      ]),
    ]);
    const mc = Object.fromEntries(months.map((k) => [k, 0]));
    const cat = {},
      wd = [0, 0, 0, 0, 0, 0, 0];
    let completed = 0,
      noShow = 0;
    for (const e of mine) {
      const k = ymd(e.checkInAt).slice(0, 7);
      if (k in mc) mc[k]++;
      cat[e.symptomCategory] = (cat[e.symptomCategory] || 0) + 1;
      wd[weekdayOf(e.checkInAt)]++;
      if (e.status === "Completed") completed++;
      else if (e.status === "No-show") noShow++;
    }
    const am = Object.fromEntries(act.map((a) => [a._id, a.count]));
    res.json({
      total: mine.length,
      outcomes: { completed, noShow },
      monthly: months.map((k) => ({ label: monthLabel(k), count: mc[k] })),
      categories: Object.entries(cat)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      weekday: wd,
      clinic: {
        waiting,
        inConsultation: inCons,
        completedToday: doneToday,
        estWaitNewMin: Math.round(waiting * (await consultMin())),
        activity7d: days.map((k) => ({
          label: dayLabel(k),
          count: am[k] || 0,
        })),
      },
    });
  } catch (e) {
    fail(res, e);
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const studentId = String(req.body.studentId || "")
      .trim()
      .slice(0, 30);
    if (fullName.length < 2 || fullName.length > 100)
      return res.status(400).json({ message: "Enter your full name." });
    const u = await User.findById(req.user._id);
    u.fullName = fullName;
    u.studentId = studentId || undefined;
    await u.save();
    res.json({ user: userOut(u) });
  } catch (e) {
    fail(res, e);
  }
});

router.post("/password", pwLimiter, async (req, res) => {
  try {
    const cur = String(req.body.currentPassword || ""),
      next = String(req.body.newPassword || "");
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
      return res.status(400).json({
        message: "Use at least 8 characters with a letter and a number.",
      });
    const u = await User.findById(req.user._id);
    if (!(await bcrypt.compare(cur, u.passwordHash)))
      return res
        .status(400)
        .json({ message: "Your current password is incorrect." });
    u.passwordHash = await bcrypt.hash(next, 12);
    await u.save();
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;
