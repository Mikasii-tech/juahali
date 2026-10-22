// Report calculations (SRS FR-REP-03, FR-REP-04). Pure functions, so they are unit tested.
const ORDER = ['Critical', 'Severe', 'Moderate', 'Mild'];
const mins = (a, b) => (new Date(b) - new Date(a)) / 60000;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Waiting time = check-in to being called, per severity tier
function waitByTier(rows) {
  return ORDER.map((tier) => {
    const w = rows.filter((r) => r.severityTier === tier && r.calledAt).map((r) => Math.max(0, mins(r.checkInAt, r.calledAt)));
    return { tier, n: w.length, avg: avg(w), median: median(w), max: w.length ? Math.max(...w) : 0 };
  });
}

// "What if the clinic had used first-come-first-served?" The SAME call moments are replayed in arrival order.
// rows must all belong to one clinic day.
function fcfsReplay(rows) {
  const served = rows.filter((r) => r.calledAt).sort((a, b) => new Date(a.checkInAt) - new Date(b.checkInAt));
  const calls = served.map((r) => new Date(r.calledAt).getTime()).sort((a, b) => a - b);
  return served.map((r, k) => {
    const arr = new Date(r.checkInAt).getTime();
    return { tier: r.severityTier, actual: Math.max(0, (new Date(r.calledAt).getTime() - arr) / 60000), fcfs: Math.max(0, (Math.max(arr, calls[k]) - arr) / 60000) };
  });
}

// rowsByDay: array of arrays. Positive "saved" means urgency ranking was faster than first-come-first-served.
function timeSaved(rowsByDay) {
  const all = rowsByDay.flatMap(fcfsReplay);
  return ORDER.map((tier) => {
    const t = all.filter((x) => x.tier === tier);
    return { tier, n: t.length, actual: avg(t.map((x) => x.actual)), fcfs: avg(t.map((x) => x.fcfs)), saved: avg(t.map((x) => x.fcfs - x.actual)) };
  });
}
module.exports = { ORDER, waitByTier, fcfsReplay, timeSaved, avg, median, mins };
