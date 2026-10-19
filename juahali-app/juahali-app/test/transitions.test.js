const test = require("node:test");
const assert = require("node:assert");
const { canMove, isValidMove } = require("../services/transitions");

test("receptionist can call a waiting patient and mark a called patient as no-show", () => {
  assert.ok(canMove("Waiting", "Called", "receptionist"));
  assert.ok(canMove("Called", "No-show", "receptionist"));
});
test("doctor can start and finish a consultation", () => {
  assert.ok(canMove("Called", "In Consultation", "doctor"));
  assert.ok(canMove("In Consultation", "Completed", "doctor"));
});
test("roles cannot do each other's changes, and patients and admins cannot change status", () => {
  assert.ok(!canMove("Waiting", "Called", "doctor"));
  assert.ok(!canMove("Called", "In Consultation", "receptionist"));
  assert.ok(!canMove("Waiting", "Called", "patient"));
  assert.ok(!canMove("Called", "No-show", "admin"));
});
test("invalid jumps are rejected for every role", () => {
  [
    "Waiting>Completed",
    "Waiting>No-show",
    "Waiting>In Consultation",
    "Completed>Waiting",
    "No-show>Called",
    "In Consultation>Called",
  ].forEach((k) => {
    const [a, b] = k.split(">");
    assert.ok(!isValidMove(a, b), k);
    ["receptionist", "doctor", "admin", "patient"].forEach((role) =>
      assert.ok(!canMove(a, b, role), k + " " + role),
    );
  });
});
