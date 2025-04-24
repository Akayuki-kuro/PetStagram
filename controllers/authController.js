const User = require('../models/user');
const bcrypt = require('bcrypt');
const { jwtVerify } = require('jose');

exports.showLogin = (req, res) => {
  res.render('login', { error: null });
};

exports.showRegister = (req, res) => {
  res.render('register', { error: null });
};

exports.register = async (req, res) => {
  try {
    const { username, name, email, password } = req.body;
    
    // Validate unique username and email
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.render('register', { 
        error: 'Username atau email sudah digunakan' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      username, 
      name, 
      email, 
      password: hashedPassword 
    });
    
    await user.save();

    // Generate tokens
    const accessToken = await user.generateToken();
    const refreshToken = await user.generateRefreshToken();

    // Set cookies
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

    res.redirect('/');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { error: 'Registrasi gagal. Coba lagi.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Username atau password salah.' });
    }

    // Generate tokens
    const accessToken = await user.generateToken();
    const refreshToken = await user.generateRefreshToken();

    // Set cookies
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

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Terjadi kesalahan saat login.' });
  }
};

exports.logout = async (req, res) => {
  try {
    // Clear user's refresh token in database
    const user = req.user;
    if (user) {
      user.refreshToken = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.redirect('/login');
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/');
  }
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    const user = await User.findOne({ refreshToken });
    if (!user || !user.verifyRefreshToken(refreshToken)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = await user.generateToken();
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
