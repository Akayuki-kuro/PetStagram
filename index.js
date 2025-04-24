require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const { setUser } = require('./middleware/authMiddleware');
const ChatMessage = require('./models/ChatMessage');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Debugging & koneksi MongoDB
mongoose.set('debug', true);
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  ssl: true,
  retryWrites: true,
  w: 1
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => console.log('MongoDB Disconnected'));
mongoose.connection.on('error', err => console.error('MongoDB Error:', err));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'"]
    }
  }
}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session store di MongoDB
app.use(session({
  secret: process.env.JWT_SECRET || 'rahasia-kucing',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true, w: 1 }
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Inject user ke setiap template
app.use(setUser);

// Redirect legacy
app.get('/login',    (req, res) => res.redirect('/auth/login'));
app.get('/register', (req, res) => res.redirect('/auth/register'));

// Routes
app.use('/auth',      require('./routes/authRoutes'));
app.use('/posts',     require('./routes/postRoutes'));
app.use('/komunitas', require('./routes/komunitasRoutes'));
app.use('/profile',   require('./routes/profileRoutes'));
app.use('/',          require('./routes/indexRoutes'));

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server);

const activeUsers = new Map();

// Socket.IO event handling
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('user connected', user => {
    activeUsers.set(socket.id, user);
    io.emit('active users', Array.from(activeUsers.values()));
  });

  // Restore the correct handler for messages sent from the client
  socket.on('send message', async msg => {
    console.log(`[Socket ${socket.id}] Received 'send message' event with data:`, msg);
    console.time(`[Socket ${socket.id}] Message Handling`); // Start timer
    try {
      // Validate incoming message data
      if (!msg || typeof msg.text !== 'string' || !msg.user || typeof msg.user.id !== 'string') {
        console.error(`[Socket ${socket.id}] Invalid message format received:`, msg);
        socket.emit('error', { message: 'Invalid message format.' });
        console.timeEnd(`[Socket ${socket.id}] Message Handling`); // End timer on error
        return;
      }

      const text = msg.text.trim();
      if (!text) {
        console.log(`[Socket ${socket.id}] Ignoring empty message.`);
        console.timeEnd(`[Socket ${socket.id}] Message Handling`); // End timer if empty
        return;
      }

      console.log(`[Socket ${socket.id}] Attempting to save message:`, { text, user: msg.user });
      console.time(`[Socket ${socket.id}] Database Save`); // Start DB timer
      // Create and save chat message
      const chat = new ChatMessage({
        message: text, // Use the validated & trimmed text
        user: {
          id: msg.user.id,
          username: msg.user.username,
          photo: msg.user.photo // Ensure photo is saved
        }
      });
      await chat.save();
      console.timeEnd(`[Socket ${socket.id}] Database Save`); // End DB timer
      console.log(`[Socket ${socket.id}] Message saved successfully with ID:`, chat._id);

      const broadcastData = {
        _id: chat._id, // Include the generated ID
        message: text, // Broadcast the processed text
        user: {
            id: msg.user.id,
            username: msg.user.username,
            photo: msg.user.photo // Ensure photo is included in broadcast
        },
        createdAt: chat.createdAt // Include the server-generated timestamp
      };
      console.log(`[Socket ${socket.id}] Broadcasting 'chat message' event with data:`, broadcastData);
      console.time(`[Socket ${socket.id}] Broadcast Emit`); // Start broadcast timer
      // Broadcast the saved message to all connected clients
      io.emit('chat message', broadcastData);
      console.timeEnd(`[Socket ${socket.id}] Broadcast Emit`); // End broadcast timer
    } catch (err) {
      console.error(`[Socket ${socket.id}] Error processing send message event:`, err);
      // Inform the sending client about the error
      socket.emit('error', { message: 'Failed to send message due to a server error.' });
    } finally {
        console.timeEnd(`[Socket ${socket.id}] Message Handling`); // End overall timer
    }
  });

  // Handle typing events
  socket.on('user typing', (user) => {
    // Basic validation
    if (user && user.id) {
      socket.broadcast.emit('user typing', user);
    }
  });

  socket.on('user stopped typing', (user) => {
    // Basic validation
    if (user && user.id) {
       socket.broadcast.emit('user stopped typing', user);
    }
  });

  // Handle message deletion
  socket.on('message deleted', (messageId) => {
     // Basic validation
    if (messageId) {
      socket.broadcast.emit('message deleted', messageId);
    }
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    io.emit('active users', Array.from(activeUsers.values()));
    console.log('User disconnected:', socket.id);
  });
});

// Start server dengan fallback port jika konflik
const startServer = async port => {
  try {
    server.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, retrying on ${port+1}`);
      return startServer(port+1);
    }
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer(PORT);
