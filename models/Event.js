// models/Event.js
const mongoose = require("mongoose");

/*
  Mô tả model Event (Sự kiện)
  - Mục đích: lưu thông tin sự kiện do ban tổ chức tạo.
  - Các trường chính:
    - title, description, posterUrl: thông tin hiển thị cho sự kiện.
    - venue: cấu trúc địa điểm (tên, địa chỉ, thành phố, quốc gia).
    - startDate, endDate: thời gian diễn ra.
    - capacity: tổng số vé tối đa cho sự kiện (tùy chọn).
    - categories: nhóm/loại sự kiện (vd: music, tech).
    - ticketTypes: mảng các loại vé (name, price, quantity, sold).
    - status: trạng thái duyệt (draft/pending/approved/rejected/cancelled).
    - organizer: tham chiếu tới User (ban tổ chức) — required.
  - Ghi chú: ticketTypes dùng để quản lý giá và số lượng theo từng loại vé; sold có thể được cập nhật khi bán vé.
*/

const ticketTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  sold: { type: Number, default: 0, min: 0 }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String },
  posterUrl: { type: String },
  venue: {
    name: String,
    address: String,
    city: String,
    country: String
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  capacity: { type: Number, default: 0 },
  categories: [String],
  ticketTypes: { type: [ticketTypeSchema], default: [] },
  status: { type: String, enum: ["draft", "pending", "approved", "rejected", "cancelled"], default: "pending" },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

// Helper to compute remaining tickets per type could be added as virtuals in future

module.exports = mongoose.model("Event", eventSchema);
