const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Event = require('../models/Event');

const normalizeAmenities = (amenities) => {
  if (!amenities) return [];

  if (Array.isArray(amenities)) {
    return amenities.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }

  if (typeof amenities === 'string') {
    try {
      const parsed = JSON.parse(amenities);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
      }
    } catch (error) {
      return amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const buildCapacityFilter = (minCapacity, maxCapacity) => {
  const capacityFilter = {};

  if (minCapacity) {
    const parsedMin = parseInt(minCapacity, 10);
    if (!Number.isNaN(parsedMin)) {
      capacityFilter.$gte = parsedMin;
    }
  }

  if (maxCapacity) {
    const parsedMax = parseInt(maxCapacity, 10);
    if (!Number.isNaN(parsedMax)) {
      capacityFilter.$lte = parsedMax;
    }
  }

  return Object.keys(capacityFilter).length ? capacityFilter : null;
};

const RESTRICTED_EVENT_STATUSES = ['pending', 'approved', 'ongoing'];
const VENUE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

const getTotalTicketsSoldForVenue = async (venueId) => {
  const venueObjectId = typeof venueId === 'string'
    ? new mongoose.Types.ObjectId(venueId)
    : new mongoose.Types.ObjectId(venueId.toString());

  const events = await Event.find(
    { venueId: venueObjectId },
    'ticketTypes'
  ).lean();

  return events.reduce((acc, event) => {
    if (!Array.isArray(event.ticketTypes)) {
      return acc;
    }
    const eventSold = event.ticketTypes.reduce((sum, ticketType) => {
      const sold = typeof ticketType?.sold === 'number' ? ticketType.sold : 0;
      return sum + sold;
    }, 0);
    return acc + eventSold;
  }, 0);
};

const createVenue = async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      state,
      country,
      capacity,
      description,
      amenities,
      status,
    } = req.body;

    const existingVenue = await Venue.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
    });

    if (existingVenue) {
      return res.status(409).json({
        success: false,
        message: 'Venue name already exists',
      });
    }

    const parsedCapacity = parseInt(capacity, 10);
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be an integer greater than zero',
      });
    }

    const venueData = {
      name: name.trim(),
      address: address.trim(),
      capacity: parsedCapacity,
      amenities: normalizeAmenities(amenities),
    };

    if (city) {
      venueData.city = city.trim();
    }

    if (state) {
      venueData.state = state.trim();
    }

    if (country) {
      venueData.country = country.trim();
    }

    if (description) {
      venueData.description = description.trim();
    }

    if (status) {
      venueData.status = status.trim().toLowerCase();
    } else {
      venueData.status = VENUE_STATUS.ACTIVE;
    }

    const venue = await Venue.create(venueData);

    return res.status(201).json({
      success: true,
      message: 'Venue created successfully',
      data: venue,
    });
  } catch (error) {
    console.error('Error creating venue:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating venue',
      error: error.message,
    });
  }
};

const getVenues = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      city,
      state,
      country,
      minCapacity,
      maxCapacity,
      status,
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = {};

    const normalizedSearch = search ? search.trim() : '';
    const normalizedCity = city ? city.trim() : '';
    const normalizedState = state ? state.trim() : '';
    const normalizedCountry = country ? country.trim() : '';
    const normalizedStatus = status ? status.trim().toLowerCase() : '';

    if (normalizedSearch) {
      filter.name = { $regex: normalizedSearch, $options: 'i' };
    }

    if (normalizedCity) {
      filter.city = { $regex: normalizedCity, $options: 'i' };
    }

    if (normalizedState) {
      filter.state = { $regex: normalizedState, $options: 'i' };
    }

    if (normalizedCountry) {
      filter.country = { $regex: normalizedCountry, $options: 'i' };
    }

    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    const capacityFilter = buildCapacityFilter(minCapacity, maxCapacity);
    if (capacityFilter) {
      filter.capacity = capacityFilter;
    }

    const venues = await Venue.find(filter)
      .select('name address capacity status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const total = await Venue.countDocuments(filter);

    return res.json({
      success: true,
      data: venues,
      pagination: {
        current: pageNumber,
        pages: Math.ceil(total / limitNumber),
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching venues',
      error: error.message,
    });
  }
};

const getVenueById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue id',
      });
    }

    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    return res.json({
      success: true,
      data: venue,
    });
  } catch (error) {
    console.error('Error fetching venue:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching venue',
      error: error.message,
    });
  }
};

const updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      city,
      state,
      country,
      capacity,
      description,
      amenities,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue id',
      });
    }

    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    if (name && name.trim().toLowerCase() !== venue.name.toLowerCase()) {
      const duplicate = await Venue.findOne({
        _id: { $ne: id },
        name: { $regex: `^${name}$`, $options: 'i' },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Venue name already exists',
        });
      }

      venue.name = name.trim();
    }

    if (address) venue.address = address.trim();
    if (city !== undefined) {
      venue.city = city ? city.trim() : '';
    }
    if (state !== undefined) {
      venue.state = state ? state.trim() : undefined;
    }
    if (country !== undefined) {
      venue.country = country ? country.trim() : '';
    }
    if (description !== undefined) {
      venue.description = description ? description.trim() : '';
    }

    if (capacity !== undefined) {
      const parsedCapacity = parseInt(capacity, 10);
      if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Capacity must be an integer greater than zero',
        });
      }
      const totalSold = await getTotalTicketsSoldForVenue(venue._id);
      if (parsedCapacity < totalSold) {
        return res.status(400).json({
          success: false,
          message: 'Capacity cannot be less than total tickets sold across events using this venue',
          data: {
            totalTicketsSold: totalSold,
          },
        });
      }
      venue.capacity = parsedCapacity;
    }

    if (amenities !== undefined) {
      venue.amenities = normalizeAmenities(amenities);
    }

    if (req.body.status) {
      venue.status = req.body.status.trim().toLowerCase();
    }

    const updatedVenue = await venue.save();

    return res.json({
      success: true,
      message: 'Venue updated successfully',
      data: updatedVenue,
    });
  } catch (error) {
    console.error('Error updating venue:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating venue',
      error: error.message,
    });
  }
};

const deleteVenue = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid venue id',
      });
    }

    const venue = await Venue.findById(id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: 'Venue not found',
      });
    }

    const activeEvent = await Event.findOne({
      venueId: venue._id,
      status: { $in: RESTRICTED_EVENT_STATUSES },
    }).select('_id title status');

    if (activeEvent) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete venue while events are pending, approved, or ongoing',
        data: {
          eventId: activeEvent._id,
          title: activeEvent.title,
          status: activeEvent.status,
        },
      });
    }

    await Event.updateMany(
      { venueId: venue._id },
      { $set: { venueStatus: 'removed' } }
    );

    await venue.deleteOne();

    return res.json({
      success: true,
      message: 'Venue deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting venue:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting venue',
      error: error.message,
    });
  }
};

module.exports = {
  createVenue,
  getVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
};
