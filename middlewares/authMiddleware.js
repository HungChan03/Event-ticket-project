const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware để xác thực token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token không được cung cấp'
      });
    }

    // Verify token (cần có JWT_SECRET trong environment)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Lấy thông tin user từ database
    const user = await User.findById(decoded.id)
      .select('-password -resetPasswordToken -resetPasswordExpires');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn'
    });
  }
};

// Middleware để kiểm tra quyền admin
const authenticateAdmin = async (req, res, next) => {
  try {
    // Trước tiên xác thực token
    await authenticateToken(req, res, () => {
      // Kiểm tra role admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập vào trang admin'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực admin',
      error: error.message
    });
  }
};

// Middleware để kiểm tra quyền organizer hoặc admin
const authenticateOrganizer = async (req, res, next) => {
  try {
    await authenticateToken(req, res, () => {
      if (!['admin', 'organizer'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập'
        });
      }
      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực',
      error: error.message
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateAdmin,
  authenticateOrganizer
};
