const mongoose = require('mongoose');
// Stores a trained model (its numbers) and whether the admin has switched it on.
module.exports = mongoose.model('AiModel', new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  features: [String], weights: [Number], lambda: Number,
  trainedAt: Date, nTrain: Number, nTest: Number, nAll: Number, syntheticShare: Number,
  metrics: mongoose.Schema.Types.Mixed
}, { timestamps: true }));
