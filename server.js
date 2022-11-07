'use strict';

const port = 3000;
let fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { CLIENT_RENEG_LIMIT } = require('tls');
const app = express();

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
    console.log('Received connection');

    socket.on('create', () => {
        let roomID = uuidv4();
        socket.join(roomID);
        socket.emit('created', roomID);
        allClients.push(socket);
    });

    socket.on('join', room => {
        console.log(room);

        //count number of users on room (may be undefined)
        let myRoom = io.sockets.adapter.rooms.get(room);
        if (myRoom) {
            //if room exists
            socket.join(room);
            socket.emit('joined', room);
            allClients.push(socket);
        } else {
            //if room does not exist
            socket.emit('roomnotfound', room);
        }
    });

    //disconnecting event when any client dc's, informing the rest
    socket.on('disconnecting', () => {
        allClients.forEach(socket => {
            socket.emit('peerDisconnected');
        });
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

app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https')
        // the statement for performing our redirection
        return res.redirect('https://' + req.headers.host + req.url);
    else return next();
});

https.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});
