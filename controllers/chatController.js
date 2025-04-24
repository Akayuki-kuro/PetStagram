const ChatMessage = require('../models/ChatMessage');

exports.getKomunitas = async (req, res) => {
  try {
    // Get last 50 messages
    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.render('komunitas', { 
      user: req.user, 
      messages: messages.reverse(),
      title: 'Komunitas Chat | Petstagram'
    });
  } catch (err) {
    console.error('Error getting chat page:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.createMessage = async (req, res) => {
  try {
    const { text } = req.body;
    
    const message = new ChatMessage({
      message: text,
      user: {
        id: req.user._id,
        username: req.user.username,
        photo: req.user.photo
      }
    });

    await message.save();
    
    // Return the full message with ID
    const populatedMessage = await ChatMessage.findById(message._id).lean();
    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('Error creating message:', err);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json(messages.reverse());
  } catch (err) {
    console.error('Error getting messages:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const message = await ChatMessage.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user.id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await ChatMessage.findByIdAndDelete(req.params.messageId);
    res.json({ success: true, messageId: req.params.messageId });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
