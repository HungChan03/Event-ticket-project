const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserPassword,
  deleteUser,
  getUserStats,
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  approveEvent,
  rejectEvent,
  cancelEvent,
  deleteEvent,
  getEventStats
} = require('../controllers/adminController');

// Middleware để kiểm tra quyền admin (tạm thời comment để test)
// const { authenticateAdmin } = require('../middlewares/authMiddleware');

// Áp dụng middleware authentication cho tất cả routes admin (tạm thời comment để test)
// router.use(authenticateAdmin);

// Routes cho quản lý users
router.get('/users', getAllUsers);                    // GET /api/admin/users - Lấy danh sách users
router.get('/users/stats', getUserStats);             // GET /api/admin/users/stats - Thống kê users
router.get('/users/:id', getUserById);                // GET /api/admin/users/:id - Lấy thông tin user theo ID
router.post('/users', createUser);                     // POST /api/admin/users - Tạo user mới
router.put('/users/:id', updateUser);                  // PUT /api/admin/users/:id - Cập nhật thông tin user
router.patch('/users/:id/password', changeUserPassword); // PATCH /api/admin/users/:id/password - Đổi mật khẩu user
router.delete('/users/:id', deleteUser);              // DELETE /api/admin/users/:id - Xóa user

// Routes cho quản lý events
router.get('/events', getAllEvents);                   // GET /api/admin/events - Lấy danh sách events
router.get('/events/stats', getEventStats);            // GET /api/admin/events/stats - Thống kê events
router.get('/events/:id', getEventById);               // GET /api/admin/events/:id - Lấy thông tin event theo ID
router.post('/events', createEvent);                   // POST /api/admin/events - Tạo event mới
router.put('/events/:id', updateEvent);                // PUT /api/admin/events/:id - Cập nhật thông tin event
router.patch('/events/:id/approve', approveEvent);     // PATCH /api/admin/events/:id/approve - Duyệt event
router.patch('/events/:id/reject', rejectEvent);       // PATCH /api/admin/events/:id/reject - Từ chối event
router.patch('/events/:id/cancel', cancelEvent);       // PATCH /api/admin/events/:id/cancel - Hủy event
router.delete('/events/:id', deleteEvent);             // DELETE /api/admin/events/:id - Xóa event

module.exports = router;
