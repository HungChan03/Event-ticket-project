const express = require('express');
const router = express.Router();

// Placeholder routes for orders
router.get('/', (req, res) => {
  res.json({ message: 'Order routes - Coming soon' });
});

module.exports = router;