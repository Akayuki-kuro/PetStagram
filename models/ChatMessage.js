const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  user: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    photo: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
