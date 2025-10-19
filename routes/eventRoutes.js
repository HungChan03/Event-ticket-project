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

// @route   GET /api/events
// @desc    Lấy danh sách sự kiện (public)
// @access  Public
router.get('/', getEvents);

// @route   GET /api/events/:id
// @desc    Lấy chi tiết sự kiện (public)
// @access  Public
router.get('/:id', getEventById);

// @route   GET /api/events/organizer/my-events
// @desc    Lấy danh sách sự kiện của organizer
// @access  Public (tạm thời)
router.get('/organizer/my-events', getMyEvents);

// @route   GET /api/events/organizer/stats
// @desc    Lấy thống kê sự kiện của organizer
// @access  Public (tạm thời)
router.get('/organizer/stats', getEventStats);

// @route   POST /api/events
// @desc    Tạo sự kiện mới
// @access  Public (tạm thời)
router.post('/', uploadPosterMiddleware, createEvent);

// @route   PUT /api/events/:id
// @desc    Cập nhật sự kiện
// @access  Public (tạm thời)
router.put('/:id', uploadPosterMiddleware, updateEvent);

// @route   DELETE /api/events/:id
// @desc    Xóa sự kiện
// @access  Public (tạm thời)
router.delete('/:id', deleteEvent);

module.exports = router;