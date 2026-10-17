require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { requireRole } = require("./middleware/auth");

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

// Role-protected pages (all four use one placeholder dashboard for now)
const dash = (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
app.get("/patient", requireRole("patient"), (req, res) =>
  res.sendFile(path.join(__dirname, "public", "patient.html")),
);
app.get("/reception", requireRole("receptionist"), dash);
app.get("/doctor", requireRole("doctor"), dash);
app.get("/admin", requireRole("admin"), dash);
app.get("/patient/check-in", requireRole("patient"), (req, res) =>
  res.redirect("/patient#/checkin"),
);

const PORT = process.env.PORT || 3000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() =>
    app.listen(PORT, () =>
      console.log(`JUAHALI running on http://localhost:${PORT}`),
    ),
  )
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
