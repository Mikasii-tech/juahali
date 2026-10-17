const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12); // keeps login timing equal for unknown emails
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000,
};
const publicUser = (u) => ({
  id: u._id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
});

function startSession(res, user) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  res.cookie("token", token, cookieOpts);
}
function schoolEmail(email) {
  const d = (process.env.ALLOWED_EMAIL_DOMAIN || "").toLowerCase();
  if (!d) return true;
  const host = email.split("@")[1] || "";
  return host === d || host.endsWith("." + d);
}
const serverError = (res, e) => {
  console.error(e);
  res.status(500).json({ message: "Something went wrong. Please try again." });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

// Self-registration ALWAYS creates a patient. Any "role" sent by the browser is ignored.
router.post("/register", async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const studentId = String(req.body.studentId || "")
      .trim()
      .slice(0, 30);
    const password = String(req.body.password || "");
    const errors = {};
    if (fullName.length < 2) errors.fullName = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "Enter a valid email address.";
    else if (!schoolEmail(email))
      errors.email = "Please use your school email address.";
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      errors.password = "Use at least 8 characters with a letter and a number.";
    }
    if (Object.keys(errors).length)
      return res
        .status(400)
        .json({ message: "Please fix the highlighted fields.", errors });

    if (await User.findOne({ email })) {
      return res.status(409).json({
        message: "An account with this email already exists. Log in instead.",
        errors: { email: "This email is already registered." },
      });
    }
    const user = await User.create({
      fullName,
      email,
      studentId: studentId || undefined,
      passwordHash: await bcrypt.hash(password, 12),
      role: "patient",
    });
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000)
      return res.status(409).json({
        message: "An account with this email already exists. Log in instead.",
      });
    serverError(res, e);
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Enter your email and password." });
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(
      password,
      user ? user.passwordHash : DUMMY_HASH,
    );
    if (!user || !ok || !user.isActive)
      return res.status(401).json({ message: "Incorrect email or password." });
    startSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (e) {
    serverError(res, e);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieOpts.secure,
  });
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) =>
  res.json({ user: publicUser(req.user) }),
);

module.exports = router;
