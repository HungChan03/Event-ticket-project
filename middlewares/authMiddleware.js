const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getTokenFromRequest = (req) => {
  if (req.cookies?.token) return req.cookies.token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

const attachUserFromToken = async (req) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.sub);

  if (!user) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  req.user = user;
};

const ensureUserLoaded = async (req) => {
  if (req.user) return;
  await attachUserFromToken(req);
};

// Require a valid token and attach the user to the request
const requireAuth = async (req, res, next) => {
  try {
    await ensureUserLoaded(req);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Ensure the authenticated user has admin role
const authenticateAdmin = async (req, res, next) => {
  try {
    await ensureUserLoaded(req);

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập vào trang admin",
      });
    }

    next();
  } catch (error) {
    return res.status(error.status || 401).json({ message: "Unauthorized" });
  }
};

// Ensure the authenticated user is an organizer or admin
const authenticateOrganizer = async (req, res, next) => {
  try {
    await ensureUserLoaded(req);

    if (!["admin", "organizer"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập",
      });
    }

    next();
  } catch (error) {
    return res.status(error.status || 401).json({ message: "Unauthorized" });
  }
};

module.exports = {
  authenticateAdmin,
  authenticateOrganizer,
  requireAuth,
};
