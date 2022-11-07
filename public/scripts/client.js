'use strict';

//html elements
const divSelectRoom = document.getElementById('selectRoom');
const inputroomID = document.getElementById('roomID');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const btnGenerateRoom = document.getElementById('generateRoom');
const modalText = document.getElementById('modalText');
const btnCloseModal = document.getElementById('gotRoomID');
const divNewRoom = document.getElementById('newRoom');
const btnCopyID = document.getElementById('copyID');
const inputUsername = document.getElementById('username');
const textUsernameError = document.getElementById('usernameError');

const mainGrid = document.querySelector('.main-grid');
const callGrid = document.querySelector('.call-ui-grid');
const videoGrid = document.querySelector('.video-grid');

const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const titleText = document.querySelector('.title');

let allRemoteUsernames = [];

//creating new remote video element
function createRemoteVideo(remoteUsername) {
    let video = document.createElement('video');
    video.classList.add('remote', 'video-grid-item');
    video.setAttribute('id', `${remoteUsername}`);
    video.setAttribute('autoplay', true);
    videoGrid.append(video);
    updateVideoGrid();

    return video;
}

//updating video grid when remote element is removed
function updateVideoGrid() {
    let items = document.querySelectorAll('.video-grid-item');
    if (items.length > 15) {
        videoGrid.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
        items.forEach(item => {
            item.style.width = '80%';
        });
    } else if (items.length > 7) {
        videoGrid.style.gridTemplateColumns = '1fr 1fr 1fr';
        items.forEach(item => {
            item.style.width = '100%';
        });
    } else if (items.length > 3) {
        videoGrid.style.gridTemplateColumns = '1fr 1fr';
        items.forEach(item => {
            item.style.width = '100%';
        });
    } else {
        videoGrid.style.gridTemplateColumns = '1fr';
        items.forEach(item => {
            item.style.width = '100%';
        });
    }
}

//GLOBAL variables
let roomID;
let localStream;
//multiple rtc connections, username/connection key-value pair
let rtcPeerConnections = new Map();
let isCaller;
let username;

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

const changeLayout = () => {
    mainGrid.classList.add('hidden');
    callGrid.classList.remove('hidden');
};

//changing modal content dynamically
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
    
    ${roomID}</p>
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

//username validation
const usernameIsValid = () => {
    if (inputUsername.value.length < 4 || inputUsername.value.length > 16) {
        textUsernameError.textContent = `Username should be 4-16 character long. Please pick another username.`;
        return false;
    }
    username = inputUsername.value;
    return true;
};

//putting a limit to ID length
const idIsValid = () => {
    console.log(typeof roomID);

    return roomID.length > 36 ? false : true;
};

//listener for room button
btnGoRoom.addEventListener('click', e => {
    roomID = inputroomID.value;
    if (usernameIsValid() && idIsValid()) {
        socket.emit('join', roomID, username);
    }
});

//listener for room creation
btnGenerateRoom.addEventListener('click', event => {
    if (usernameIsValid()) {
        socket.emit('create', username);
    }
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
    navigator.clipboard.writeText(roomID);
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
        socket.emit(
            'candidate',
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                room: roomID,
            },
            username
        );
    }
}

//server emits created
socket.on('created', room => {
    roomID = room;
    changeLayout();
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
    changeLayout();
    navigator.mediaDevices
        .getUserMedia(streamConstraints)
        .then(stream => {
            localStream = stream;
            localVideo.srcObject = stream;
            socket.emit('ready', roomID, username); //sends ready to the server
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
});

//server emits ready
socket.on('ready', remoteUsername => {
    //if he hasnt established peer connection yet
    if (!allRemoteUsernames.includes(remoteUsername)) {
        allRemoteUsernames.push(remoteUsername); //adding remote username
        //creates an RTCPeerConnectoin object
        let rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;

        //creates remote video element
        let newRemoteVideo = createRemoteVideo(remoteUsername);

        //adding track event listener to get stream
        rtcPeerConnection.addEventListener('track', event => {
            const [remoteStream] = event.streams;
            newRemoteVideo.srcObject = remoteStream;
            console.log('src added');
        });

        //prepares an offer and sends offer
        rtcPeerConnection
            .createOffer()
            .then(sessionDesc => {
                rtcPeerConnection.setLocalDescription(sessionDesc);
                socket.emit(
                    'offer',
                    {
                        type: 'offer',
                        sdp: sessionDesc,
                        room: roomID,
                    },
                    username
                );
            })
            .catch(err => {
                console.log(err);
            });
        rtcPeerConnections.set(remoteUsername, rtcPeerConnection);
    }
});

//server emits offer
socket.on('offer', (sessionDesc, remoteUsername) => {
    //if it hasnt yet established peer connection
    if (!allRemoteUsernames.includes(remoteUsername)) {
        allRemoteUsernames.push(remoteUsername);
        //creates an RTCPeerConnectoin object
        let rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = onIceCandidate;
        let newRemoteVideo = createRemoteVideo(remoteUsername);
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
                socket.emit(
                    'answer',
                    {
                        type: 'answer',
                        sdp: sessionDesc,
                        room: roomID,
                    },
                    username
                );
            })
            .catch(err => {
                console.log('Error occured when creating answer' + err);
            });
        rtcPeerConnections.set(remoteUsername, rtcPeerConnection);
    }
});

//server emits answer
socket.on('answer', (sessionDesc, remoteUsername) => {
    //stores it as remote desc
    let connection = rtcPeerConnections.get(remoteUsername);

    //ignores answer if peer connection is established already

    connection.setRemoteDescription(new RTCSessionDescription(sessionDesc));
});

//server emits candidate
socket.on('candidate', (event, remoteUsername) => {
    //creates canditate object

    let connection = rtcPeerConnections.get(remoteUsername);

    let candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate,
    });
    //stores candidate
    connection.addIceCandidate(candidate);
});

//server emits room not found
socket.on('roomnotfound', room => {
    changeModalFailed();
    openModal();
});

//handing peer disconnection
socket.on('peerDisconnected', username => {
    document.getElementById(`${username}`).remove();
    updateVideoGrid();
    allRemoteUsernames.splice(allRemoteUsernames.indexOf(username), 1);
});
