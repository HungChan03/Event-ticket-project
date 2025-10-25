// controllers/eventController.js
const Event = require('../models/Event');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

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
    let venueData = venue;
    if (typeof venue === 'string') {
      try {
        venueData = JSON.parse(venue);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid venue format'
        });
      }
    }

    // Parse ticketTypes nếu là string
    let ticketTypesData = ticketTypes;
    if (typeof ticketTypes === 'string') {
      try {
        ticketTypesData = JSON.parse(ticketTypes);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ticket types format'
        });
      }
    }

    // Parse categories nếu là string
    let categoriesData = categories;
    if (typeof categories === 'string') {
      try {
        categoriesData = JSON.parse(categories);
      } catch (e) {
        categoriesData = [categories];
      }
    }

    // Tạo sự kiện mới
    const eventData = {
      title,
      description,
      venue: venueData,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      capacity: capacity ? parseInt(capacity) : 0,
      categories: categoriesData || [],
      ticketTypes: ticketTypesData || [],
      organizer: req.user.id, // Sử dụng ID từ token
      status: 'pending' // Mặc định là pending chờ admin duyệt
    };

    // Thêm posterUrl nếu có upload file
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

    res.json({
      success: true,
      data: event
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

    // Kiểm tra quyền chỉnh sửa (User hoặc Admin)
    if (req.user.role !== 'admin' && req.user.role !== 'user' && event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only edit your own events'
      });
    }

    // Không cho phép chỉnh sửa sự kiện đã được duyệt (trừ admin)
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

    // Parse các field phức tạp
    let venueData = venue;
    if (typeof venue === 'string') {
      try {
        venueData = JSON.parse(venue);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid venue format'
        });
      }
    }

    let ticketTypesData = ticketTypes;
    if (typeof ticketTypes === 'string') {
      try {
        ticketTypesData = JSON.parse(ticketTypes);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ticket types format'
        });
      }
    }

    let categoriesData = categories;
    if (typeof categories === 'string') {
      try {
        categoriesData = JSON.parse(categories);
      } catch (e) {
        categoriesData = [categories];
      }
    }

    // Cập nhật các field
    if (title) event.title = title;
    if (description !== undefined) event.description = description;
    if (venueData) event.venue = venueData;
    if (startDate) event.startDate = new Date(startDate);
    if (endDate) event.endDate = new Date(endDate);
    if (capacity !== undefined) event.capacity = parseInt(capacity);
    if (categoriesData) event.categories = categoriesData;
    if (ticketTypesData) event.ticketTypes = ticketTypesData;

    // Cập nhật poster nếu có upload file mới
    if (req.file) {
      // Xóa file poster cũ nếu có
      if (event.posterUrl) {
        const oldFilePath = path.join(__dirname, '..', event.posterUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      event.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    // Reset status về pending nếu organizer chỉnh sửa sự kiện đã được duyệt
    if (event.status === 'approved' && req.user.role !== 'admin') {
      event.status = 'pending';
    }

    await event.save();

    // Populate thông tin organizer
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
