const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const bcrypt = require('bcryptjs');

// Lấy danh sách tất cả users (có phân trang)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Tìm kiếm theo tên hoặc email
    const searchQuery = req.query.search || '';
    const searchRegex = new RegExp(searchQuery, 'i');
    
    const filter = {
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    };
    
    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách users',
      error: error.message
    });
  }
};

// Lấy thông tin chi tiết một user
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin user',
      error: error.message
    });
  }
};

// Tạo user mới
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, avatarUrl } = req.body;
    
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng'
      });
    }
    
    // Mã hóa password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      phone,
      avatarUrl,
      isVerified: true // Admin tạo user thì mặc định đã verify
    });
    
    await newUser.save();
    
    // Trả về user không bao gồm password
    const userResponse = await User.findById(newUser._id)
      .select('-password -resetPasswordToken -resetPasswordExpires');
    
    res.status(201).json({
      success: true,
      message: 'Tạo user thành công',
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo user',
      error: error.message
    });
  }
};

// Cập nhật thông tin user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, avatarUrl, isVerified } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }
    
    // Kiểm tra email đã tồn tại ở user khác chưa
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được sử dụng bởi user khác'
        });
      }
    }
    
    // Cập nhật các trường
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật user thành công',
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật user',
      error: error.message
    });
  }
};

// Đổi mật khẩu user
const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
      });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }
    
    // Mã hóa mật khẩu mới
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    await User.findByIdAndUpdate(id, { password: hashedPassword });
    
    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi đổi mật khẩu',
      error: error.message
    });
  }
};

// Xóa user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }
    
    // Không cho phép admin xóa chính mình (tạm thời comment để test)
    // if (req.user && req.user.id === id) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Không thể xóa chính mình'
    //   });
    // }
    
    await User.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Xóa user thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa user',
      error: error.message
    });
  }
};

// Thống kê users
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const unverifiedUsers = await User.countDocuments({ isVerified: false });
    
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const recentUsers = await User.find()
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        unverifiedUsers,
        usersByRole,
        recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê users',
      error: error.message
    });
  }
};

// ==================== EVENT MANAGEMENT FUNCTIONS ====================

// Lấy danh sách tất cả events (có phân trang và filter)
const getAllEvents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter options
    const { status, category, organizer, search } = req.query;
    
    const filter = {};
    
    // Filter theo status
    if (status) {
      filter.status = status;
    }
    
    // Filter theo category
    if (category) {
      filter.categories = { $in: [category] };
    }
    
    // Filter theo organizer
    if (organizer) {
      filter.organizer = organizer;
    }
    
    // Tìm kiếm theo title hoặc description
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }
    
    const events = await Event.find(filter)
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalEvents = await Event.countDocuments(filter);
    const totalPages = Math.ceil(totalEvents / limit);
    
    res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          currentPage: page,
          totalPages,
          totalEvents,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách events',
      error: error.message
    });
  }
};

// Lấy thông tin chi tiết một event
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id)
      .populate('organizer', 'name email phone');
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    res.status(200).json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin event',
      error: error.message
    });
  }
};

// Tạo event mới (admin có thể tạo event cho organizer)
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      posterUrl,
      venue,
      startDate,
      endDate,
      capacity,
      categories,
      ticketTypes,
      organizer
    } = req.body;
    
    // Kiểm tra organizer có tồn tại không
    const organizerUser = await User.findById(organizer);
    if (!organizerUser) {
      return res.status(400).json({
        success: false,
        message: 'Organizer không tồn tại'
      });
    }
    
    // Kiểm tra organizer có quyền tạo event không
    if (!['organizer', 'admin'].includes(organizerUser.role)) {
      return res.status(400).json({
        success: false,
        message: 'User không có quyền tạo event'
      });
    }
    
    const newEvent = new Event({
      title,
      description,
      posterUrl,
      venue,
      startDate,
      endDate,
      capacity,
      categories: categories || [],
      ticketTypes: ticketTypes || [],
      organizer,
      status: 'approved' // Admin tạo event thì mặc định approved
    });
    
    await newEvent.save();
    
    const eventResponse = await Event.findById(newEvent._id)
      .populate('organizer', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Tạo event thành công',
      data: eventResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo event',
      error: error.message
    });
  }
};

// Cập nhật thông tin event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    // Không cho phép cập nhật organizer
    if (updateData.organizer) {
      delete updateData.organizer;
    }
    
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('organizer', 'name email');
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật event thành công',
      data: updatedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật event',
      error: error.message
    });
  }
};

// Duyệt event (approve)
const approveEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    if (event.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Event đã được duyệt rồi'
      });
    }
    
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { 
        status: 'approved',
        adminNote: adminNote || 'Event đã được duyệt bởi admin'
      },
      { new: true }
    ).populate('organizer', 'name email');
    
    res.status(200).json({
      success: true,
      message: 'Duyệt event thành công',
      data: updatedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi duyệt event',
      error: error.message
    });
  }
};

// Từ chối event (reject)
const rejectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do từ chối'
      });
    }
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    if (event.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Event đã bị từ chối rồi'
      });
    }
    
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        adminNote: reason
      },
      { new: true }
    ).populate('organizer', 'name email');
    
    res.status(200).json({
      success: true,
      message: 'Từ chối event thành công',
      data: updatedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi từ chối event',
      error: error.message
    });
  }
};

// Hủy event
const cancelEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Event đã bị hủy rồi'
      });
    }
    
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { 
        status: 'cancelled',
        adminNote: reason || 'Event đã bị hủy bởi admin'
      },
      { new: true }
    ).populate('organizer', 'name email');
    
    res.status(200).json({
      success: true,
      message: 'Hủy event thành công',
      data: updatedEvent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy event',
      error: error.message
    });
  }
};

// Xóa event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy event'
      });
    }
    
    // Kiểm tra event có vé đã bán chưa
    const hasSoldTickets = event.ticketTypes.some(ticketType => ticketType.sold > 0);
    if (hasSoldTickets) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa event đã có vé được bán'
      });
    }
    
    await Event.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Xóa event thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa event',
      error: error.message
    });
  }
};

// Thống kê events
const getEventStats = async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const approvedEvents = await Event.countDocuments({ status: 'approved' });
    const pendingEvents = await Event.countDocuments({ status: 'pending' });
    const rejectedEvents = await Event.countDocuments({ status: 'rejected' });
    const cancelledEvents = await Event.countDocuments({ status: 'cancelled' });
    
    const eventsByStatus = await Event.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const eventsByCategory = await Event.aggregate([
      { $unwind: '$categories' },
      {
        $group: {
          _id: '$categories',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    const recentEvents = await Event.find()
      .populate('organizer', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Thống kê tổng số vé đã bán
    const ticketStats = await Event.aggregate([
      { $unwind: '$ticketTypes' },
      {
        $group: {
          _id: null,
          totalSold: { $sum: '$ticketTypes.sold' },
          totalRevenue: { $sum: { $multiply: ['$ticketTypes.sold', '$ticketTypes.price'] } }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalEvents,
        approvedEvents,
        pendingEvents,
        rejectedEvents,
        cancelledEvents,
        eventsByStatus,
        eventsByCategory,
        recentEvents,
        ticketStats: ticketStats[0] || { totalSold: 0, totalRevenue: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê events',
      error: error.message
    });
  }
};

// ==================== TICKET MANAGEMENT FUNCTIONS ====================

// Lấy danh sách tất cả vé (có phân trang và filter)
const getAllTickets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter options
    const { eventId, status, ticketType, ownerId, search } = req.query;
    
    const filter = {};
    
    // Filter theo event
    if (eventId) {
      filter.event = eventId;
    }
    
    // Filter theo status
    if (status) {
      filter.status = status;
    }
    
    // Filter theo ticketType
    if (ticketType) {
      filter.ticketType = ticketType;
    }
    
    // Filter theo owner
    if (ownerId) {
      filter.owner = ownerId;
    }
    
    // Tìm kiếm theo QR code
    if (search) {
      filter.qrCode = new RegExp(search, 'i');
    }
    
    const tickets = await Ticket.find(filter)
      .populate('event', 'title startDate endDate venue')
      .populate('owner', 'name email phone')
      .populate('order', 'orderNumber totalAmount status')
      .sort({ purchasedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTickets = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(totalTickets / limit);
    
    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          currentPage: page,
          totalPages,
          totalTickets,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách vé',
      error: error.message
    });
  }
};

// Lấy thông tin chi tiết một vé
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = await Ticket.findById(id)
      .populate('event', 'title startDate endDate venue description posterUrl')
      .populate('owner', 'name email phone avatarUrl')
      .populate('order', 'orderNumber totalAmount status paymentMethod');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vé'
      });
    }
    
    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin vé',
      error: error.message
    });
  }
};

// Lấy danh sách vé theo event
const getTicketsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Kiểm tra event có tồn tại không
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sự kiện'
      });
    }
    
    const filter = { event: eventId };
    
    // Filter theo status nếu có
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Filter theo ticketType nếu có
    if (req.query.ticketType) {
      filter.ticketType = req.query.ticketType;
    }
    
    const tickets = await Ticket.find(filter)
      .populate('owner', 'name email phone')
      .populate('order', 'orderNumber totalAmount status')
      .sort({ purchasedAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalTickets = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(totalTickets / limit);
    
    res.status(200).json({
      success: true,
      data: {
        event: {
          _id: event._id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue
        },
        tickets,
        pagination: {
          currentPage: page,
          totalPages,
          totalTickets,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách vé theo sự kiện',
      error: error.message
    });
  }
};

// Thống kê vé tổng quan
const getTicketStats = async (req, res) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const validTickets = await Ticket.countDocuments({ status: 'valid' });
    const usedTickets = await Ticket.countDocuments({ status: 'used' });
    const cancelledTickets = await Ticket.countDocuments({ status: 'cancelled' });
    const refundedTickets = await Ticket.countDocuments({ status: 'refunded' });
    
    // Thống kê theo status
    const ticketsByStatus = await Ticket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Thống kê theo loại vé
    const ticketsByType = await Ticket.aggregate([
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Thống kê theo sự kiện
    const ticketsByEvent = await Ticket.aggregate([
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventInfo'
        }
      },
      { $unwind: '$eventInfo' },
      {
        $group: {
          _id: '$event',
          eventTitle: { $first: '$eventInfo.title' },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Thống kê theo tháng
    const ticketsByMonth = await Ticket.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$purchasedAt' },
            month: { $month: '$purchasedAt' }
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);
    
    // Vé gần đây nhất
    const recentTickets = await Ticket.find()
      .populate('event', 'title')
      .populate('owner', 'name email')
      .sort({ purchasedAt: -1 })
      .limit(10);
    
    // Tổng doanh thu
    const totalRevenue = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$pricePaid' }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalTickets,
        validTickets,
        usedTickets,
        cancelledTickets,
        refundedTickets,
        ticketsByStatus,
        ticketsByType,
        ticketsByEvent,
        ticketsByMonth,
        recentTickets,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê vé',
      error: error.message
    });
  }
};

// Thống kê vé theo sự kiện cụ thể
const getTicketStatsByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Kiểm tra event có tồn tại không
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sự kiện'
      });
    }
    
    const totalTickets = await Ticket.countDocuments({ event: eventId });
    const validTickets = await Ticket.countDocuments({ event: eventId, status: 'valid' });
    const usedTickets = await Ticket.countDocuments({ event: eventId, status: 'used' });
    const cancelledTickets = await Ticket.countDocuments({ event: eventId, status: 'cancelled' });
    const refundedTickets = await Ticket.countDocuments({ event: eventId, status: 'refunded' });
    
    // Thống kê theo loại vé trong sự kiện
    const ticketsByType = await Ticket.aggregate([
      { $match: { event: eventId } },
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricePaid' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Thống kê theo status trong sự kiện
    const ticketsByStatus = await Ticket.aggregate([
      { $match: { event: eventId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Tổng doanh thu của sự kiện
    const totalRevenue = await Ticket.aggregate([
      { $match: { event: eventId } },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricePaid' }
        }
      }
    ]);
    
    // So sánh với capacity của event
    const capacityUtilization = event.capacity > 0 ? (totalTickets / event.capacity) * 100 : 0;
    
    res.status(200).json({
      success: true,
      data: {
        event: {
          _id: event._id,
          title: event.title,
          capacity: event.capacity,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue
        },
        totalTickets,
        validTickets,
        usedTickets,
        cancelledTickets,
        refundedTickets,
        ticketsByType,
        ticketsByStatus,
        totalRevenue: totalRevenue[0]?.total || 0,
        capacityUtilization: Math.round(capacityUtilization * 100) / 100
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê vé theo sự kiện',
      error: error.message
    });
  }
};

// Cập nhật trạng thái vé (admin có thể cancel hoặc refund vé)
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    const ticket = await Ticket.findById(id)
      .populate('event', 'title')
      .populate('owner', 'name email');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy vé'
      });
    }
    
    // Kiểm tra status hợp lệ
    const validStatuses = ['valid', 'used', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái vé không hợp lệ'
      });
    }
    
    // Không cho phép chuyển từ used về valid
    if (ticket.status === 'used' && status === 'valid') {
      return res.status(400).json({
        success: false,
        message: 'Không thể chuyển vé đã sử dụng về trạng thái hợp lệ'
      });
    }
    
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      { 
        status,
        ...(reason && { adminNote: reason })
      },
      { new: true }
    ).populate('event', 'title')
     .populate('owner', 'name email')
     .populate('order', 'orderNumber');
    
    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái vé thành công',
      data: updatedTicket
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái vé',
      error: error.message
    });
  }
};

module.exports = {
  // User management
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserPassword,
  deleteUser,
  getUserStats,
  
  // Event management
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
  getEventStats,
  
  // Ticket management
  getAllTickets,
  getTicketById,
  getTicketsByEvent,
  getTicketStats,
  getTicketStatsByEvent,
  updateTicketStatus
};
