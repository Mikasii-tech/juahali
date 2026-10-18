// TESTING ONLY: deletes all queue entries and restarts numbering. Run: npm run clear-queue
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const QueueEntry = require("./models/QueueEntry");
const Counter = require("./models/Counter");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const a = await QueueEntry.deleteMany({ queueNumber: { $not: /^[DC]-/ } });
  await Counter.deleteMany({});
  console.log(`Cleared ${a.deletedCount} queue entries and reset numbering.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
