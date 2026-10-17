const categories = require("../config/symptoms");
const TIERS = { 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Critical" };

const bySymptom = {};
categories.forEach((c) =>
  c.symptoms.forEach((sy) => {
    bySymptom[sy.id] = { ...sy, category: c.label };
  }),
);

// What the browser may see: labels and question text only. Severity rules stay on the server.
function publicConfig() {
  return categories.map((c) => ({
    id: c.id,
    label: c.label,
    symptoms: c.symptoms.map((sy) => ({
      id: sy.id,
      label: sy.label,
      questions: sy.questions.map((x) => ({ id: x.id, text: x.text })),
    })),
  }));
}

// Same answers always give the same result (deterministic)
function compute(symptomId, answers) {
  const sy = bySymptom[symptomId];
  if (!sy) return null;
  for (const x of sy.questions) {
    if (typeof answers[x.id] !== "boolean")
      return { error: "Please answer every question." };
  }
  const redFlag = sy.questions.some((x) => x.type === "red" && answers[x.id]);
  const weight = redFlag
    ? 4
    : Math.min(
        3,
        sy.base +
          sy.questions.filter((x) => x.type === "bump" && answers[x.id]).length,
      );
  return { symptom: sy, weight, tier: TIERS[weight], redFlag };
}

module.exports = { publicConfig, compute };
