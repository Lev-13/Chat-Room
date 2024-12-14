const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const rooms = {}; 

app.get('/', (req, res) => {
  res.render('index', { rooms });
});

app.post('/room', (req, res) => {
  const roomName = req.body.room;
  if (rooms[roomName] != null) {
    return res.redirect(`/${roomName}`);
  }
  rooms[roomName] = { users: {} }; 
  res.redirect(`/${roomName}`);
  io.emit('room-created', roomName); 
});

app.get('/:room', (req, res) => {
  const roomName = req.params.room;
  if (rooms[roomName] == null) {
    return res.redirect('/');
  }
  res.render('room', { roomName });
});

io.on('connection', socket => {
  socket.on('new-user', (room, name) => {
    if (!rooms[room]) {
      console.error(`Room "${room}" does not exist.`);
      return; 
    }

    socket.join(room); 
    rooms[room].users[socket.id] = name; 
    console.log(`${name} joined room: ${room}`);
    socket.to(room).emit('user-connected', name); 
  });

  socket.on('send-chat-message', (room, message) => {
    if (!rooms[room] || !rooms[room].users[socket.id]) {
      console.error(`Invalid room or user not in room: ${room}`);
      return;
    }
    socket.to(room).emit('chat-message', {
      message,
      name: rooms[room].users[socket.id]
    });
  });

  socket.on('disconnect', () => {
    const userRooms = getUserRooms(socket); 
    userRooms.forEach(room => {
      socket.to(room).emit('user-disconnected', rooms[room].users[socket.id]); // Notify others
      delete rooms[room].users[socket.id]; 
    });
  });
});

function getUserRooms(socket) {
  return Object.entries(rooms).reduce((acc, [roomName, room]) => {
    if (room.users[socket.id]) {
      acc.push(roomName); 
    }
    return acc;
  }, []);
}

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
