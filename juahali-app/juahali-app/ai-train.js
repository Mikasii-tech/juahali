// Trains the wait-time model from finished consultations and prints an honest comparison. Run: npm run ai-train
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const mongoose = require("mongoose");
const aiwait = require("./services/aiwait");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const m = await aiwait.train(),
    x = m.metrics,
    f = (v) => v.toFixed(2);
  console.log(
    `Trained on ${m.nAll} consultations (${Math.round(m.syntheticShare * 100)}% synthetic). Tested on the latest ${x.nTest}.`,
  );
  console.table({
    "AI model": { "MAE (min)": f(x.maeModel), "RMSE (min)": f(x.rmseModel) },
    "Rolling average (current)": {
      "MAE (min)": f(x.maeBaseline),
      "RMSE (min)": f(x.rmseBaseline),
    },
  });
  console.log(
    `AI error is ${Math.round(x.improvement * 100)}% ${x.improvement >= 0 ? "lower" : "higher"} than the rolling average. The model is ${m.enabled ? "ON" : "OFF"} (switch it on from the admin AI page).`,
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
