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

/**
 * @typedef {object} LoginRequest
 * @property {string} username.required - Địa chỉ email hoặc tên người dùng
 * @property {string} password.required - Mật khẩu
 *
 * @typedef {object} RegisterRequest
 * @property {string} name.required - Tên đầy đủ
 * @property {string} email.required - Email
 * @property {string} password.required - Mật khẩu
 */

/**
 * POST /api/v1/auth/register
 * @summary Đăng ký tài khoản mới
 * @tags Authentication
 * @param {RegisterRequest} request.body.required - Thông tin đăng ký
 * @example request body
 * {
 *   "name": "Nguyen Van A",
 *   "email": "newuser@example.com",
 *   "password": "P@ssword123"
 * }
 * @return {object} 201 - Created
 */
router.post("/register", register);

/**
 * POST /api/v1/auth/login
 * @summary Đăng nhập người dùng
 * @tags Authentication
 * @param {LoginRequest} request.body.required - Thông tin đăng nhập
 * @example request body
 * {
 *   "username": "admin@example.com",
 *   "password": "MậtkhẩuCủaTôi"
 * }
 * @return {object} 200 - Trả về token truy cập
 * @return {object} 401 - Lỗi đăng nhập
 */
router.post("/login", login);

/**
 * GET /api/v1/auth/me
 * @summary Lấy thông tin người dùng hiện tại
 * @tags Authentication
 * @security bearerAuth
 * @return {object} 200 - Thông tin user
 */
router.get("/me", requireAuth, me);

/**
 * POST /api/v1/auth/logout
 * @summary Đăng xuất
 * @tags Authentication
 * @security bearerAuth
 * @return {object} 200 - Đã đăng xuất
 */
router.post("/logout", requireAuth, logout);

/**
 * POST /api/v1/auth/forgot-password
 * @summary Yêu cầu đặt lại mật khẩu
 * @tags Authentication
 * @param {object} request.body.required - Email để gửi link reset
 * @example request body
 * {
 *   "email": "user@example.com"
 * }
 * @return {object} 200 - Email reset đã được gửi
 */
router.post("/forgot-password", forgotPassword);

/**
 * POST /api/v1/auth/reset-password
 * @summary Đặt lại mật khẩu bằng token
 * @tags Authentication
 * @param {object} request.body.required - Token và mật khẩu mới
 * @example request body
 * {
 *   "token": "reset-token-here",
 *   "password": "NewP@ssw0rd"
 * }
 * @return {object} 200 - Mật khẩu đã được cập nhật
 */
router.post("/reset-password", resetPassword);

module.exports = router;

