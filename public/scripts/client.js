'use strict';

//html elements
const divSelectRoom = document.getElementById('selectRoom');
const inputRoomNumber = document.getElementById('roomNumber');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const btnGenerateRoom = document.getElementById('generateRoom');
const modalroomID = document.getElementById('roomID');
const modalText = document.getElementById('modalText');
const btnCloseModal = document.getElementById('gotRoomID');
const divNewRoom = document.getElementById('newRoom');
const btnCopyID = document.getElementById('copyID');

const mainGrid = document.querySelector('.main-grid');
const callGrid = document.querySelector('.call-ui-grid');
const videoGrid = document.querySelector('.video-grid');

const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const titleText = document.querySelector('.title');

let allVideos;

function createRemoteVideo() {
    let video = document.createElement('video');
    video.classList.add('remote', 'video-grid-item');
    video.setAttribute('autoplay', true);
    videoGrid.append(video);
    allVideos = document.querySelectorAll('video');
    updateVideoGrid();
    return video;
}

function updateVideoGrid() {
    let itemNumber = allVideos.length;
    console.log(itemNumber);

    if (itemNumber === 2) {
        videoGrid.style.gridTemplateRows = '1fr 1fr';
        allVideos.forEach(video => {
            video.style.width = '720px';
            video.style.height = '480px';
        });
    } else if (itemNumber === 3) {
    } else if (itemNumber > 3) {
    }
}

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

const openModal = () => {
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
};

const closeModal = () => {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
};

const changeModalSuccess = () => {
    modalText.innerHTML = `
    <h1 style="margin-bottom:2rem;
    text-align:center;">
    Your roomID is:</h1>
    <p style="margin-bottom:2rem; 
    font-weight: 700; 
    font-family: 'Tahoma', sans-serif; 
    font-size: 1.5rem; 
    background-color: #000; 
    color: #fff;
    border-radius: 1.5rem;
    padding: 0.5rem;
    text-align: center;">
    
    ${roomNumber}</p>
    <p style="margin-bottom:2rem;
    font-size: 1.2rem;
    text-align: center;
    ">You can share the ID with your peers 😊</p>`;
};

const changeModalFailed = () => {
    modalText.innerHTML = `
        <h1 style="margin-bottom:2rem">Couldn't find room!</h1>
        <p font-size: 1.2rem; style="margin-bottom:2rem">There is no room with the specified ID.
        Please recheck the ID provided or create a new room.</p>
    `;
};

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
btnCloseModal.addEventListener('click', closeModal);

//listening for click outside modal window
overlay.addEventListener('click', closeModal);

//listener for esc => closing modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
    }
});

//copy ID button listener
btnCopyID.addEventListener('click', () => {
    btnCopyID.disabled = true;
    navigator.clipboard.writeText(roomNumber);
    let original = btnCopyID.textContent;
    btnCopyID.textContent = 'Copied ☑️';
    setTimeout(() => {
        btnCopyID.textContent = original;
        btnCopyID.disabled = false;
    }, 1200);
});

//home title listener
titleText.addEventListener('click', () => {
    window.location.reload();
});

//disconnecting with closing tab, emiting closed to the server
window.addEventListener('unload', () => {
    socket.emit('disconnect');
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
    mainGrid.classList.add('hidden');
    callGrid.classList.remove('hidden');
    roomNumber = room;
    changeModalSuccess();
    openModal();

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
    mainGrid.classList.add('hidden');
    callGrid.classList.remove('hidden');
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

        let newRemoteVideo = createRemoteVideo();
        rtcPeerConnection.addEventListener('track', event => {
            const [remoteStream] = event.streams;
            newRemoteVideo.srcObject = remoteStream;
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
        let newRemoteVideo = createRemoteVideo();
        rtcPeerConnection.addEventListener('track', async event => {
            const [remoteStream] = event.streams;
            newRemoteVideo.srcObject = remoteStream;
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
    changeModalFailed();
    openModal();
});

//receiving closed emit from server
socket.on('peerDisconnected', reason => {
    console.log(reason);
    allVideos[allVideos.length - 1].remove();
    allVideos = document.querySelectorAll('video');
    updateVideoGrid();
});
