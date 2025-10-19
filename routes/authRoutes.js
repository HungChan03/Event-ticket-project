const router = require("express").Router();
const {
  register,
  login,
  me,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

// Placeholder routes for auth
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);

// NEW
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;

