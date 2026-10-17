// TESTING ONLY: stands in for the receptionist and doctor until their screens exist.
// Usage: npm run simulate Q-001 called   (words: waiting, called, consult, done, noshow)
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const QueueEntry = require("./models/QueueEntry");

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
    "Usage: npm run simulate Q-001 called|consult|done|noshow|waiting",
  );
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const e = await QueueEntry.findOne({ queueNumber: num.toUpperCase() }).sort({
    createdAt: -1,
  });
  if (!e) console.log("No entry found for", num);
  else {
    e.status = map[word][0];
    e.inQueue = map[word][1];
    await e.save();
    console.log(`${e.queueNumber} is now ${e.status}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
