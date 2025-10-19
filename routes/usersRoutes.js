const router = require("express").Router();
const { requireAuth } = require("../middlewares/authMiddleware");
const {
  getMe,
  updateMe,
  changePassword,
} = require("../controllers/usersController");

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.patch("/me/password", requireAuth, changePassword);

module.exports = router;
