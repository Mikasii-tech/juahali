const QueueEntry = require("../models/QueueEntry");
const StatusLog = require("../models/StatusLog");
const { FIELD, isValidMove, canMove } = require("./transitions");
const { notify } = require("./realtime");

// The ONLY place a status changes. Checks the rule and the role, updates atomically, writes the audit record.
async function changeStatus(id, to, user) {
  const e0 = await QueueEntry.findById(id);
  if (!e0 || !e0.inQueue) return { error: "not_found" };
  if (!isValidMove(e0.status, to))
    return {
      error: "invalid",
      message: `A patient who is "${e0.status}" cannot be moved to "${to}".`,
    };
  if (!canMove(e0.status, to, user.role)) return { error: "forbidden" };

  const set = { status: to, [FIELD[to]]: new Date() };
  if (to === "Called") set.calledBy = user._id;
  if (to === "Completed" || to === "No-show") set.inQueue = false;
  // Only succeeds if nobody changed the status in the meantime
  const e = await QueueEntry.findOneAndUpdate(
    { _id: id, status: e0.status, inQueue: true },
    { $set: set },
    { new: true },
  );
  if (!e) return { error: "conflict" };

  await StatusLog.create({
    queueEntryId: e._id,
    queueNumber: e.queueNumber,
    from: e0.status,
    to,
    changedBy: user._id,
    changedByName: user.fullName,
    changedByRole: user.role,
  });
  notify();
  return { entry: e };
}
module.exports = { changeStatus };
