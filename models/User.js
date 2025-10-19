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
    // Custom ID based on role
    customId: { type: String, unique: true, sparse: true },
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

// Function để generate custom ID theo role
userSchema.statics.generateCustomId = async function (role) {
  const prefixes = {
    admin: "ADMIN",
    organizer: "ORG",
    user: "USER",
    guest: "GUEST",
  };

  const prefix = prefixes[role] || "USER";

  // Tìm user cuối cùng có cùng role
  const lastUser = await this.findOne({
    customId: { $regex: `^${prefix}` },
  }).sort({ customId: -1 });

  let nextNumber = 1;
  if (lastUser && lastUser.customId) {
    const lastNumber = parseInt(lastUser.customId.replace(prefix, ""));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(3, "0")}`;
};

// Middleware để tự động tạo customId trước khi save
userSchema.pre("save", async function (next) {
  if (!this.customId && this.role) {
    try {
      this.customId = await this.constructor.generateCustomId(this.role);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Tạo index để tra cứu email nhanh và đảm bảo uniqueness
userSchema.index({ email: 1 });
userSchema.index({ customId: 1 });

module.exports = mongoose.model("User", userSchema);
