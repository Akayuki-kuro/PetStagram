const { jwtVerify } = require('jose');
const User = require('../models/user');

exports.requireAuth = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return res.redirect('/auth/login');
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(accessToken, secret);
      
      const user = await User.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }

      req.user = user;
      res.locals.user = user;
      next();
    } catch (error) {
      // If access token is invalid, try to use refresh token
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.redirect('/auth/login');
      }

      const user = await User.findOne({ refreshToken });
      if (!user || !user.verifyRefreshToken(refreshToken)) {
        return res.redirect('/auth/login');
      }

      // Generate new access token
      const newAccessToken = await user.generateToken();
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      req.user = user;
      res.locals.user = user;
      next();
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.redirect('/auth/login');
  }
};

// Add a new middleware to set user for all routes
exports.setUser = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (accessToken) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(accessToken, secret);
      const user = await User.findById(payload.sub);
      if (user) {
        req.user = user;
        res.locals.user = user;
      }
    }
  } catch (error) {
    // Silently fail and continue without user
    console.error('Set user middleware error:', error);
  }
  // Always ensure user is set in res.locals, even if null
  res.locals.user = req.user || null;
  next();
};
