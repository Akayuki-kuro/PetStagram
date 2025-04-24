const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { requireAuth } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Setup multer untuk upload gambar postingan
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF)'));
    }
    cb(null, true);
  }
});

// Routes for posts
router.get('/', requireAuth, postController.getPosts);
router.post('/create', requireAuth, upload.single('image'), postController.createPost);
router.get('/delete/:postId', requireAuth, postController.deletePost);
router.get('/edit/:postId', requireAuth, postController.editPostForm);
router.post('/edit/:postId', requireAuth, postController.updatePost);

// Route untuk form membuat postingan baru
router.get('/new', requireAuth, (req, res) => {
  res.render('newpost', { 
    user: req.session.user, 
    error: null,
    title: 'Buat Postingan | Petstagram'  // Add title
  });
});

// Like/Unlike route
router.post('/:postId/like', requireAuth, postController.toggleLike);

// Comment routes
router.post('/:postId/comment', requireAuth, postController.addComment);
router.delete('/:postId/comment/:commentId', requireAuth, postController.deleteComment);

// Share route
router.post('/:postId/share', requireAuth, postController.sharePost);

// Get individual post
router.get('/:postId', requireAuth, postController.getPost);

module.exports = router;
