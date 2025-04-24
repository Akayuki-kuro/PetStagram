const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { requireAuth } = require('../middleware/authMiddleware');

// Homepage
router.get('/', requireAuth, postController.getPosts);

// Tentang
router.get('/tentang', requireAuth, (req, res) => {
  res.render('tentang', { user: req.user });
});

module.exports = router;