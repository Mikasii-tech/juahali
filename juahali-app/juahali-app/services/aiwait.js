const QueueEntry = require('../models/QueueEntry');
const AiModel = require('../models/AiModel');
const ml = require('./mlwait');

const NAME = 'wait-time';
const SYNTH = /^[ACDR]-/;   // demo-data prefixes: anything with these numbers is synthetic

// Finished consultations, as training samples (oldest first)
async function samplesFromDb() {
  const rows = await QueueEntry.find({ status: 'Completed', consultStartAt: { $ne: null }, completedAt: { $ne: null } })
    .sort({ consultStartAt: -1 }).limit(5000).select('severityTier symptomCategory consultStartAt completedAt queueNumber').lean();
  return rows.map((r) => ({ tier: r.severityTier, category: r.symptomCategory, hour: ml.hourOf(r.consultStartAt), minutes: (new Date(r.completedAt) - new Date(r.consultStartAt)) / 60000, at: new Date(r.consultStartAt).getTime(), synthetic: SYNTH.test(r.queueNumber || '') }))
    .filter((s) => s.minutes >= 1 && s.minutes <= 120).sort((a, b) => a.at - b.at);
}

async function train() {
  const samples = await samplesFromDb();
  const metrics = ml.evaluate(samples);          // honest test on later data
  const model = ml.train(samples);               // final model learns from everything
  const synth = samples.filter((s) => s.synthetic).length;
  const prev = await AiModel.findOne({ name: NAME });
  const doc = await AiModel.findOneAndUpdate({ name: NAME }, { $set: { name: NAME, features: model.features, weights: model.weights, lambda: model.lambda, trainedAt: new Date(), nTrain: metrics.nTrain, nTest: metrics.nTest, nAll: samples.length, syntheticShare: samples.length ? synth / samples.length : 0, metrics, enabled: prev ? prev.enabled : false } }, { upsert: true, new: true });
  cache = { at: 0, val: null };
  return doc;
}

let cache = { at: 0, val: null };
async function activeModel() {                    // null unless trained AND switched on
  if (Date.now() - cache.at < 20000) return cache.val;
  const d = await AiModel.findOne({ name: NAME, enabled: true }).lean();
  cache = { at: Date.now(), val: d || null };
  return cache.val;
}
const predictMinutes = (model, e) => ml.predict(model, { tier: e.tier, category: e.category, hour: ml.hourOf(new Date()) });
const resetCache = () => { cache = { at: 0, val: null }; };

module.exports = { NAME, samplesFromDb, train, activeModel, predictMinutes, resetCache };
