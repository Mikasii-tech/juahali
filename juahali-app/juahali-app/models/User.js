const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    studentId: { type: String, trim: true, maxlength: 30 },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["patient", "receptionist", "doctor", "admin"],
      default: "patient",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
