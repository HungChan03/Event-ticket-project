// models/Ticket.js
const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ticketType: String,
  qrCode: String,
  status: { type: String, enum: ["valid", "used", "canceled"], default: "valid" },
  purchasedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Ticket", ticketSchema);
