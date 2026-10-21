require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { requireRole } = require("./middleware/auth");
const realtime = require("./services/realtime");

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/checkin", require("./routes/checkin"));
app.use("/api/patient", require("./routes/patient"));
app.use("/api/reception", require("./routes/reception"));
app.use("/api/doctor", require("./routes/doctor"));

const page = (file) => (req, res) =>
  res.sendFile(path.join(__dirname, "public", file));
app.get("/patient", requireRole("patient"), page("patient.html"));
app.get("/patient/check-in", requireRole("patient"), (req, res) =>
  res.redirect("/patient#/checkin"),
);
app.get("/reception", requireRole("receptionist"), page("reception.html"));
app.get("/doctor", requireRole("doctor"), page("doctor.html")); // real doctor dashboard arrives in a later part
app.get("/admin", requireRole("admin"), page("dashboard.html")); // real admin dashboard arrives in a later part

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    const server = http.createServer(app);
    realtime.init(server);
    server.listen(PORT, () =>
      console.log(`JUAHALI running on http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
