const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getMyEvents,
  getEventStats
} = require('../controllers/eventController');
const { uploadPosterMiddleware } = require('../middlewares/uploadMiddleware');
const { requireAuth, optionalAuth, authenticateAdmin } = require('../middlewares/authMiddleware');

// @route   GET /api/events
// @desc    Lấy danh sách sự kiện (public)
// @access  Public
router.get('/', getEvents);

// @route   GET /api/events/admin/all
// @desc    Lấy tất cả sự kiện (admin)
// @access  Private (Admin)
router.get('/admin/all', requireAuth, authenticateAdmin, getEvents);

// @route   GET /api/events/my-events
// @desc    Lấy danh sách sự kiện của user
// @access  Private (User)
router.get('/my-events', requireAuth, getMyEvents);

// @route   GET /api/events/my-stats
// @desc    Lấy thống kê sự kiện của user
// @access  Private (User)
router.get('/my-stats', requireAuth, getEventStats);

// @route   GET /api/events/:id
// @desc    Lấy chi tiết sự kiện (public)
// @access  Public (với optional auth để kiểm tra quyền xem)
router.get('/:id', optionalAuth, getEventById);

// @route   POST /api/events
// @desc    Tạo sự kiện mới
// @access  Private (User)
router.post('/', requireAuth, uploadPosterMiddleware, createEvent);

// @route   PUT /api/events/:id
// @desc    Cập nhật sự kiện
// @access  Private (User hoặc Admin)
router.put('/:id', requireAuth, uploadPosterMiddleware, updateEvent);

// @route   DELETE /api/events/:id
// @desc    Xóa sự kiện
// @access  Private (User hoặc Admin)
router.delete('/:id', requireAuth, deleteEvent);

module.exports = router;