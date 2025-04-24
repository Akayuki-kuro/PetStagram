const mongoose = require('mongoose');
const { SignJWT } = require('jose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    match: [/^\S+@\S+\.\S+$/, 'Email tidak valid'] 
  },
  password: { 
    type: String, 
    required: true, 
    minlength: [6, 'Password minimal 6 karakter'] 
  },
  phone: { type: String },
  address: { type: String },
  photo: { type: String, default: '/uploads/profiles/default.jpg' },
  darkMode: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  refreshToken: { type: String },
  refreshTokenExpiresAt: { type: Date }
});

userSchema.methods.generateToken = async function() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const expirationTime = parseInt(process.env.JWT_EXPIRES_IN || '900', 10);
  
  const token = await new SignJWT({ 
    sub: this._id.toString(),
    username: this.username,
    photo: this.photo
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirationTime)
    .sign(secret);

  return token;
};

userSchema.methods.generateRefreshToken = async function() {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  this.refreshToken = refreshToken;
  this.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await this.save();
  return refreshToken;
};

userSchema.methods.verifyRefreshToken = function(token) {
  return token === this.refreshToken && 
         this.refreshTokenExpiresAt > new Date();
};

module.exports = mongoose.model('User', userSchema);
