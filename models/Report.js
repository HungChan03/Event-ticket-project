// models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  totalTicketsSold: Number,
  totalRevenue: Number,
  reportDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Report", reportSchema);
