/**
 * Event Routes - Định nghĩa các endpoints API cho Event Management
 * 
 * Kiến trúc:
 * - Route Layer: Định nghĩa endpoints và gắn middleware
 * - Middleware Pipeline: auth → organizer auth → upload → validation → controller
 * 
 * Quy luật hoạt động:
 * - Public endpoints: Không cần authentication (GET /events, GET /events/:id)
 * - Organizer endpoints: Cần authentication và role = 'organizer' hoặc 'admin' (POST, PUT, DELETE, GET /my-events, GET /my-stats)
 * - Admin endpoints: Cần authentication và role = 'admin' (GET /admin/all)
 */

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
const { requireAuth, optionalAuth, authenticateAdmin, authenticateOrganizer } = require('../middlewares/authMiddleware');

// @route   GET /api/events
// @desc    Lấy danh sách sự kiện (public)
// @access  Public
router.get('/', getEvents);

// @route   GET /api/events/admin/all
// @desc    Lấy tất cả sự kiện (admin)
// @access  Private (Admin)
router.get('/admin/all', requireAuth, authenticateAdmin, getEvents);

// @route   GET /api/events/my-events
// @desc    Lấy danh sách sự kiện của organizer
// @access  Private (Organizer hoặc Admin)
router.get('/my-events', requireAuth, authenticateOrganizer, getMyEvents);

// @route   GET /api/events/my-stats
// @desc    Lấy thống kê sự kiện của organizer
// @access  Private (Organizer hoặc Admin)
router.get('/my-stats', requireAuth, authenticateOrganizer, getEventStats);

// @route   GET /api/events/:id
// @desc    Lấy chi tiết sự kiện (public)
// @access  Public (với optional auth để kiểm tra quyền xem)
router.get('/:id', optionalAuth, getEventById);

// @route   POST /api/events
// @desc    Tạo sự kiện mới
// @access  Private (Organizer hoặc Admin)
router.post('/', requireAuth, authenticateOrganizer, uploadPosterMiddleware, createEvent);

// @route   PUT /api/events/:id
// @desc    Cập nhật sự kiện
// @access  Private (Organizer hoặc Admin)
router.put('/:id', requireAuth, authenticateOrganizer, uploadPosterMiddleware, updateEvent);

// @route   DELETE /api/events/:id
// @desc    Xóa sự kiện
// @access  Private (Organizer hoặc Admin)
router.delete('/:id', requireAuth, authenticateOrganizer, deleteEvent);

module.exports = router;