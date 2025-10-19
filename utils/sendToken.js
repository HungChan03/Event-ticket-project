const jwt = require("jsonwebtoken");

function sendToken(res, user) {
  const {
    JWT_SECRET,
    JWT_EXPIRES = "7d",
    COOKIE_SECURE = "false",
  } = process.env;
  const payload = { sub: user._id, role: user.role, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  // Set HTTP-only cookie
  res.cookie("token", token, {
    httpOnly: true,
    secure: COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

module.exports = sendToken;
