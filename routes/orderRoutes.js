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
} = require('../controllers/orderController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Placeholder base route
router.get('/', (req, res) => {
  res.json({ message: 'Order routes' });
});

// Create order (requires user auth)
router.post('/', requireAuth, createOrder);

// Cancel order (user) - POST /api/v1/orders/:id/cancel
router.post('/:id/cancel', requireAuth, cancelOrderForUser);

// MoMo payment routes
router.post('/momo/create', createMomoPayment);
// Pay an existing order (requires user auth)
router.post('/momo/pay', requireAuth, payOrderWithMomo);
router.get('/momo/return', momoReturn);
router.post('/momo/ipn', momoIPN);

module.exports = router;