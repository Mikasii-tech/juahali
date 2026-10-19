// Allowed status changes and who may make them (SRS FR-AUD-02, FR-AUD-03). Pure, so it is unit tested.
const RULES = {
  "Waiting>Called": ["receptionist"],
  "Called>In Consultation": ["doctor"],
  "Called>No-show": ["receptionist"],
  "In Consultation>Completed": ["doctor"],
};
const FIELD = {
  Called: "calledAt",
  "In Consultation": "consultStartAt",
  Completed: "completedAt",
  "No-show": "completedAt",
};
const isValidMove = (from, to) =>
  Object.prototype.hasOwnProperty.call(RULES, from + ">" + to);
const canMove = (from, to, role) =>
  isValidMove(from, to) && RULES[from + ">" + to].includes(role);
module.exports = { RULES, FIELD, isValidMove, canMove };
