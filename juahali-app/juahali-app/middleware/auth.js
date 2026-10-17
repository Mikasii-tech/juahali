const jwt = require("jsonwebtoken");
const User = require("../models/User");

const isApi = (req) => req.originalUrl.startsWith("/api");

async function loadUser(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id).select("-passwordHash");
    return user && user.isActive ? user : null; // role is always read from the database
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const user = await loadUser(req);
  if (!user) {
    return isApi(req)
      ? res.status(401).json({ message: "Please log in." })
      : res.redirect("/login.html");
  }
  req.user = user;
  next();
}

const requireRole =
  (...roles) =>
  (req, res, next) =>
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return isApi(req)
          ? res.status(403).json({ message: "Not allowed." })
          : res.status(403).send("403: you are not allowed to open this page.");
      }
      next();
    });

module.exports = { requireAuth, requireRole };
