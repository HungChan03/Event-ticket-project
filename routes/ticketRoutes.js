const express = require('express');
const router = express.Router();

const {
  getMyTickets,
  getTicketById,
  cancelMyTicket,
  checkInByQr,
  listTicketsForEvent,
  getTicketQrImage,
} = require('../controllers/ticketController');
//auth middlewares
const { requireAuth, authenticateOrganizer } = require('../middlewares/authMiddleware');

/**
 * @route   /api/tickets/history
 * @desc    Lấy danh sách (lịch sử) các vé mà người dùng đã mua
 * @access  Private (chỉ người dùng đã đăng nhập)
 */
router.get('/history', requireAuth, getMyTickets);

/**
 * @route   /api/tickets/:id
 * @desc    Xem chi tiết vé theo ID
 * @access  Private (chỉ người dùng có vé đó)
 */
router.get('/:id', requireAuth, getTicketById);

/**
 * @route   /api/tickets/:id/qr
 * @desc    Lấy ảnh QR code của vé
 * @access  Private (chỉ người dùng có vé đó)
 */
router.get('/:id/qr', requireAuth, getTicketQrImage);

/**
 * @route   /api/tickets/:id/cancel
 * @desc    Người dùng hủy vé của mình (chuyển trạng thái "canceled")
 * @access  Private
 */
router.post('/:id/cancel', requireAuth, cancelMyTicket);

/**
 * @route   /api/tickets/event/:eventId
 * @desc    Lấy danh sách tất cả vé của một sự kiện (chỉ dành cho Organizer)
 * @access  Private (Organizer only)
 */
router.get('/event/:eventId', requireAuth, authenticateOrganizer, listTicketsForEvent);

/**
 * @route   /api/tickets/checkin
 * @desc    Check-in bằng cách quét QR code (Organizer xác thực người tham dự)
 * @access  Private (Organizer only)
 */
router.post('/checkin', requireAuth, authenticateOrganizer, checkInByQr);

module.exports = router;