// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  ticketIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ticket" }],
  amount: Number,
  paymentMethod: { type: String, enum: ["momo", "vnpay", "paypal", "mock"], default: "mock" },
  status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
