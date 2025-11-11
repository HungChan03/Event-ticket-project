/**
 * Event Controller - Logic xử lý business cho Event Management
 *
 * Mục đích: Xử lý các thao tác CRUD (Create, Read, Update, Delete) trên Event
 */
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Venue = require("../models/Venue");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");

const EVENT_VENUE_STATUS = {
  ACTIVE: "active",
  REMOVED: "removed",
};

const parseMaybeJson = (value) => {
  // Nếu không phải string, trả về giá trị gốc
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Kiểm tra xem có phải JSON string không (bắt đầu bằng { hoặc [ và kết thúc bằng } hoặc ])
  const firstChar = trimmed[0];
  const lastChar = trimmed[trimmed.length - 1];
  if (
    (firstChar === "{" && lastChar === "}") ||
    (firstChar === "[" && lastChar === "]")
  ) {
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

  if (typeof venueInput === "string") {
    return venueInput.trim();
  }

  if (typeof venueInput === "object" && !Array.isArray(venueInput)) {
    return venueInput.venueId || venueInput.id || venueInput._id || null;
  }

  return null;
};

/**
 * Tạo snapshot của venue (chỉ lấy các field cần thiết)
 *
 * Mục đích: Lưu thông tin venue vào event.venue để tránh mất dữ liệu khi venue bị xóa hoặc thay đổi
 */
const buildVenueSnapshot = (venueDoc) => ({
  name: venueDoc.name,
  address: venueDoc.address,
  city: venueDoc.city,
  state: venueDoc.state,
  country: venueDoc.country,
});

/**
 * Tính tổng số vé (sold và quantity) từ mảng ticket types
 *
 * Mục đích: Validate tổng số vé không vượt quá capacity
 */
const computeTicketTotals = (ticketTypes = []) =>
  ticketTypes.reduce(
    (acc, ticket) => {
      const sold = typeof ticket.sold === "number" ? ticket.sold : 0;
      const quantity =
        typeof ticket.quantity === "number" ? ticket.quantity : 0;
      return {
        sold: acc.sold + sold,
        quantity: acc.quantity + quantity,
      };
    },
    { sold: 0, quantity: 0 }
  );

/**
 * Validate và sanitize ticket types
 *
 * Mục đích: Đảm bảo ticket types hợp lệ (name, price, quantity, sold)
 */
const sanitizeTicketTypes = (input, existingTicketTypes = []) => {
  if (input === undefined || input === null) {
    const totals = computeTicketTotals(existingTicketTypes);
    return { ticketTypes: existingTicketTypes, totals };
  }

  if (!Array.isArray(input)) {
    const error = new Error("Ticket types must be an array");
    error.status = 400;
    throw error;
  }

  // Tạo Map từ existingTicketTypes để preserve sold count khi update
  // Key: ticket name, Value: ticket object
  const existingByName = new Map(
    existingTicketTypes
      .filter((ticket) => typeof ticket?.name === "string")
      .map((ticket) => [ticket.name, ticket])
  );

  const sanitized = input.map((ticketType, index) => {
    const name =
      typeof ticketType.name === "string" ? ticketType.name.trim() : "";
    if (!name) {
      const error = new Error(`Ticket type ${index + 1}: name is required`);
      error.status = 400;
      throw error;
    }

    // Validate price (phải là number ≥ 0)
    const price =
      typeof ticketType.price === "number"
        ? ticketType.price
        : parseFloat(ticketType.price);
    if (Number.isNaN(price) || price < 0) {
      const error = new Error(
        `Ticket type ${index + 1}: price must be a non-negative number`
      );
      error.status = 400;
      throw error;
    }

    // Validate quantity (phải là number ≥ 0)
    const quantity =
      typeof ticketType.quantity === "number"
        ? ticketType.quantity
        : parseInt(ticketType.quantity, 10);
    if (Number.isNaN(quantity) || quantity < 0) {
      const error = new Error(
        `Ticket type ${index + 1}: quantity must be a non-negative integer`
      );
      error.status = 400;
      throw error;
    }

    // Validate sold (phải là number ≥ 0, và sold ≤ quantity)
    // Nếu không được cung cấp, lấy từ existingTicketTypes (khi update)
    let sold;
    if (ticketType.sold !== undefined) {
      sold =
        typeof ticketType.sold === "number"
          ? ticketType.sold
          : parseInt(ticketType.sold, 10);
    } else {
      // Khi update, preserve sold count từ existingTicketTypes
      sold = existingByName.get(name)?.sold ?? 0;
    }

    // Đảm bảo sold là number hợp lệ
    if (Number.isNaN(sold) || sold < 0) {
      sold = 0;
    }

    // Validate sold ≤ quantity
    if (quantity < sold) {
      const error = new Error(
        `Ticket type ${index + 1}: quantity cannot be less than sold`
      );
      error.status = 400;
      throw error;
    }

    return {
      name,
      price,
      quantity,
      sold,
    };
  });

  // Tính tổng số vé
  const totals = computeTicketTotals(sanitized);
  return { ticketTypes: sanitized, totals };
};

/**
 * Tạo sự kiện mới
 *
 * @route   POST /api/v1/events
 * @access  Private (Organizer hoặc Admin)
 */
const createEvent = async (req, res) => {
  try {
    // Lấy dữ liệu từ request body
    const {
      title,
      description,
      venue,
      startDate,
      endDate,
      capacity,
      categories,
      ticketTypes,
    } = req.body;

    // Validation cơ bản: title và startDate là required
    if (!title || !startDate) {
      return res.status(400).json({
        success: false,
        message: "Title and start date are required",
      });
    }

    // Bước 1: Parse và validate venue
    // Parse venue từ JSON string (nếu có) thành object
    let venueData = parseMaybeJson(venue);

    // Extract venueId từ venue data (có thể là string hoặc object)
    const venueId = extractVenueId(venueData);

    // Validate venueId phải tồn tại và là MongoDB ObjectId hợp lệ
    if (!venueId || !mongoose.Types.ObjectId.isValid(venueId)) {
      return res.status(400).json({
        success: false,
        message: "A valid venueId is required to create an event",
      });
    }

    // Tìm venue trong database
    const venueDoc = await Venue.findById(venueId);
    if (!venueDoc) {
      return res.status(404).json({
        success: false,
        message: "Selected venue not found",
      });
    }

    // Tạo venue snapshot (lưu thông tin venue vào event.venue để tránh mất dữ liệu khi venue bị xóa)
    venueData = buildVenueSnapshot(venueDoc);

    // Bước 2: Parse và validate ticket types
    // Parse ticketTypes từ JSON string (nếu có) thành array
    let ticketTypesData = parseMaybeJson(ticketTypes);

    // Bước 3: Parse categories (nếu có)
    // Parse categories từ JSON string (nếu có) thành array
    let categoriesData = parseMaybeJson(categories);
    // Nếu categories không phải array, chuyển thành array có 1 phần tử
    if (categoriesData && !Array.isArray(categoriesData)) {
      categoriesData = [categoriesData];
    }

    // Validate và sanitize ticket types
    let sanitizedTicketTypes;
    let ticketTotals;
    try {
      const result = sanitizeTicketTypes(ticketTypesData, []); // [] vì đây là create (không có existing ticket types)
      sanitizedTicketTypes = result.ticketTypes; // Mảng ticket types đã được validate
      ticketTotals = result.totals; // Tổng số vé (sold và quantity)
    } catch (validationError) {
      // Nếu validation fail, trả về lỗi
      return res.status(validationError.status || 400).json({
        success: false,
        message: validationError.message,
      });
    }

    // Bước 4: Validate capacity
    // Parse capacity (nếu không có thì dùng venue capacity)
    const parsedCapacity = capacity
      ? parseInt(capacity, 10)
      : venueDoc.capacity;

    // Validate capacity phải là số nguyên > 0
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be an integer greater than zero",
      });
    }

    // Validate capacity không được vượt quá venue capacity
    if (parsedCapacity > venueDoc.capacity) {
      return res.status(400).json({
        success: false,
        message: "Event capacity cannot exceed selected venue capacity",
        data: {
          venueCapacity: venueDoc.capacity,
        },
      });
    }

    // Bước 5: Validate tổng số vé không được vượt quá capacity
    // Validate tổng số vé (quantity) không được vượt quá capacity
    if (ticketTotals.quantity > parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: "Total ticket quantity cannot exceed event capacity",
      });
    }

    // Validate tổng số vé đã bán (sold) không được vượt quá capacity
    if (ticketTotals.sold > parsedCapacity) {
      return res.status(400).json({
        success: false,
        message: "Tickets sold cannot exceed event capacity",
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
      status: "pending", // Mặc định là pending chờ admin duyệt
    };

    eventData.venueId = venueDoc._id;
    eventData.venueStatus = EVENT_VENUE_STATUS.ACTIVE;
    // Thêm posterUrl nếu có upload file poster cho event
    if (req.file) {
      eventData.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    const event = await Event.create(eventData);

    // Populate thông tin organizer
    await event.populate("organizer", "name email");

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: event,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating event",
      error: error.message,
    });
  }
};

/**
 * Lấy danh sách sự kiện
 *
 * @route   GET /api/v1/events
 * @access  Public
 */
const getEvents = async (req, res) => {
  try {
    // Lấy query parameters
    const {
      page = 1,
      limit = 10,
      status,
      category,
      organizer,
      search,
    } = req.query;

    // Xây dựng filter
    const filter = {};

    // Phân quyền: Filter theo status dựa trên role
    // Guest (không auth): chỉ xem events approved
    // User/Organizer (có auth nhưng không phải admin): chỉ xem events approved
    // Admin (có auth): xem tất cả events (approved, pending, rejected)
    if (!req.user) {
      // Guest: chỉ hiển thị events đã approved
      filter.status = "approved";
    } else if (req.user.role === "admin") {
      // Admin: có thể xem tất cả status, nếu có query status thì filter theo đó
      if (status) {
        filter.status = status;
      }
      // Nếu không có query status, admin xem tất cả (không filter status)
    } else {
      // User/Organizer: chỉ xem events approved (public view)
      filter.status = "approved";
    }

    // Filter theo category (nếu có)
    if (category) {
      filter.categories = { $in: [category] }; // Tìm events có category trong mảng categories
    }

    // Filter theo organizer (nếu có - admin only)
    if (organizer) {
      filter.organizer = organizer;
    }

    // Search theo title hoặc description (case-insensitive)
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } }, // Tìm trong title
        { description: { $regex: search, $options: "i" } }, // Tìm trong description
      ];
    }

    // Tính toán pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Lấy danh sách sự kiện từ database
    const events = await Event.find(filter)
      .populate("organizer", "name email") // Thay thế organizer ID bằng thông tin user
      .sort({ createdAt: -1 }) // Sort theo createdAt DESC (mới nhất trước)
      .skip(skip) // Bỏ qua các records trước đó
      .limit(parseInt(limit)); // Giới hạn số lượng records

    // Đếm tổng số sự kiện (để tính pagination)
    const total = await Event.countDocuments(filter);

    // Trả về response
    res.json({
      success: true,
      data: events,
      pagination: {
        current: parseInt(page), // Trang hiện tại
        pages: Math.ceil(total / parseInt(limit)), // Tổng số trang
        total: total, // Tổng số records
      },
    });
  } catch (error) {
    console.error("Error getting events:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting events",
      error: error.message,
    });
  }
};

/**
 * Lấy chi tiết sự kiện
 *
 * @route   GET /api/v1/events/:id
 * @access  Public
 */
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "organizer",
      "name email phone"
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Kiểm tra quyền xem sự kiện
    // Event đã approved: Ai cũng xem được
    // Event chưa approved: Chỉ organizer của event đó hoặc admin xem được
    if (
      event.status !== "approved" &&
      (!req.user ||
        (req.user.id !== event.organizer._id.toString() &&
          req.user.role !== "admin"))
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Event not approved yet",
      });
    }

    const evt = event.toObject();
    const ticketTypes = Array.isArray(evt.ticketTypes)
      ? evt.ticketTypes.map((t) => ({
          ...t,
          remaining: (t.quantity || 0) - (t.sold || 0),
        }))
      : [];
    const totals = {
      capacity: evt.capacity || 0,
      sold: ticketTypes.reduce((s, t) => s + (t.sold || 0), 0),
      remaining: ticketTypes.reduce(
        (s, t) => s + ((t.quantity || 0) - (t.sold || 0)),
        0
      ),
    };
    evt.ticketTypes = ticketTypes;
    evt.totals = totals;

    res.json({
      success: true,
      data: evt,
    });
  } catch (error) {
    console.error("Error getting event:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting event",
      error: error.message,
    });
  }
};

/**
 * Cập nhật sự kiện
 *
 * @route   PUT /api/v1/events/:id
 * @access  Private (Organizer hoặc Admin)
 */
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Kiểm tra quyền update: Chỉ organizer của event hoặc admin
    // authenticateOrganizer middleware đã kiểm tra role là organizer hoặc admin
    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only edit your own events",
      });
    }

    if (event.status === "approved" && req.user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit approved event. Contact admin for changes",
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
      ticketTypes,
    } = req.body;

    const venuePayload = parseMaybeJson(venue);
    const venueInputProvided =
      venue !== undefined && venue !== null && venue !== "";
    let venueDocForValidation = null;
    let venueIdToUse = event.venueId || null;
    let venueSnapshotToUse = event.venue;
    let venueStatusToUse = event.venueStatus || EVENT_VENUE_STATUS.ACTIVE;

    if (venueInputProvided) {
      const venueIdCandidate = extractVenueId(venuePayload);
      if (
        !venueIdCandidate ||
        !mongoose.Types.ObjectId.isValid(venueIdCandidate)
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid venueId is required when updating the venue",
        });
      }

      venueDocForValidation = await Venue.findById(venueIdCandidate);
      if (!venueDocForValidation) {
        return res.status(404).json({
          success: false,
          message: "Selected venue not found",
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
      const result = sanitizeTicketTypes(
        ticketTypesPayload,
        event.ticketTypes || []
      );
      sanitizedTicketTypes = result.ticketTypes;
      ticketTotals = result.totals;
    } catch (validationError) {
      return res.status(validationError.status || 400).json({
        success: false,
        message: validationError.message,
      });
    }

    const capacityProvided = capacity !== undefined && capacity !== null;
    const currentCapacity =
      typeof event.capacity === "number" ? event.capacity : 0;
    let nextCapacity = currentCapacity;

    if (capacityProvided) {
      nextCapacity = parseInt(capacity, 10);
      if (Number.isNaN(nextCapacity) || nextCapacity < 0) {
        return res.status(400).json({
          success: false,
          message: "Capacity must be a non-negative integer",
        });
      }
    }

    const capacityForValidation = capacityProvided
      ? nextCapacity
      : currentCapacity;
    const capacityLimit =
      capacityForValidation > 0 ? capacityForValidation : null;

    if (capacityLimit !== null && ticketTotals.sold > capacityLimit) {
      return res.status(400).json({
        success: false,
        message: "Capacity cannot be less than total tickets sold",
      });
    }

    if (capacityLimit !== null && ticketTotals.quantity > capacityLimit) {
      return res.status(400).json({
        success: false,
        message: "Total ticket quantity cannot exceed event capacity",
      });
    }

    const venueCapacityLimit = venueDocForValidation
      ? venueDocForValidation.capacity
      : null;
    if (venueCapacityLimit && venueCapacityLimit > 0) {
      if (capacityLimit !== null && capacityLimit > venueCapacityLimit) {
        return res.status(400).json({
          success: false,
          message: "Event capacity cannot exceed selected venue capacity",
          data: {
            venueCapacity: venueCapacityLimit,
          },
        });
      }

      if (
        capacityLimit === null &&
        ticketTotals.quantity > venueCapacityLimit
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Total ticket quantity cannot exceed selected venue capacity",
          data: {
            venueCapacity: venueCapacityLimit,
          },
        });
      }

      if (ticketTotals.sold > venueCapacityLimit) {
        return res.status(400).json({
          success: false,
          message: "Tickets sold cannot exceed selected venue capacity",
          data: {
            venueCapacity: venueCapacityLimit,
          },
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
        const oldFilePath = path.join(__dirname, "..", event.posterUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      event.posterUrl = `/uploads/posters/${req.file.filename}`;
    }

    if (event.status === "approved" && req.user.role !== "admin") {
      event.status = "pending";
    }

    await event.save();

    await event.populate("organizer", "name email");

    res.json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating event",
      error: error.message,
    });
  }
};

/**
 * Xóa sự kiện
 *
 * @route   DELETE /api/v1/events/:id
 * @access  Private (Organizer hoặc Admin)
 */
const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Kiểm tra quyền xóa: Chỉ organizer của event hoặc admin
    // authenticateOrganizer middleware đã kiểm tra role là organizer hoặc admin
    if (
      req.user.role !== "admin" &&
      event.organizer.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only delete your own events",
      });
    }

    // Xóa file poster nếu có
    if (event.posterUrl) {
      const filePath = path.join(__dirname, "..", event.posterUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Event.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting event",
      error: error.message,
    });
  }
};

/**
 * Lấy sự kiện của organizer
 *
 * @route   GET /api/v1/events/my-events
 * @access  Private (Organizer hoặc Admin)
 */
const getMyEvents = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { organizer: req.user.id }; // Sử dụng ID từ token
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const events = await Event.find(filter)
      .populate("organizer", "name email")
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
        total: total,
      },
    });
  } catch (error) {
    console.error("Error getting my events:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting my events",
      error: error.message,
    });
  }
};

/**
 * Thống kê sự kiện của organizer
 *
 * @route   GET /api/v1/events/my-stats
 * @access  Private (Organizer hoặc Admin)
 */
const getEventStats = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }); // Sử dụng ID từ token

    const stats = {
      totalEvents: events.length,
      pendingEvents: events.filter((e) => e.status === "pending").length,
      approvedEvents: events.filter((e) => e.status === "approved").length,
      rejectedEvents: events.filter((e) => e.status === "rejected").length,
      cancelledEvents: events.filter((e) => e.status === "cancelled").length,
      totalTicketsSold: 0,
      totalRevenue: 0,
    };

    // Tính tổng vé bán và doanh thu
    events.forEach((event) => {
      event.ticketTypes.forEach((ticketType) => {
        stats.totalTicketsSold += ticketType.sold;
        stats.totalRevenue += ticketType.sold * ticketType.price;
      });
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting event stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting event stats",
      error: error.message,
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
  getEventStats,
};
