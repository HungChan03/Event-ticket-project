// models/Order.js
const mongoose = require("mongoose");

/*
  Mô tả model Order (Đơn hàng)
  - Mục đích: lưu thông tin giao dịch khi người dùng mua vé.
  - Các trường chính:
    - buyer: tham chiếu tới User (người đặt mua) — required.
    - event: tham chiếu tới Event mà vé thuộc về — required.
    - items: danh sách loại vé và số lượng, giá tại thời điểm mua.
    - ticketRefs: danh sách Ticket đã tạo (ObjectId) sau khi thanh toán thành công.
    - subtotal, fees, total: tóm tắt số tiền của đơn hàng.
    - payment: chi tiết thanh toán (method, providerData, paidAt, status).
    - status: trạng thái vòng đời đơn (created, processing, completed, cancelled).
    - buyerInfo: snapshot thông tin người mua để tránh phụ thuộc vào thay đổi hồ sơ User.
*/

const orderItemSchema = new mongoose.Schema({
  ticketType: String,
  price: { type: Number, min: 0 },
  quantity: { type: Number, min: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  items: { type: [orderItemSchema], default: [] },
  ticketRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],
  subtotal: { type: Number, min: 0, default: 0 },
  fees: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  payment: {
    method: { type: String, enum: ["momo", "vnpay", "paypal", "card", "mock"], default: "mock" },
    providerData: {},
    paidAt: Date,
    status: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" }
  },
  status: { type: String, enum: ["created", "processing", "completed", "cancelled"], default: "created" },
  buyerInfo: {
    name: String,
    email: String,
    phone: String
  },
  // expiresAt: thời điểm hết hạn thanh toán (không dùng TTL để xoá tự động)
  expiresAt: { type: Date },
  // emailSentAt: thời điểm đã gửi email biên nhận thành công
  emailSentAt: { type: Date }
}, { timestamps: true });

// Index tối ưu truy vấn theo buyer và event
orderSchema.index({ buyer: 1, event: 1 });

module.exports = mongoose.model("Order", orderSchema);
