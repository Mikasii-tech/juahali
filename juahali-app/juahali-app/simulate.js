// TESTING ONLY: stands in for the DOCTOR until the doctor dashboard exists (the receptionist now has real buttons).
// Usage: npm run simulate Q-001 consult|done|called|noshow|waiting
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const QueueEntry = require("./models/QueueEntry");
const StatusLog = require("./models/StatusLog");
const User = require("./models/User");
const { FIELD } = require("./services/transitions");

const map = {
  waiting: ["Waiting", true],
  called: ["Called", true],
  consult: ["In Consultation", true],
  done: ["Completed", false],
  noshow: ["No-show", false],
};
const [num, word] = process.argv.slice(2);
if (!num || !map[word]) {
  console.log(
    "Usage: npm run simulate Q-001 consult|done|called|noshow|waiting",
  );
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const e = await QueueEntry.findOne({ queueNumber: num.toUpperCase() }).sort({
    createdAt: -1,
  });
  if (!e) {
    console.log("No entry found for", num);
    return mongoose.disconnect();
  }
  const from = e.status,
    to = map[word][0];
  e.status = to;
  e.inQueue = map[word][1];
  if (FIELD[to]) e[FIELD[to]] = new Date();
  await e.save();
  const doc = await User.findOne({ role: "doctor" });
  if (doc)
    await StatusLog.create({
      queueEntryId: e._id,
      queueNumber: e.queueNumber,
      from,
      to,
      changedBy: doc._id,
      changedByName: doc.fullName + " (simulated)",
      changedByRole: "doctor",
    });
  console.log(
    `${e.queueNumber}: ${from} -> ${to}. The screens update on their next refresh.`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
