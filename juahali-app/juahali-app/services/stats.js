// Small date helpers for the analytics (clinic time zone, default Africa/Nairobi)
const TZ = () => process.env.CLINIC_TZ || 'Africa/Nairobi';
const ymd = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ() });
function monthKeys(n) {
  const [y, m] = ymd(new Date()).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const t = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0')); }
  return out;
}
const monthLabel = (k) => new Date(k + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
const dayKeys = (n) => Array.from({ length: n }, (_, i) => ymd(new Date(Date.now() - (n - 1 - i) * 864e5)));
const dayLabel = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const weekdayOf = (d) => new Date(ymd(d) + 'T12:00:00Z').getUTCDay();
module.exports = { ymd, monthKeys, monthLabel, dayKeys, dayLabel, weekdayOf };
