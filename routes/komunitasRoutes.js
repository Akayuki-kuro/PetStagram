const express = require('express');
const router = express.Router();
const komunitasController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/authMiddleware');

// Main komunitas page
router.get('/', requireAuth, komunitasController.getKomunitas);

// Chat message routes
router.post('/messages', requireAuth, komunitasController.createMessage);
router.get('/messages', requireAuth, komunitasController.getMessages);
router.delete('/messages/:messageId', requireAuth, komunitasController.deleteMessage);

module.exports = router;
