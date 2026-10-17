// Creates one admin, receptionist and doctor. Run once: npm run seed
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const staff = [
  { fullName: "Clinic Admin", email: "admin@juahali.local", role: "admin" },
  {
    fullName: "Front Desk",
    email: "reception@juahali.local",
    role: "receptionist",
  },
  { fullName: "Dr. Demo", email: "doctor@juahali.local", role: "doctor" },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const s of staff) {
    if (await User.findOne({ email: s.email })) {
      console.log(`${s.email} already exists, skipped`);
      continue;
    }
    const pw = crypto.randomBytes(6).toString("base64url") + "7a";
    await User.create({ ...s, passwordHash: await bcrypt.hash(pw, 12) });
    console.log(`${s.role.padEnd(13)} ${s.email}   password: ${pw}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
