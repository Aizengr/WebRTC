'use strict';

const port = 3000;
let fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { CLIENT_RENEG_LIMIT } = require('tls');
const { REPL_MODE_SLOPPY } = require('repl');
const app = express();

//keeping all client objects
const allClients = [];

const httpsOptions = {
    key: fs.readFileSync('./backend/security/cert.key'),
    cert: fs.readFileSync('./backend/security/cert.pem'),
};

let https = require('https').Server(httpsOptions, app);
let io = require('socket.io')(https);

//static hosting using express
app.use(express.static('public'));

//signal handlers
io.on('connection', socket => {
    socket.on('create', username => {
        let roomID = uuidv4();
        socket.join(roomID);
        socket.emit('created', roomID);

        let client = {
            username: username,
            socket: socket,
            roomID: roomID,
        };
        console.log(
            'CREATE REQUEST - Socket: ' +
                client.socket.id +
                ' - Username: ' +
                client.username
        );
        allClients.push(client);
    });

    socket.on('join', (room, username) => {
        console.log(
            'JOIN REQUEST - Socket: ' + socket.id + ' - Username: ' + username
        );

        //count number of users on room (may be undefined)
        let myRoom = io.sockets.adapter.rooms.get(room);
        if (myRoom) {
            //if room exists
            let client = {
                username: username,
                socket: socket,
                roomID: room,
            };
            socket.join(room);
            socket.emit('joined', room);
            allClients.push(client);
        } else {
            //if room does not exist
            socket.emit('roomnotfound', room);
        }
    });

    //disconnect event when any client dc's, informing the rest
    socket.on('disconnect', () => {
        console.log('User disconnected from socket: ' + socket.id);
        if (allClients.length != 0) {
            let dcedPeer = allClients.filter(client => {
                console.log('Client: ' + client.socket.id);
                return client.socket.id === socket.id;
            });
            socket
                .to(dcedPeer[0].roomID)
                .emit('peerDisconnected', dcedPeer[0].username);
            //removing disconnected peer
            allClients.splice(allClients.indexOf(dcedPeer), 1);
        }
    });

    //relay only handlers

    socket.on('ready', (room, username) => {
        console.log(
            'READY REQUEST - Socket: ' + socket.id + ' - Username: ' + username
        );

        socket.to(room).emit('ready', username);
    });

    socket.on('offer', (event, username) => {
        console.log(
            'OFFER REQUEST - Socket: ' + socket.id + ' - Username: ' + username
        );

        socket.to(event.room).emit('offer', event.sdp, username);
    });

    socket.on('candidate', (event, username) => {
        console.log(
            'CANDIDATE REQUEST - Socket: ' +
                socket.id +
                ' - Username: ' +
                username
        );

        socket.to(event.room).emit('candidate', event, username);
    });

    socket.on('answer', (event, username) => {
        console.log(
            'ANSWER REQUEST - Socket: ' + socket.id + ' - Username: ' + username
        );
        socket.to(event.room).emit('answer', event.sdp, username);
    });
});

https.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});
