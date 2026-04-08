const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow any origin for Vue
    methods: ["GET", "POST"]
  }
});

// In-memory store: Maps userId (String) -> socket.id (String)
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // When frontend sends its user ID
  socket.on('register_user', (userId) => {
    if (userId) {
      userSockets.set(userId.toString(), socket.id);
      console.log(`User ID [${userId}] mapped to socket [${socket.id}]`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Remove disconnected socket from the map
    userSockets.forEach((value, key) => {
      if (value === socket.id) {
        userSockets.delete(key);
      }
    });
  });
});

// Internal API called by Spring Boot Backend
app.post('/api/notify', (req, res) => {
  const { recipientId, type, data } = req.body;
  console.log(`[API Trigger] Received push notification for user: ${recipientId}, type: ${type}`);

  if (!recipientId) {
    return res.status(400).json({ error: 'recipientId is required' });
  }

  const socketId = userSockets.get(recipientId.toString());
  
  if (socketId) {
    // Push event only to this specific user's active socket
    io.to(socketId).emit('notification', { type, data });
    console.log(`[Sent] Emitted event to user ${recipientId} via socket ${socketId}`);
    res.status(200).json({ success: true, delivered: true, message: 'Notification delivered' });
  } else {
    // User is offline or not currently on the page
    console.log(`[Offline] User ${recipientId} is not connected.`);
    res.status(200).json({ success: true, delivered: false, message: 'User is offline' });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎯 Real-Time Socket Server running on port ${PORT}`);
  console.log(`===============================================`);
});
