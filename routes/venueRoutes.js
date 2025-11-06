const express = require('express');

const {
  createVenue,
  getVenues,
  getVenueById,
  updateVenue,
  deleteVenue,
} = require('../controllers/venueController');
const {
  validateCreateVenue,
  validateUpdateVenue,
  validateVenueQuery,
} = require('../middlewares/venueValidation');
const {
  requireAuth,
  authenticateOrganizer,
} = require('../middlewares/authMiddleware');

const router = express.Router();

// @route   GET /api/v1/venues
// @desc    Lấy danh sách địa điểm với bộ lọc
// @access  Public
router.get('/', validateVenueQuery, getVenues);

// @route   GET /api/v1/venues/:id
// @desc    Lấy chi tiết địa điểm
// @access  Public
router.get('/:id', getVenueById);

// @route   POST /api/v1/venues
// @desc    Tạo địa điểm mới
// @access  Private (Admin)
router.post('/', requireAuth, authenticateOrganizer, validateCreateVenue, createVenue);

// @route   PUT /api/v1/venues/:id
// @desc    Cập nhật địa điểm
// @access  Private (Admin)
router.put('/:id', requireAuth, authenticateOrganizer, validateUpdateVenue, updateVenue);

// @route   DELETE /api/v1/venues/:id
// @desc    Xóa địa điểm
// @access  Private (Admin)
router.delete('/:id', requireAuth, authenticateOrganizer, deleteVenue);

module.exports = router;
