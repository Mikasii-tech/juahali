const QueueEntry = require("../models/QueueEntry");

const CONSULT_MIN = Number(process.env.DEFAULT_CONSULT_MIN) || 10; // placeholder until real consultation times exist
const dayKey = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: process.env.CLINIC_TZ || "Africa/Nairobi",
  });

// Baseline first-come-first-served position. Urgency re-ranking arrives with the staff side.
async function view(e) {
  const ahead = await QueueEntry.countDocuments({
    dayKey: e.dayKey,
    inQueue: true,
    status: "Waiting",
    checkInAt: { $lt: e.checkInAt },
  });
  return {
    queueNumber: e.queueNumber,
    status: e.status,
    symptom: e.symptomLabel,
    position: ahead + 1,
    ahead,
    estWaitMin: ahead * CONSULT_MIN,
    checkInAt: e.checkInAt,
  };
}
module.exports = { CONSULT_MIN, dayKey, view };
