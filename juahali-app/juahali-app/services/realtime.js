// Live push with Socket.io. Only an empty "something changed" nudge is sent, never patient data;
// each browser then re-reads what it is allowed to see through the normal secured API.
const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let io = null;
function init(httpServer) {
  io = new Server(httpServer);
  io.use(async (socket, next) => {
    try {
      const c = cookie.parse(socket.request.headers.cookie || "");
      const { id } = jwt.verify(c.token, process.env.JWT_SECRET);
      const u = await User.findById(id).select("role isActive");
      if (!u || !u.isActive) return next(new Error("unauthorized"));
      socket.data.role = u.role;
      next();
    } catch (e) {
      next(new Error("unauthorized"));
    }
  });
}
const notify = () => {
  if (io) io.emit("queue:changed");
};
module.exports = { init, notify };
