// models/Ticket.js
const mongoose = require("mongoose");

/*
  Mô tả model Ticket (Vé)
  - Mục đích: đại diện cho mỗi vé được phát hành/đã bán cho sự kiện.
  - Các trường chính:
    - event: tham chiếu tới Event (bắt buộc).
    - order: tham chiếu tới Order (nếu vé được bán theo đơn hàng).
    - owner: người sở hữu vé (User) — có thể là null nếu chưa gán.
    - ticketType: tên loại vé (trùng với ticketTypes trong Event).
    - seat: thông tin chỗ ngồi (nếu áp dụng).
    - pricePaid: số tiền thực tế khách đã trả cho vé.
    - qrCode: chuỗi QR code duy nhất dùng để check-in — index để tra cứu nhanh.
    - status: trạng thái vé (valid, used, cancelled, refunded).
    - purchasedAt: thời gian mua vé.
*/

const ticketSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ticketType: { type: String },
    seat: { type: String },
    pricePaid: { type: Number, min: 0 },
    qrCode: { type: String, unique: true, sparse: true },
    // URL ảnh QR được lưu trên Cloudinary (tùy chọn)
    qrImageUrl: { type: String },
    status: {
      type: String,
      enum: ["valid", "used", "cancelled", "refunded"],
      default: "valid",
    },
    purchasedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "" }
);

// Index giúp tra cứu vé theo qrCode nhanh hơn
ticketSchema.index({ qrCode: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
