const mongoose = require("mongoose");
// One document per clinic day, used to hand out Q-001, Q-002, ... safely
module.exports = mongoose.model(
  "Counter",
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }),
);
