// JUAHALI urgency engine (SRS FR-QUE-01 to FR-QUE-08).
// Pure functions: no database, so every rule can be unit tested.
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const CONFIG = {
  slowRate: num(process.env.WAIT_SLOW_RATE, 0.01),   // points per minute for the first kneeMin minutes
  fastRate: num(process.env.WAIT_FAST_RATE, 0.05),   // points per minute after that
  kneeMin: num(process.env.WAIT_KNEE_MIN, 20),
  ceilingMin: num(process.env.WAIT_CEILING_MIN, 60)  // after this a non-critical patient is promoted
};

// Aging: grows slowly for the first 20 minutes, then faster (FR-QUE-03)
function waitFactor(minutes, c = CONFIG) {
  if (minutes <= 0) return 0;
  if (minutes <= c.kneeMin) return c.slowRate * minutes;
  return c.slowRate * c.kneeMin + c.fastRate * (minutes - c.kneeMin);
}
const urgencyScore = (weight, minutes, c = CONFIG) => weight + waitFactor(minutes, c);   // FR-QUE-01

// Order: 1) Critical, 2) ceiling-promoted, 3) everyone else by score. Ties: earlier check-in (FR-QUE-04 to 06, 08)
function rankQueue(entries, now = Date.now(), c = CONFIG) {
  const rows = entries.map((e) => {
    const minutes = Math.max(0, (now - new Date(e.checkInAt).getTime()) / 60000);
    const critical = e.severityWeight >= 4;
    return { ...e, minutes, score: urgencyScore(e.severityWeight, minutes, c), critical, promoted: !critical && minutes > c.ceilingMin };
  });
  const group = (r) => (r.critical ? 0 : r.promoted ? 1 : 2);
  rows.sort((a, b) => {
    if (group(a) !== group(b)) return group(a) - group(b);
    if (group(a) !== 1 && Math.abs(a.score - b.score) > 1e-9) return b.score - a.score;
    const t = new Date(a.checkInAt) - new Date(b.checkInAt);
    return t || String(a._id).localeCompare(String(b._id));
  });
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = { CONFIG, waitFactor, urgencyScore, rankQueue };
