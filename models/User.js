// models/User.js
const mongoose = require("mongoose");

/*
  Mô tả model User (Người dùng)
  - Mục đích: lưu thông tin người dùng hệ thống (khách mua vé, ban tổ chức, admin).
  - Các trường chính:
    - name, email, password: thông tin đăng nhập/hiển thị cơ bản.
    - role: phân quyền (guest, user, organizer, admin).
    - phone, avatarUrl: dữ liệu hồ sơ tùy chọn.
    - isVerified: dấu hiệu đã xác thực email hay chưa.
    - resetPasswordToken, resetPasswordExpires: hỗ trợ chức năng quên mật khẩu.
  - Index trên email để tra cứu nhanh và đảm bảo unique.
*/

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    // role: xác định quyền hạn của user trong hệ thống
    role: {
      type: String,
      enum: ["guest", "user", "organizer", "admin"],
      default: "user",
    },
    phone: { type: String },
    avatarUrl: { type: String },
    // isVerified: đã xác thực email hay chưa (useful để giới hạn chức năng)
    isVerified: { type: Boolean, default: false },
    // Trường phục vụ chức năng reset password
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

// Tạo index để tra cứu email nhanh và đảm bảo uniqueness
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
