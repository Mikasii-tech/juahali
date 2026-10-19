const mongoose = require("mongoose");
// Audit trail: one record per status change. The app only ever adds records (FR-AUD-04, FR-AUD-05).
const schema = new mongoose.Schema({
  queueEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueEntry",
    required: true,
    immutable: true,
  },
  queueNumber: { type: String, required: true, immutable: true },
  from: { type: String, required: true, immutable: true },
  to: { type: String, required: true, immutable: true },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    immutable: true,
  },
  changedByName: { type: String, immutable: true },
  changedByRole: { type: String, immutable: true },
  at: { type: Date, default: Date.now, immutable: true, index: true },
});
module.exports = mongoose.model("StatusLog", schema);
