'use strict';
var path = require('path');
var os = require('os');
var http = require('http');
var express = require('express');
const app = express();
var server = http.createServer(app);
const port = process.env.PORT || 80;
var io = require('socket.io')(server);
app.use(express.static(__dirname));

const max_peers = 5

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/index.html'));
});

server.listen(port, ()=>{
  console.log(`Example app listening on port ${port}`)
})

io.sockets.on('connection', function(socket) {

  socket.on('message', function(message, room, to_socket_id) {
    console.log('Client said: ', message);
    socket.in(room).emit('message', message, socket.id, to_socket_id);
  });
  socket.on('create or join', function(room) {
    console.log('Received request to create or joining room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms.get(room);
    //console.log(Object.keys(clientsInRoom.sockets).length)
    var numClients = clientsInRoom ? clientsInRoom.size : 0;
    console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      console.log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients > 0 && numClients < max_peers) {
      console.log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room, socket.id);
      socket.join(room);
      io.sockets.in(room).emit("socket_list", Array.from(clientsInRoom).filter((value)=>value!=socket.id));
      console.log(Array.from(clientsInRoom).filter((value)=>value==socket.id));
      socket.emit('joined', room, socket.id);
      //io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
