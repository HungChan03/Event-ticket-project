const User = require('../models/User');
const Event = require('../models/Event');
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
        { email: searchRegex },
        { customId: searchRegex }
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
  getEventStats
};
