'use strict';

//html elements
const divSelectRoom = document.getElementById('selectRoom');
const divConsultingRoom = document.getElementById('consultingRoom');
const inputRoomNumber = document.getElementById('roomNumber');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

//GLOBAL

let roomNumber;
let localStream;
let remoteStream;
let rtcPeerConnection;
let isCaller;

//STUN SERVERS

const iceServers = {
    iceServers: [
        { url: 'stun:stun.services.mozzila.com' },
        { url: 'stun:stun.l.google.com:19302' },
    ],
};

let streamConstraints = { audio: true, video: true };

//connecting to socket.io server
const socket = io();

//listener for room button
btnGoRoom.addEventListener('click', e => {
    if (Number.isNaN(Number(inputRoomNumber.value))) {
        alert('Invalid input. Please enter a valid room number.');
    } else {
        roomNumber = Number(inputRoomNumber.value);
        socket.emit('create or join', roomNumber);
        divSelectRoom.style = 'display:none;'; //CHANGE
    }
});

//receiving audio and video stream from others
function onAddStream(event) {
    remoteVideo.srcObject = event.stream;
    remoteStream = event.stream;
}

//sending candidate message to server
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber,
        });
    }
}

//server emits created
socket.on('created', room => {
    navigator.mediaDevices
        .getUserMedia(streamConstraints) //getting media devices
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream; //shows stream
            isCaller = true;
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
});

//server emits joined
socket.on('joined', room => {
    navigator.mediaDevices
        .getUserMedia(streamConstraints)
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream;
            socket.emit('ready', roomNumber); //sends ready to the server
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
});

//server emits ready (the caller)
socket.on('ready', () => {
    if (isCaller) {
        //creates an RTCPeerConnectoin object
        rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onddstream = onAddStream;

        //adds current local stream to the object
        rtcPeerConnection.addStream(localStream);

        //prepares an Offer
        rtcPeerConnection
            .createOffer()
            .then(sessionDesc => {
                rtcPeerConnection.setLocalDescription(sessionDesc);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDesc,
                    room: roomNumber,
                });
            })
            .catch(err => {
                console.log(err);
            });
    }
});

//server emits offer (not the caller)
socket.on('offer', e => {
    if (!isCaller) {
        //creates an RTCPeerConnectoin object
        rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onddstream = onAddStream;

        //adds current local stream to the object
        rtcPeerConnection.addStream(localStream);

        //stores the offer as a remote description
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(e));

        //prepares an Answer
        rtcPeerConnection
            .createAnswer()
            .then(sessionDesc => {
                rtcPeerConnection.setLocalDescription(sessionDesc);
                socket.emit('answer', {
                    type: 'answer',
                    sdp: sessionDesc,
                    room: roomNumber,
                });
            })
            .catch(err => {
                console.log('Error occured when creating answer' + err);
            });
    }
});

//server emits answer
socket.on('answer', e => {
    //stores it as remote desc
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(e));
});

//server emits candidate
socket.on('canditate', e => {
    //creates canditate object
    let candidate = new RTCIceCandidate({
        sdpMLineIndex: e.label,
        candidate: e.candidate,
    });
    //stores candidate
    rtcPeerConnection.addIceCandidate(candidate);
});
