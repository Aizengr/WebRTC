'use strict';

const express = require('express');
const app = express();
let http = require('http').Server(app);
let io = require('socket.io')(http);

//static hosting using express
app.use(express.static('public'));

//signal handlers
io.on('connection', socket => {
    console.log('a user connected');

    socket.on('create or join', room => {
        console.log(`create or join to room ${room}`);

        //count number of users on room
        let myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
        let numClients = myRoom.length;
        console.log(`room: ${room} has ${numClients} clients`);

        if (numClients === 0) {
            socket.join(room); //if 0 then joins and sends created
            socket.emit('created', room);
        } else if (numClients === 1) {
            //if there is already a user in the room, joins and sends joined
            socket.join('room');
            socket.emit('joined', room);
        } else {
            socket.emit('full', room); //full room CHANGE
        }
    });

    //relay only handlers
    socket.on('ready', room => {
        socket.broadcast.to(room).emit('ready');
    });

    socket.on('candidate', event => {
        socket.broadcast.to(event.room).emit('candidate', event);
    });

    socket.on('offer', event => {
        socket.broadcast.to(event.room).emit('offer', event.sdp);
    });

    socket.on('answer', event => {
        socket.broadcast.to(event.room).emit('answer', event.sdp);
    });
});

http.listen(3000, () => {
    console.log('listening on:3000');
});
