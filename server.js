const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Explicit root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Store recent messages (in-memory, clears on restart for privacy)
const messages = [];
const MAX_MESSAGES = 100;

// Track online users: { odID: username }
const onlineUsers = new Map();

function broadcastUserList() {
  const users = Array.from(onlineUsers.values());
  io.emit('user-list', users);
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Send message history to new connections
  socket.emit('history', messages);

  // Handle user joining with their name
  socket.on('join', (username) => {
    socket.username = username;
    onlineUsers.set(socket.id, username);
    console.log('User joined:', username);

    // Broadcast join announcement
    const announcement = {
      id: Date.now(),
      type: 'announcement',
      text: `${username} has joined the channel`,
      timestamp: new Date().toISOString()
    };
    messages.push(announcement);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    io.emit('announcement', announcement);

    // Send updated user list
    broadcastUserList();
  });

  // Handle new messages
  socket.on('message', (data) => {
    const msg = {
      id: Date.now(),
      user: data.user,
      text: data.text,
      encoded: data.encoded,
      timestamp: new Date().toISOString()
    };

    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    // Broadcast to all connected clients
    io.emit('message', msg);
  });

  // Handle typing indicator
  socket.on('typing', (user) => {
    socket.broadcast.emit('typing', user);
  });

  socket.on('stop-typing', () => {
    socket.broadcast.emit('stop-typing');
  });

  socket.on('disconnect', () => {
    const username = socket.username;
    if (username) {
      onlineUsers.delete(socket.id);
      console.log('User left:', username);

      // Broadcast leave announcement
      const announcement = {
        id: Date.now(),
        type: 'announcement',
        text: `${username} has left the channel`,
        timestamp: new Date().toISOString()
      };
      messages.push(announcement);
      if (messages.length > MAX_MESSAGES) {
        messages.shift();
      }
      io.emit('announcement', announcement);

      // Send updated user list
      broadcastUserList();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SonChat server running on port ${PORT}`);
});
