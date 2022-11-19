'use strict';

const port = 3000;
let fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const { CLIENT_RENEG_LIMIT } = require('tls');
const { REPL_MODE_SLOPPY } = require('repl');
const app = express();

//keeping all client objects
const allClients = new Map();

const httpsOptions = {
    key: fs.readFileSync('./backend/security/cert.key'),
    cert: fs.readFileSync('./backend/security/cert.pem'),
};

let https = require('https').Server(httpsOptions, app);
let io = require('socket.io')(https);

//static hosting using express
app.use(express.static('public'));

//checking if username within a room exists
function usernameCheck(room, username) {
    let result = true;
    allClients.get(room).forEach(client => {
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

        //new set containing client objects for each room on the Map
        let roomSet = new Set();

        let client = {
            username: username,
            socketID: socket.id,
        };
        roomSet.add(client);
        console.log(
            'CREATE REQUEST - Socket: ' +
                client.socketID +
                ' - Username: ' +
                client.username
        );
        allClients.set(roomID, roomSet);
    });

    socket.on('join', (room, username) => {
        console.log(
            'JOIN REQUEST - Socket: ' + socket.id + ' - Username: ' + username
        );
        let myRoom = io.sockets.adapter.rooms.get(room);
        if (myRoom) {
            if (usernameCheck(room, username)) {
                //if username does not exist
                let client = {
                    username: username,
                    socketID: socket.id,
                };

                //finding roomID on Map and updating its Set
                allClients.get(room).add(client);

                socket.join(room);
                socket.emit('joined', room);
            } else {
                io.to(socket.id).emit('usernametaken');
            }
        } else {
            //if room does not exist
            socket.emit('roomnotfound', room);
        }
    });

    //disconnect event when any client dc's, informing the rest
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (allClients.has(room)) {
                if (allClients.get(room).size > 1) {
                    let dcedPeer;
                    allClients.get(room).forEach(client => {
                        if (client.socketID === socket.id) {
                            dcedPeer = client;
                        }
                    });
                    socket.to(room).emit('peerDisconnected', dcedPeer.username);
                    allClients.get(room).delete(dcedPeer);
                } else {
                    allClients.get(room).clear();
                }
            }
        });
    });

    socket.on('disconnect', reason => {
        console.log(
            `Socket: ${socket.id} disconnected due to reason: ${reason}`
        );
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
    let destUser;
    allClients.get(event.room).forEach(client => {
        if (client.username === event.to) destUser = client;
    });
    return destUser.socketID;
}

https.listen(port, () => {
    console.log(`Server running at port: ${port}`);
});
