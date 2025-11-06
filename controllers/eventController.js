// controllers/eventController.js
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

const EVENT_VENUE_STATUS = {
  ACTIVE: 'active',
  REMOVED: 'removed'
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const firstChar = trimmed[0];
  const lastChar = trimmed[trimmed.length - 1];
  if ((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return trimmed;
    }
  }

  return trimmed;
};

const extractVenueId = (venueInput) => {
  if (!venueInput) return null;

  if (typeof venueInput === 'string') {
    return venueInput.trim();
  }

  if (typeof venueInput === 'object' && !Array.isArray(venueInput)) {
    return venueInput.venueId || venueInput.id || venueInput._id || null;
  }

  return null;
};

const buildVenueSnapshot = (venueDoc) => ({
  name: venueDoc.name,
  address: venueDoc.address,
  city: venueDoc.city,
  state: venueDoc.state,
  country: venueDoc.country
});

const computeTicketTotals = (ticketTypes = []) => ticketTypes.reduce((acc, ticket) => {
  const sold = typeof ticket.sold === 'number' ? ticket.sold : 0;
  const quantity = typeof ticket.quantity === 'number' ? ticket.quantity : 0;
  return {
    sold: acc.sold + sold,
    quantity: acc.quantity + quantity
  };
}, { sold: 0, quantity: 0 });

const sanitizeTicketTypes = (input, existingTicketTypes = []) => {
  if (input === undefined || input === null) {
    const totals = computeTicketTotals(existingTicketTypes);
    return { ticketTypes: existingTicketTypes, totals };
  }

  if (!Array.isArray(input)) {
    const error = new Error('Ticket types must be an array');
    error.status = 400;
    throw error;
  }

  const existingByName = new Map(
    existingTicketTypes
      .filter((ticket) => typeof ticket?.name === 'string')
      .map((ticket) => [ticket.name, ticket])
  );

  const sanitized = input.map((ticketType, index) => {
    const name = typeof ticketType.name === 'string' ? ticketType.name.trim() : '';
    if (!name) {
      const error = new Error(`Ticket type ${index + 1}: name is required`);
      error.status = 400;
      throw error;
    }

    const price = typeof ticketType.price === 'number'
      ? ticketType.price
      : parseFloat(ticketType.price);
    if (Number.isNaN(price) || price < 0) {
      const error = new Error(`Ticket type ${index + 1}: price must be a non-negative number`);
      error.status = 400;
      throw error;
    }

    const quantity = typeof ticketType.quantity === 'number'
      ? ticketType.quantity
      : parseInt(ticketType.quantity, 10);
    if (Number.isNaN(quantity) || quantity < 0) {
      const error = new Error(`Ticket type ${index + 1}: quantity must be a non-negative integer`);
      error.status = 400;
      throw error;
    }

    let sold;
    if (ticketType.sold !== undefined) {
      sold = typeof ticketType.sold === 'number'
        ? ticketType.sold
        : parseInt(ticketType.sold, 10);
    } else {
      sold = existingByName.get(name)?.sold ?? 0;
    }

    if (Number.isNaN(sold) || sold < 0) {
      sold = 0;
    }

    if (quantity < sold) {
      const error = new Error(`Ticket type ${index + 1}: quantity cannot be less than sold`);
      error.status = 400;
      throw error;
    }

    return {
      name,
      price,
      quantity,
      sold
    };
  });

  const totals = computeTicketTotals(sanitized);
  return { ticketTypes: sanitized, totals };
};

// @desc    Tạo sự kiện mới
// @route   POST /api/events
// @access  Private (Organizer)
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      startDate,
      endDate,
      capacity,
      categories,
      ticketTypes
    } = req.body;

    // Validation cơ bản
    if (!title || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Title and start date are required'
      });
    }

    // Parse venue nếu là string
    let venueData = parseMaybeJson(venue);
    const venueId = extractVenueId(venueData);
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid venueId is required to create an event'
      });
    }

    const venueDoc = await Venue.findById(venueId);
    if (!venueDoc) {
      return res.status(404).json({
        success: false,
        message: 'Selected venue not found'
      });
    }

    venueData = buildVenueSnapshot(venueDoc);

    // Parse ticketTypes nếu là string
    let ticketTypesData = parseMaybeJson(ticketTypes);

    // Parse categories nếu là string
    let categoriesData = parseMaybeJson(categories);
    if (categoriesData && !Array.isArray(categoriesData)) {
      categoriesData = [categoriesData];
    }

    let sanitizedTicketTypes;
    let ticketTotals;
    try {
      const result = sanitizeTicketTypes(ticketTypesData, []);
      sanitizedTicketTypes = result.ticketTypes;
      ticketTotals = result.totals;
    } catch (validationError) {
      return res.status(validationError.status || 400).json({
        success: false,
        message: validationError.message
      });
    }

    const parsedCapacity = capacity ? parseInt(capacity, 10) : venueDoc.capacity;
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be an integer greater than zero'
      });
    }

    if (parsedCapacity > venueDoc.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Event capacity cannot exceed selected venue capacity',
        data: {
          venueCapacity: venueDoc.capacity
        }
      });
    }

    if (ticketTotals.quantity > parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Total ticket quantity cannot exceed event capacity'
      });
    }

    if (ticketTotals.sold > parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Tickets sold cannot exceed event capacity'
      });
    }

    // Tạo sự kiện mới
    const eventData = {
      title,
      description,
      venue: venueData,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      capacity: parsedCapacity,
      categories: categoriesData || [],
      ticketTypes: sanitizedTicketTypes,
      organizer: req.user.id, // Sử dụng ID từ token
      status: 'pending' // Mặc định là pending chờ admin duyệt
    };


    eventData.venueId = venueDoc._id;
    eventData.venueStatus = EVENT_VENUE_STATUS.ACTIVE;
    // Th�m posterUrl n?u c� upload file
    if (req.file) {
      eventData.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    const event = await Event.create(eventData);

    // Populate thông tin organizer
    await event.populate('organizer', 'name email');

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });

  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating event',
      error: error.message
    });
  }
};

// @desc    Lấy danh sách sự kiện
// @route   GET /api/events
// @access  Public
const getEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      organizer,
      search
    } = req.query;

    // Xây dựng filter
    const filter = {};
    
    // Guest (không auth): chỉ xem events approved
    // Admin (có auth): xem tất cả events (approved, pending, rejected)
    if (!req.user) {
      // Guest: chỉ hiển thị events đã approved
      filter.status = 'approved';
    } else if (req.user.role === 'admin') {
      // Admin: có thể xem tất cả status, nếu có query status thì filter theo đó
      if (status) {
        filter.status = status;
      }
      // Nếu không có query status, admin xem tất cả (không filter status)
    } else {
      // User thường: chỉ xem events approved
      filter.status = 'approved';
    }

    // Filter theo category
    if (category) {
      filter.categories = { $in: [category] };
    }

    // Filter theo organizer
    if (organizer) {
      filter.organizer = organizer;
    }

    // Search theo title hoặc description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Tính toán pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy danh sách sự kiện
    const events = await Event.find(filter)
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng số sự kiện
    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      data: events,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total
      }
    });

  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting events',
      error: error.message
    });
  }
};

// @desc    Lấy chi tiết sự kiện
// @route   GET /api/events/:id
// @access  Public
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email phone');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Kiểm tra quyền xem sự kiện
    if (event.status !== 'approved' && 
        (!req.user || (req.user.id !== event.organizer._id.toString() && req.user.role !== 'admin'))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Event not approved yet'
      });
    }

    const evt = event.toObject();
    const ticketTypes = Array.isArray(evt.ticketTypes) ? evt.ticketTypes.map(t => ({
      ...t,
      remaining: (t.quantity || 0) - (t.sold || 0)
    })) : [];
    const totals = {
      capacity: evt.capacity || 0,
      sold: ticketTypes.reduce((s, t) => s + (t.sold || 0), 0),
      remaining: ticketTypes.reduce((s, t) => s + ((t.quantity || 0) - (t.sold || 0)), 0)
    };
    evt.ticketTypes = ticketTypes;
    evt.totals = totals;

    res.json({
      success: true,
      data: evt
    });

  } catch (error) {
    console.error('Error getting event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting event',
      error: error.message
    });
  }
};

// @desc    Cập nhật sự kiện
// @route   PUT /api/events/:id
// @access  Private (Organizer hoặc Admin)
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'user' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own events'
      });
    }

    if (event.status === 'approved' && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit approved event. Contact admin for changes'
      });
    }

    const {
      title,
      description,
      venue,
      startDate,
      endDate,
      capacity,
      categories,
      ticketTypes
    } = req.body;

    const venuePayload = parseMaybeJson(venue);
    const venueInputProvided = venue !== undefined && venue !== null && venue !== '';
    let venueDocForValidation = null;
    let venueIdToUse = event.venueId || null;
    let venueSnapshotToUse = event.venue;
    let venueStatusToUse = event.venueStatus || EVENT_VENUE_STATUS.ACTIVE;

    if (venueInputProvided) {
      const venueIdCandidate = extractVenueId(venuePayload);
      if (!venueIdCandidate || !mongoose.Types.ObjectId.isValid(venueIdCandidate)) {
        return res.status(400).json({
          success: false,
          message: 'A valid venueId is required when updating the venue'
        });
      }

      venueDocForValidation = await Venue.findById(venueIdCandidate);
      if (!venueDocForValidation) {
        return res.status(404).json({
          success: false,
          message: 'Selected venue not found'
        });
      }

      venueIdToUse = venueDocForValidation._id;
      venueSnapshotToUse = buildVenueSnapshot(venueDocForValidation);
      venueStatusToUse = EVENT_VENUE_STATUS.ACTIVE;
    } else if (event.venueId) {
      venueDocForValidation = await Venue.findById(event.venueId);
      if (venueDocForValidation) {
        venueSnapshotToUse = buildVenueSnapshot(venueDocForValidation);
      }
    }

    const ticketTypesPayload = parseMaybeJson(ticketTypes);
    let categoriesData = parseMaybeJson(categories);
    if (categoriesData && !Array.isArray(categoriesData)) {
      categoriesData = [categoriesData];
    }

    let sanitizedTicketTypes;
    let ticketTotals;
    try {
      const result = sanitizeTicketTypes(ticketTypesPayload, event.ticketTypes || []);
      sanitizedTicketTypes = result.ticketTypes;
      ticketTotals = result.totals;
    } catch (validationError) {
      return res.status(validationError.status || 400).json({
        success: false,
        message: validationError.message
      });
    }

    const capacityProvided = capacity !== undefined && capacity !== null;
    const currentCapacity = typeof event.capacity === 'number' ? event.capacity : 0;
    let nextCapacity = currentCapacity;

    if (capacityProvided) {
      nextCapacity = parseInt(capacity, 10);
      if (Number.isNaN(nextCapacity) || nextCapacity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Capacity must be a non-negative integer'
        });
      }
    }

    const capacityForValidation = capacityProvided ? nextCapacity : currentCapacity;
    const capacityLimit = capacityForValidation > 0 ? capacityForValidation : null;

    if (capacityLimit !== null && ticketTotals.sold > capacityLimit) {
      return res.status(400).json({
        success: false,
        message: 'Capacity cannot be less than total tickets sold'
      });
    }

    if (capacityLimit !== null && ticketTotals.quantity > capacityLimit) {
      return res.status(400).json({
        success: false,
        message: 'Total ticket quantity cannot exceed event capacity'
      });
    }

    const venueCapacityLimit = venueDocForValidation ? venueDocForValidation.capacity : null;
    if (venueCapacityLimit && venueCapacityLimit > 0) {
      if (capacityLimit !== null && capacityLimit > venueCapacityLimit) {
        return res.status(400).json({
          success: false,
          message: 'Event capacity cannot exceed selected venue capacity',
          data: {
            venueCapacity: venueCapacityLimit
          }
        });
      }

      if (capacityLimit === null && ticketTotals.quantity > venueCapacityLimit) {
        return res.status(400).json({
          success: false,
          message: 'Total ticket quantity cannot exceed selected venue capacity',
          data: {
            venueCapacity: venueCapacityLimit
          }
        });
      }

      if (ticketTotals.sold > venueCapacityLimit) {
        return res.status(400).json({
          success: false,
          message: 'Tickets sold cannot exceed selected venue capacity',
          data: {
            venueCapacity: venueCapacityLimit
          }
        });
      }
    }

    if (title) {
      event.title = title;
    }
    if (description !== undefined) {
      event.description = description;
    }
    if (startDate) {
      event.startDate = new Date(startDate);
    }
    if (endDate) {
      event.endDate = new Date(endDate);
    }
    if (categories !== undefined) {
      event.categories = categoriesData || [];
    }

    event.ticketTypes = sanitizedTicketTypes;

    if (capacityProvided) {
      event.capacity = nextCapacity;
    }

    if (venueInputProvided && venueDocForValidation) {
      event.venueId = venueIdToUse;
      event.venue = venueSnapshotToUse;
      event.venueStatus = venueStatusToUse;
    } else if (!event.venueId && venueDocForValidation) {
      event.venueId = venueDocForValidation._id;
      event.venue = venueSnapshotToUse || event.venue;
      if (event.venueStatus === EVENT_VENUE_STATUS.REMOVED) {
        event.venueStatus = EVENT_VENUE_STATUS.ACTIVE;
      }
    }

    if (req.file) {
      if (event.posterUrl) {
        const oldFilePath = path.join(__dirname, '..', event.posterUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      event.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    if (event.status === 'approved' && req.user.role !== 'admin') {
      event.status = 'pending';
    }

    await event.save();

    await event.populate('organizer', 'name email');

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });

  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating event',
      error: error.message
    });
  }
};

// @desc    Xóa sự kiện
// @route   DELETE /api/events/:id
// @access  Private (Organizer hoặc Admin)
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Kiểm tra quyền xóa (User hoặc Admin)
    if (req.user.role !== 'admin' && req.user.role !== 'user' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own events'
      });
    }

    // Xóa file poster nếu có
    if (event.posterUrl) {
      const filePath = path.join(__dirname, '..', event.posterUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting event',
      error: error.message
    });
  }
};

// @desc    Lấy sự kiện của user
// @route   GET /api/events/my-events
// @access  Private (User)
const getMyEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status
    } = req.query;

    const filter = { organizer: req.user.id }; // Sử dụng ID từ token
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(filter)
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(filter);

    res.json({
      success: true,
      data: events,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total
      }
    });

  } catch (error) {
    console.error('Error getting my events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting my events',
      error: error.message
    });
  }
};

// @desc    Thống kê sự kiện của user
// @route   GET /api/events/my-stats
// @access  Private (User)
const getEventStats = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }); // Sử dụng ID từ token

    const stats = {
      totalEvents: events.length,
      pendingEvents: events.filter(e => e.status === 'pending').length,
      approvedEvents: events.filter(e => e.status === 'approved').length,
      rejectedEvents: events.filter(e => e.status === 'rejected').length,
      cancelledEvents: events.filter(e => e.status === 'cancelled').length,
      totalTicketsSold: 0,
      totalRevenue: 0
    };

    // Tính tổng vé bán và doanh thu
    events.forEach(event => {
      event.ticketTypes.forEach(ticketType => {
        stats.totalTicketsSold += ticketType.sold;
        stats.totalRevenue += ticketType.sold * ticketType.price;
      });
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting event stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting event stats',
      error: error.message
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getMyEvents,
  getEventStats
};

