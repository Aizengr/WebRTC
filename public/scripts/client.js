'use strict';

//html elements
const divSelectRoom = document.getElementById('selectRoom');
const divConsultingRoom = document.getElementById('consultingRoom');
const inputRoomNumber = document.getElementById('roomNumber');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const btnGenerateRoom = document.getElementById('generateRoom');
const modalroomID = document.getElementById('roomID');
const modal = document.querySelector('.modal');
const modalText = document.getElementById('modalText');
const btnCloseModal = document.getElementById('gotRoomID');

const divNewRoom = document.getElementById('newRoom');

//GLOBAL

let roomNumber;
let localStream;
let rtcPeerConnection;
let isCaller;

//STUN SERVERS

const iceServers = {
    iceServers: [
        { url: 'stun:stun.services.mozzila.com' },
        { url: 'stun:stun.l.google.com:19302' },
    ],
};

//Stream constraints
let streamConstraints = { audio: true, video: true };

//connecting to socket.io server
const socket = io();

//listener for room button
btnGoRoom.addEventListener('click', e => {
    roomNumber = inputRoomNumber.value;
    socket.emit('join', roomNumber);
});

//listener for room creation
btnGenerateRoom.addEventListener('click', event => {
    socket.emit('create');
});

//listener for closing modal window
btnCloseModal.addEventListener('click', e => {
    modal.classList.add('hidden');
});

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
    roomNumber = room;

    modalText.innerHTML = `<h1>Here is your new room ID:</h1>
    <h2>${room}</h2>
    <p>You can share the ID with your peers 😊</p>`;

    modal.classList.remove('hidden');
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

//server emits ready
socket.on('ready', () => {
    if (isCaller) {
        //creates an RTCPeerConnectoin object
        rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.addEventListener('track', async event => {
            const [remoteStream] = event.streams;
            console.log(remoteStream);
            remoteVideo.srcObject = remoteStream;
            console.log('src added');
        });

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

//server emits offer
socket.on('offer', sessionDesc => {
    if (!isCaller) {
        //creates an RTCPeerConnectoin object
        rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.addEventListener('track', async event => {
            const [remoteStream] = event.streams;
            console.log(remoteStream);
            remoteVideo.srcObject = remoteStream;
            console.log('src added');
        });

        //stores the offer as a remote description
        rtcPeerConnection.setRemoteDescription(
            new RTCSessionDescription(sessionDesc)
        );

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
socket.on('answer', sessionDesc => {
    //stores it as remote desc
    rtcPeerConnection.setRemoteDescription(
        new RTCSessionDescription(sessionDesc)
    );
});

//server emits candidate
socket.on('candidate', event => {
    //creates canditate object
    let candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate,
    });
    //stores candidate
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('roomnotfound', room => {
    modalText.innerHTML = `<h1>Couldn't find room!</h1>
    <p>There is no room with the specified ID. Please recheck the ID provided or create a new room.`;
    modal.classList.remove('hidden');
});
