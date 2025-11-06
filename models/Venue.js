// models/Venue.js
const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      min: [1, 'Capacity must be greater than zero']
    },
    description: {
      type: String,
      trim: true
    },
    amenities: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Venue', venueSchema);
