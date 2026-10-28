const express = require('express');
const AiModel = require('../models/AiModel');
const { requireRole } = require('../middleware/auth');
const aiwait = require('../services/aiwait');
const { MIN_SAMPLES } = require('../services/mlwait');

const router = express.Router();
router.use(requireRole('admin'));
const fail = (res, e) => { console.error(e); res.status(500).json({ message: 'Something went wrong. Please try again.' }); };

router.get('/wait', async (req, res) => {
  try {
    const [m, samples] = await Promise.all([AiModel.findOne({ name: aiwait.NAME }).lean(), aiwait.samplesFromDb()]);
    res.json({ available: samples.length, synthetic: samples.filter((s) => s.synthetic).length, min: MIN_SAMPLES,
      model: m ? { enabled: m.enabled, trainedAt: m.trainedAt, nTrain: m.nTrain, nTest: m.nTest, nAll: m.nAll, syntheticShare: m.syntheticShare, metrics: m.metrics, coefficients: m.features.map((f, i) => ({ name: f, weight: m.weights[i] })) } : null });
  } catch (e) { fail(res, e); }
});

router.post('/wait/train', async (req, res) => {
  try { await aiwait.train(); res.json({ ok: true }); }
  catch (e) { if (/Not enough data/.test(e.message)) return res.status(400).json({ message: e.message }); fail(res, e); }
});

router.post('/wait/enable', async (req, res) => {
  try {
    const m = await AiModel.findOneAndUpdate({ name: aiwait.NAME }, { $set: { enabled: !!req.body.enabled } }, { new: true });
    if (!m) return res.status(400).json({ message: 'Train the model first.' });
    aiwait.resetCache(); res.json({ ok: true, enabled: m.enabled });
  } catch (e) { fail(res, e); }
});
module.exports = router;
