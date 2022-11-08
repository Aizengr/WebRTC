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

//checking if username within a room exists
function usernameCheck(socket, room, username) {
    console.log(socket.id, room, username);

    let roomClients = allClients.filter(client => client.roomID === room);
    let result = true;
    roomClients.forEach(client => {
        console.log('FOUND -> ' + client.username);
        if (client.username.toUpperCase() === username.toUpperCase()) {
            console.log('denied');
            result = false;
        }
    });
    return result;
}

//signal handlers
io.on('connection', socket => {
    socket.on('create', username => {
        username = username.trim();
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
        console.log(usernameCheck(socket, room, username));

        if (usernameCheck(socket, room, username)) {
            //if username does not exist
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
        } else {
            io.to(socket.id).emit('usernametaken');
        }
    });

    //disconnect event when any client dc's, informing the rest
    socket.on('disconnect', () => {
        console.log('User disconnected from socket: ' + socket.id);
        if (allClients.length > 1) {
            //
            let dcedPeer = allClients.filter(client => {
                console.log('All clients => ' + client.socket.id);
                return client.socket.id === socket.id;
            });
            //emiting dc event
            if (!dcedPeer === 'undefined') {
                //avoiding issues with connections made in the middle of server downtime
                socket
                    .to(dcedPeer[0].roomID)
                    .emit('peerDisconnected', dcedPeer[0].username);
                //removing disconnected peer
                console.log('Removing ' + allClients.indexOf(dcedPeer));

                allClients.splice(allClients.indexOf(dcedPeer), 1);
            }
        }
    });

    socket.on('disconnecting', reason => {
        console.log('Reason ---' + reason);
    });
    //relay only handlers
    //ready is emmited to the whole room
    socket.on('ready', (room, username) => {
        socket.to(room).emit('ready', username);
    });

    socket.on('offer', event => {
        //finding the exact user for which the offer is send
        let destSocket = findDestSocketID(event);
        //sending the offer ONLY to that user
        io.to(destSocket).emit('offer', event.sdp, event.from);
    });

    socket.on('candidate', event => {
        let destSocket = findDestSocketID(event);
        io.to(destSocket).emit('candidate', event, event.from);
    });

    socket.on('answer', event => {
        let destSocket = findDestSocketID(event);
        io.to(destSocket).emit('answer', event.sdp, event.from);
    });
});

function findDestSocketID(event) {
    let destUser = allClients.filter(client => client.username === event.to);
    return destUser[0].socket.id;
}

https.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});
