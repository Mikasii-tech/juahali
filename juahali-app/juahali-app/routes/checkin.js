const express = require("express");
const QueueEntry = require("../models/QueueEntry");
const Counter = require("../models/Counter");
const { requireRole } = require("../middleware/auth");
const { publicConfig, compute } = require("../services/triage");
const { notify } = require("../services/realtime");

const router = express.Router();
router.use(requireRole("patient"));

const { dayKey, view } = require("../services/queue");
const fail = (res, e) => {
  console.error(e);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};

router.get("/symptoms", (req, res) => res.json({ categories: publicConfig() }));

router.get("/active", async (req, res) => {
  try {
    const e = await QueueEntry.findOne({
      patientId: req.user._id,
      inQueue: true,
    });
    res.json({ entry: e ? await view(e) : null });
  } catch (err) {
    fail(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    if (await QueueEntry.findOne({ patientId: req.user._id, inQueue: true })) {
      return res
        .status(409)
        .json({ message: "You already have an active check-in." });
    }
    const answers =
      req.body.answers && typeof req.body.answers === "object"
        ? req.body.answers
        : {};
    const r = compute(String(req.body.symptomId || ""), answers);
    if (!r)
      return res.status(400).json({ message: "Please choose a symptom." });
    if (r.error) return res.status(400).json({ message: r.error });

    // Mild with no red flag: offer the pharmacy first (a suggestion only, never a block)
    if (r.tier === "Mild" && !r.redFlag && req.body.confirmMild !== true)
      return res.json({ needsDecision: "pharmacy" });

    const key = dayKey();
    const c = await Counter.findOneAndUpdate(
      { _id: "q-" + key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const entry = await QueueEntry.create({
      queueNumber: "Q-" + String(c.seq).padStart(3, "0"),
      dayKey: key,
      patientId: req.user._id,
      symptomId: r.symptom.id,
      symptomCategory: r.symptom.category,
      symptomLabel: r.symptom.label,
      answers: r.symptom.questions.map((x) => ({
        questionId: x.id,
        answer: answers[x.id],
      })),
      severityTier: r.tier,
      severityWeight: r.weight,
      redFlag: r.redFlag,
      pharmacyChoice: r.tier === "Mild" ? "joined_after_suggestion" : "none",
    });
    notify();
    res.status(201).json({ entry: await view(entry) });
  } catch (e) {
    if (e.code === 11000)
      return res
        .status(409)
        .json({ message: "You already have an active check-in." });
    fail(res, e);
  }
});

module.exports = router;
