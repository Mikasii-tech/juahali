const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const QueueEntry = require("../models/QueueEntry");
const StatusLog = require("../models/StatusLog");
const { requireRole } = require("../middleware/auth");
const { dayKey } = require("../services/queue");
const { rankQueue } = require("../services/urgency");
const { changeStatus } = require("../services/status");

const router = express.Router();
router.use(requireRole("receptionist"));
const fail = (res, e) => {
  console.error(e);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};
const MSG = {
  not_found: "That patient is no longer in the queue.",
  forbidden: "You are not allowed to do that.",
  conflict:
    "Someone else just updated this patient. The list has been refreshed.",
};
const send = (res, r) => {
  if (r.entry) return res.json({ ok: true, queueNumber: r.entry.queueNumber });
  res
    .status(
      { not_found: 404, invalid: 409, forbidden: 403, conflict: 409 }[
        r.error
      ] || 400,
    )
    .json({ message: r.message || MSG[r.error] });
};

// The live queue. Receptionists see name, tier, area, wait and LAST VISIT DATE only: never answers, history or notes (FR-REC-04).
router.get("/queue", async (req, res) => {
  try {
    const key = dayKey();
    const rows = await QueueEntry.find({ dayKey: key, inQueue: true }).lean();
    const ids = [...new Set(rows.map((r) => String(r.patientId)))].map(
      (i) => new mongoose.Types.ObjectId(i),
    );
    const [users, lasts, seen, noShows] = await Promise.all([
      User.find({ _id: { $in: ids } })
        .select("fullName")
        .lean(),
      QueueEntry.aggregate([
        { $match: { patientId: { $in: ids }, inQueue: false } },
        { $group: { _id: "$patientId", last: { $max: "$checkInAt" } } },
      ]),
      QueueEntry.countDocuments({ dayKey: key, status: "Completed" }),
      QueueEntry.countDocuments({ dayKey: key, status: "No-show" }),
    ]);
    const name = Object.fromEntries(
      users.map((u) => [String(u._id), u.fullName]),
    );
    const last = Object.fromEntries(lasts.map((l) => [String(l._id), l.last]));
    const who = (r) => name[String(r.patientId)] || "Demo patient";

    const ranked = rankQueue(rows.filter((r) => r.status === "Waiting"));
    const waiting = ranked.map((r) => ({
      id: r._id,
      rank: r.rank,
      queueNumber: r.queueNumber,
      name: who(r),
      tier: r.severityTier,
      area: r.symptomCategory,
      minutes: Math.round(r.minutes),
      score: +r.score.toFixed(2),
      rule: r.critical ? "critical" : r.promoted ? "ceiling" : "score",
      lastVisit: last[String(r.patientId)] || null,
    }));
    const serving = rows
      .filter((r) => r.status === "Called" || r.status === "In Consultation")
      .map((r) => ({
        id: r._id,
        queueNumber: r.queueNumber,
        name: who(r),
        status: r.status,
        tier: r.severityTier,
        minutes: Math.round(
          (Date.now() -
            new Date(r.consultStartAt || r.calledAt || r.checkInAt)) /
            60000,
        ),
      }));
    res.json({
      waiting,
      serving,
      stats: {
        waiting: waiting.length,
        seenToday: seen,
        noShows,
        longestWait: waiting.reduce((m, w) => Math.max(m, w.minutes), 0),
      },
    });
  } catch (e) {
    fail(res, e);
  }
});

// Call the top-ranked patient, or a specific one
router.post("/call", async (req, res) => {
  try {
    let id = req.body.id;
    if (!id) {
      const rows = await QueueEntry.find({
        dayKey: dayKey(),
        inQueue: true,
        status: "Waiting",
      })
        .select("severityWeight checkInAt")
        .lean();
      const top = rankQueue(rows)[0];
      if (!top)
        return res.status(404).json({ message: "No patients are waiting." });
      id = top._id;
    }
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid patient." });
    send(res, await changeStatus(id, "Called", req.user));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/noshow", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.body.id))
      return res.status(400).json({ message: "Invalid patient." });
    send(res, await changeStatus(req.body.id, "No-show", req.user));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/log", async (req, res) => {
  try {
    const rows = await StatusLog.find().sort({ at: -1 }).limit(100).lean();
    res.json({
      log: rows.map((l) => ({
        at: l.at,
        queueNumber: l.queueNumber,
        from: l.from,
        to: l.to,
        by: l.changedByName,
        role: l.changedByRole,
      })),
    });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;
