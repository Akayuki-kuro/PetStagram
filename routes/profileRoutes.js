const express = require('express');
const router = express.Router();
const User = require('../models/user');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/authMiddleware');

// Create uploads directory if it doesn't exist
const uploadDir = 'public/uploads/profiles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Hanya file gambar yang diperbolehkan (JPEG, PNG, GIF)'));
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return cb(new Error('Ukuran file maksimal 5MB'));
    }
    cb(null, true);
  }
});

// Routes for profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/auth/login');
    }
    res.render('profile', { user, success: false });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/auth/login');
  }
});

router.post('/update', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { name, email, phone, address, darkMode } = req.body;
    const updateData = { 
      name, 
      email, 
      phone, 
      address,
      darkMode: darkMode === 'on'
    };
    
    if (req.file) {
      updateData.photo = `/uploads/profiles/${req.file.filename}`;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id, 
      updateData, 
      { new: true }
    );

    // Generate new tokens with updated user data
    const accessToken = await user.generateToken();
    const refreshToken = await user.generateRefreshToken();

    // Set new cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.redirect('/profile');
  } catch (err) {
    console.error('Profile update error:', err);
    res.render('profile', { user: req.user, success: false });
  }
});

// Theme toggle endpoint
router.post('/theme', requireAuth, async (req, res) => {
  try {
    const { darkMode } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { darkMode },
      { new: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Theme toggle error:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

module.exports = router;
