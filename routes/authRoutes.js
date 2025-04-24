const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Login
router.get('/login', authController.showLogin);
router.post('/login', authController.login);

// Register
router.get('/register', authController.showRegister);
router.post('/register', authController.register);

// Logout
router.get('/logout', requireAuth, authController.logout);

// Refresh token
router.post('/refresh', authController.refresh);

module.exports = router;
