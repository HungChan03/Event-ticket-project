// models/Report.js
const mongoose = require("mongoose");

/*
  Mô tả model Report (Báo cáo)
  - Mục đích: lưu các báo cáo tổng hợp cho từng event trong một khoảng thời gian.
  - Các trường chính:
    - event: tham chiếu tới Event.
    - periodStart, periodEnd: khoảng thời gian báo cáo áp dụng.
    - totalTicketsSold, totalRevenue: chỉ số tổng quan.
    - breakdown.byTicketType: mảng chi tiết doanh thu và số vé theo loại vé.
    - generatedAt: thời điểm tạo báo cáo.
*/

const reportSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  periodStart: Date,
  periodEnd: Date,
  totalTicketsSold: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  breakdown: {
    byTicketType: [{ ticketType: String, sold: Number, revenue: Number }]
  },
  generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", reportSchema);
