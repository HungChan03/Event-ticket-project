// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  posterUrl: String,
  location: String,
  date: { type: Date, required: true },
  ticketTypes: [
    { type: { type: String, required: true }, price: Number, quantity: Number }
  ],
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
