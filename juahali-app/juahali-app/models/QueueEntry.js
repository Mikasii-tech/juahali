const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    queueNumber: { type: String, required: true },
    dayKey: { type: String, required: true, index: true },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    symptomId: String,
    symptomCategory: String,
    symptomLabel: String,
    answers: [{ _id: false, questionId: String, answer: Boolean }],
    severityTier: {
      type: String,
      enum: ["Mild", "Moderate", "Severe", "Critical"],
      required: true,
    },
    severityWeight: { type: Number, required: true },
    redFlag: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Waiting", "Called", "In Consultation", "Completed", "No-show"],
      default: "Waiting",
    },
    inQueue: { type: Boolean, default: true }, // becomes false when Completed or No-show (later part)
    checkInAt: { type: Date, default: Date.now },
    pharmacyChoice: {
      type: String,
      enum: ["none", "joined_after_suggestion"],
      default: "none",
    },
  },
  { timestamps: true },
);

// A patient can have only ONE active entry, even if two requests arrive at the same moment
schema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { inQueue: true } },
);
schema.index({ dayKey: 1, queueNumber: 1 }, { unique: true });

module.exports = mongoose.model("QueueEntry", schema);
