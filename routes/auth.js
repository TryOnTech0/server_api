const express = require('express');
const { check } = require('express-validator');
const { login, register, getMe, logout, deleteUser } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Define routes
router.post(
  '/register',
  [
    check('username', 'Please include a username (3-20 characters)')
      .not().isEmpty()
      .isLength({ min: 3, max: 20 }),
    check('password', 'Please enter a password with 6 or more characters')
      .isLength({ min: 6 })
  ],
  register
);

router.post(
  '/login',
  [
    check('username', 'Please include a username').not().isEmpty(),
    check('password', 'Password is required').exists()
  ],
  login
);

router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.delete('/me', protect, deleteUser);

// Export the router
module.exports = router;
