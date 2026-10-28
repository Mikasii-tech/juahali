// Learned consultation-length predictor: ridge regression, written from scratch (no outside service).
// Pure functions, so every step is unit tested. Features: severity tier, area, time of day.
const cats = require('../config/symptoms');
const TIERS = ['Mild', 'Moderate', 'Severe', 'Critical'];
const AREAS = cats.map((c) => c.label);
const REF_AREA = AREAS.length - 1;                                    // the last area is the reference for comparison
const FEATURES = ['bias', ...TIERS.slice(1).map((t) => 'tier:' + t), ...AREAS.slice(0, REF_AREA).map((a) => 'area:' + a), 'afternoon', 'hour'];
const MIN_SAMPLES = 30, MIN_PRED = 2, MAX_PRED = 60;
const TZ = () => process.env.CLINIC_TZ || 'Africa/Nairobi';
const hourOf = (d) => Number(new Date(d).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: TZ() })) % 24;

function featurize(s) {
  const x = new Array(FEATURES.length).fill(0);
  x[0] = 1;
  const t = TIERS.indexOf(s.tier); if (t > 0) x[t] = 1;
  const a = AREAS.indexOf(s.category); if (a >= 0 && a < REF_AREA) x[1 + (TIERS.length - 1) + a] = 1;
  x[FEATURES.length - 2] = s.hour >= 13 ? 1 : 0;
  x[FEATURES.length - 1] = (s.hour - 12) / 6;
  return x;
}

// Solve A w = b by Gaussian elimination with partial pivoting
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('Singular matrix');
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function train(samples, { lambda = 1 } = {}) {
  if (samples.length < MIN_SAMPLES) throw new Error(`Not enough data: need at least ${MIN_SAMPLES} finished consultations, found ${samples.length}.`);
  const p = FEATURES.length, XtX = Array.from({ length: p }, () => new Array(p).fill(0)), Xty = new Array(p).fill(0);
  for (const s of samples) {
    const x = featurize(s);
    for (let i = 0; i < p; i++) { Xty[i] += x[i] * s.minutes; for (let j = 0; j < p; j++) XtX[i][j] += x[i] * x[j]; }
  }
  for (let i = 1; i < p; i++) XtX[i][i] += lambda;                    // ridge penalty, not on the bias
  return { features: FEATURES, weights: solve(XtX, Xty), lambda, n: samples.length };
}

const predictRaw = (model, s) => featurize(s).reduce((a, v, i) => a + v * model.weights[i], 0);
const predict = (model, s) => Math.min(MAX_PRED, Math.max(MIN_PRED, predictRaw(model, s)));   // guardrail: never absurd

// Honest test: train on the EARLIER 70%, test on the LATER 30%, and compare with the rolling-average baseline
function evaluate(samples, { split = 0.7, window = 10, lambda = 1, fallback = 10 } = {}) {
  const s = [...samples].sort((a, b) => a.at - b.at), cut = Math.floor(s.length * split);
  const model = train(s.slice(0, cut), { lambda }), test = s.slice(cut);
  let aeM = 0, aeB = 0, seM = 0, seB = 0;
  test.forEach((x, k) => {
    const prev = s.slice(Math.max(0, cut + k - window), cut + k).map((y) => y.minutes);
    const base = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : fallback;
    const m = predict(model, x);
    aeM += Math.abs(m - x.minutes); aeB += Math.abs(base - x.minutes); seM += (m - x.minutes) ** 2; seB += (base - x.minutes) ** 2;
  });
  const n = test.length, maeModel = aeM / n, maeBaseline = aeB / n;
  return { nTrain: cut, nTest: n, maeModel, maeBaseline, rmseModel: Math.sqrt(seM / n), rmseBaseline: Math.sqrt(seB / n), improvement: maeBaseline > 0 ? (maeBaseline - maeModel) / maeBaseline : 0 };
}

module.exports = { FEATURES, TIERS, AREAS, MIN_SAMPLES, featurize, train, predict, predictRaw, evaluate, hourOf };
