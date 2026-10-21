// Rolling average of recent consultation lengths (SRS FR-WT-01, FR-WT-02). Pure, so it is unit tested.
// rows: newest first, each { consultStartAt, completedAt }. Lengths outside 1 to 120 minutes are ignored as bad data.
function avgMinutes(rows, fallback, n = 10) {
  const mins = rows
    .map((r) => (new Date(r.completedAt) - new Date(r.consultStartAt)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 120)
    .slice(0, n);
  return mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : fallback;
}
module.exports = { avgMinutes };
