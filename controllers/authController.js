const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const sendToken = require("../utils/sendToken");
const sendMail = require("../utils/sendEmail");

function sanitize(userDoc) {
  const obj = userDoc.toObject();
  delete obj.passwordHash;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
}

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, avatarUrl } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, password are required" });
    }

    const existed = await User.findOne({ email });
    if (existed) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash: hashed,
      role: role || "user", // Cho phép set role từ request body
      phone,
      avatarUrl,
    });

    sendToken(res, user);
    return res.status(201).json({ user: sanitize(user) });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email & password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    sendToken(res, user);
    return res.json({ user: sanitize(user) });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Logged out" });
};

// GET /api/auth/me
exports.me = async (req, res) => {
  return res.json({ user: sanitize(req.user) });
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const user = await User.findOne({ email });
    const genericMsg = {
      message: "If that email exists, we have sent a reset link.",
    };

    if (!user) {
      return res.json(genericMsg);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const appUrl = process.env.APP_URL || "";
    const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

    await sendMail({
      to: email,
      subject: "Reset your password",
      text: `Reset your password using this link (valid for 15 minutes): ${resetLink}`,
      html: `
        <p>Hi ${user.name || ""},</p>
        <p>Click the link below to reset your password (valid for 15 minutes):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you didn't request this, just ignore this email.</p>
      `,
    });

    return res.json(genericMsg);
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, autoLogin = true } = req.body;

    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "token & newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    if (autoLogin) {
      sendToken(res, user);
      return res.json({
        message: "Password reset successfully",
        user: sanitize(user),
      });
    }

    return res.json({ message: "Password reset successfully. Please login." });
  } catch (error) {
    next(error);
  }
};
