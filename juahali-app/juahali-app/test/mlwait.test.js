const test = require("node:test");
const assert = require("node:assert");
const ml = require("../services/mlwait");
const cats = require("../config/symptoms");

let seed = 42;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const gauss = () =>
  Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const pick = (a) => a[Math.floor(rnd() * a.length)];
const BASE = { Mild: 7, Moderate: 10, Severe: 14, Critical: 20 };
const T0 = Date.parse("2026-09-01T00:00:00Z");

function make(n, signal) {
  return Array.from({ length: n }, (_, i) => {
    const tier = pick(ml.TIERS),
      category = pick(cats).label,
      hour = 8 + Math.floor(rnd() * 10);
    const minutes = signal
      ? Math.max(3, BASE[tier] + (hour >= 13 ? 2 : 0) + 2 * gauss())
      : Math.max(3, 10 + 2 * gauss());
    return { tier, category, hour, minutes, at: T0 + i * 3600e3 };
  });
}

test("refuses to train on too little data", () =>
  assert.throws(() => ml.train(make(29, true)), /Not enough data/));

test("recovers a known relationship (Severe adds 4 minutes, afternoon adds 2)", () => {
  const s = [];
  for (const tier of ml.TIERS)
    for (let h = 8; h < 18; h++)
      for (let k = 0; k < 3; k++)
        s.push({
          tier,
          category: cats[5].label,
          hour: h,
          minutes: 6 + (tier === "Severe" ? 4 : 0) + (h >= 13 ? 2 : 0),
          at: 0,
        });
  const m = ml.train(s, { lambda: 1e-6 }),
    w = (name) => m.weights[m.features.indexOf(name)];
  assert.ok(Math.abs(w("tier:Severe") - 4) < 0.3, "severe " + w("tier:Severe"));
  assert.ok(Math.abs(w("afternoon") - 2) < 0.8, "afternoon " + w("afternoon"));
});

test("predictions are always kept between 2 and 60 minutes", () => {
  const m = {
    features: ml.FEATURES,
    weights: ml.FEATURES.map(() => 1000),
    lambda: 0,
    n: 1,
  };
  assert.strictEqual(
    ml.predict(m, { tier: "Critical", category: cats[0].label, hour: 17 }),
    60,
  );
  assert.strictEqual(
    ml.predict(
      { ...m, weights: m.weights.map(() => -1000) },
      { tier: "Mild", category: cats[0].label, hour: 8 },
    ),
    2,
  );
});

test("when consultation length really depends on the tier, the model beats the rolling average clearly", () => {
  const r = ml.evaluate(make(300, true));
  assert.ok(r.improvement > 0.2, "improvement " + r.improvement);
  assert.ok(r.maeModel < r.maeBaseline);
});

test("when length is pure noise, the model does NOT claim a big improvement (no cheating)", () => {
  const r = ml.evaluate(make(300, false));
  assert.ok(r.improvement < 0.15, "improvement " + r.improvement);
});

test("evaluation uses a time-ordered split with no overlap", () => {
  const r = ml.evaluate(make(100, true));
  assert.strictEqual(r.nTrain + r.nTest, 100);
  assert.strictEqual(r.nTrain, 70);
});
