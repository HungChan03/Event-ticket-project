const express = require('express');
const router = express.Router();

// MoMo payment controllers
const {
  createMomoPayment,
  momoReturn,
  momoIPN,
  createOrder,
  payOrderWithMomo,
  cancelOrderForUser,
  getMyOrders,
  getMyOrderById,
  updateOrderForUser,
} = require('../controllers/orderController');
const { requireAuth } = require('../middlewares/authMiddleware');

// List my orders (owner)
router.get('/', requireAuth, getMyOrders);

// Create order (requires user auth)
router.post('/', requireAuth, createOrder);

// Cancel order (user) - POST /api/v1/orders/:id/cancel
router.post('/:id/cancel', requireAuth, cancelOrderForUser);

// Get my order by id (owner)
router.get('/:id', requireAuth, getMyOrderById);

// Update my order (owner, before payment/completion)
router.put('/:id', requireAuth, updateOrderForUser);

// MoMo payment routes
router.post('/momo/create', createMomoPayment);
// Pay an existing order (requires user auth)
router.post('/momo/pay', requireAuth, payOrderWithMomo);
router.get('/momo/return', momoReturn);
router.post('/momo/ipn', momoIPN);

module.exports = router;