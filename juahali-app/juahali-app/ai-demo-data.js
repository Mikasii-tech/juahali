// TESTING / DEMO ONLY: ~300 SYNTHETIC finished consultations over 30 days, so the AI has something to learn from.
// STATED ASSUMPTIONS (this is invented data, it shows the METHOD works, not real clinic accuracy):
//   base minutes by tier: Mild 7, Moderate 10, Severe 14, Critical 20
//   Injury +3, Breathing +2, Fever +1, other areas +0;  seen after 13:00: +2;  random noise about 2 minutes
//   npm run ai-demo-data           add the data
//   npm run ai-demo-data -- --clear remove it
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const QueueEntry = require("./models/QueueEntry");
const cats = require("./config/symptoms");
const { ymd } = require("./services/stats");

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const gauss = () =>
  Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) *
  Math.cos(2 * Math.PI * Math.random());
const BASE = { Mild: 7, Moderate: 10, Severe: 14, Critical: 20 },
  TIERS = ["", "Mild", "Moderate", "Severe", "Critical"];
const AREA = {
  "Injury and wounds": 3,
  "Breathing and chest": 2,
  "Fever and infection": 1,
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const removed = await QueueEntry.deleteMany({ queueNumber: /^A-/ });
  if (process.argv[2] === "--clear") {
    console.log(`Removed ${removed.deletedCount} AI demo consultations.`);
    return mongoose.disconnect();
  }
  const docs = [];
  let n = 0;
  const ghost = new mongoose.Types.ObjectId();
  for (let d = 30; d >= 1; d--) {
    for (let k = rnd(8, 12); k > 0; k--) {
      const w = Math.random() < 0.06 ? 4 : [1, 1, 1, 2, 2, 3][rnd(0, 5)],
        tier = TIERS[w],
        c = cats[rnd(0, cats.length - 1)];
      const start = new Date(Date.now() - d * 864e5);
      start.setUTCHours(rnd(5, 14), rnd(0, 59), 0, 0); // 08:00 to 17:59 local
      const hour =
        Number(
          start.toLocaleString("en-GB", {
            hour: "2-digit",
            hour12: false,
            timeZone: process.env.CLINIC_TZ || "Africa/Nairobi",
          }),
        ) % 24;
      const len = Math.min(
        45,
        Math.max(
          3,
          BASE[tier] +
            (AREA[c.label] || 0) +
            (hour >= 13 ? 2 : 0) +
            2 * gauss(),
        ),
      );
      docs.push({
        queueNumber: "A-" + String(++n).padStart(4, "0"),
        dayKey: ymd(start),
        patientId: ghost,
        symptomId: "demo",
        symptomCategory: c.label,
        symptomLabel: "Demo patient",
        answers: [],
        severityTier: tier,
        severityWeight: w,
        redFlag: w === 4,
        status: "Completed",
        inQueue: false,
        checkInAt: new Date(start - 20 * 60000),
        calledAt: new Date(start - 60000),
        consultStartAt: start,
        completedAt: new Date(start.getTime() + len * 60000),
      });
    }
  }
  await QueueEntry.insertMany(docs);
  console.log(
    `Added ${docs.length} synthetic consultations. Now train: npm run ai-train   (remove with: npm run ai-demo-data -- --clear)`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
