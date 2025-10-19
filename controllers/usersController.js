const bcrypt = require("bcryptjs");
const User = require("../models/User");

function sanitize(userDoc) {
  const obj = userDoc.toObject();
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
}

// GET /api/users/me
exports.getMe = async (req, res) => {
  return res.json({ user: sanitize(req.user) });
};

// PATCH /api/users/me
exports.updateMe = async (req, res, next) => {
  try {
    const ALLOWED = ["name", "phone", "avatarUrl"];
    const update = {};

    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    if (req.body.email || req.body.role || req.body.isVerified != null) {
      return res
        .status(400)
        .json({ message: "Not allowed to change email/role here" });
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updated = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
      context: "query",
    });

    return res.json({ user: sanitize(updated) });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/me/password
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "oldPassword & newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    const matched = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!matched) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
};
