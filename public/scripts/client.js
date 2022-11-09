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

const callPageLayout = document.querySelector('.call-page-layout');
const mainGrid = document.querySelector('.main-grid');
const flexContainerVideos = document.querySelector('.flex-video-container');

const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const titleText = document.querySelector('.title');

//creating new remote video element
function createRemoteVideo(remoteUsername) {
    let video = document.createElement('video');
    video.classList.add('remote', 'flex-video-item');
    video.setAttribute('id', `${remoteUsername}`);
    video.setAttribute('autoplay', true);
    flexContainerVideos.append(video);
    return video;
}

//GLOBAL variables
let roomID;
let localStream;
//multiple rtc connections, username/connection key-value pair
let rtcPeerConnections = new Map();
let username;

//STUN SERVERS
const iceServers = {
    iceServers: [
        { url: 'stun:stun.services.mozzila.com' },
        { url: 'stun:stun.l.google.com:19302' },
        { url: 'stun:stun1.l.google.com:19302' },
        { url: 'stun:stun2.l.google.com:19302' },
        { url: 'stun:stun3.l.google.com:19302' },
        { url: 'stun:stun4.l.google.com:19302' },
    ],
};

//Stream constraints, having min ideal and max values for better performance
let streamConstraints = {
    audio: true,
    video: {
        facingMode: 'user',
        width: { min: 1024, ideal: 1280, max: 1920 },
        height: { min: 576, ideal: 720, max: 1080 },
    },
};

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
    callPageLayout.classList.remove('hidden');
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

titleText.addEventListener('click', event => {
    window.location.reload();
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

//disconnecting with closing tab, emiting closed to the server
window.addEventListener('unload', () => {
    socket.emit('disconnect');
});

//scrolling with grab
let mouseDown = false;
let startX, scrollLeft;

let startDragging = e => {
    mouseDown = true;
    startX = e.pageX - flexContainerVideos.offsetLeft;
    scrollLeft = flexContainerVideos.scrollLeft;
};

let stopDragging = event => (mouseDown = false);

flexContainerVideos.addEventListener('mousemove', e => {
    e.preventDefault();
    if (!mouseDown) {
        return;
    }
    const x = e.pageX - flexContainerVideos.offsetLeft;
    const scroll = x - startX;
    flexContainerVideos.scrollLeft = scrollLeft - scroll;
});

flexContainerVideos.addEventListener('mousedown', startDragging, false);
flexContainerVideos.addEventListener('mouseup', stopDragging, false);
flexContainerVideos.addEventListener('mouseleave', stopDragging, false);

////SIGNALING

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
    console.log('GOT READY');

    //if client hasnt established peer connection yet
    if (!rtcPeerConnections.has(remoteUsername)) {
        //creates an RTCPeerConnectoin object
        let rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log('Sending ice candidate');
                socket.emit('candidate', {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                    room: roomID,
                    from: username,
                    to: remoteUsername,
                });
            }
        };

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
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDesc,
                    room: roomID,
                    from: username,
                    to: remoteUsername,
                });
            })
            .catch(err => {
                console.log(err);
            });
        rtcPeerConnections.set(remoteUsername, rtcPeerConnection);
    }
});

//server emits offer
socket.on('offer', (sessionDesc, remoteUsername) => {
    //if client hasnt yet established peer connection
    if (!rtcPeerConnections.has(remoteUsername)) {
        //creates an RTCPeerConnectoin object
        let rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = event => {
            console.log(remoteUsername);

            if (event.candidate) {
                console.log('Sending ice candidate');
                socket.emit('candidate', {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                    room: roomID,
                    from: username,
                    to: remoteUsername,
                });
            }
        };

        let newRemoteVideo = createRemoteVideo(remoteUsername);
        rtcPeerConnection.addEventListener('track', async event => {
            const [remoteStream] = event.streams;
            newRemoteVideo.srcObject = remoteStream;
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
                    room: roomID,
                    from: username,
                    to: remoteUsername,
                });
            })
            .catch(err => {
                console.log('Error occured when creating answer' + err);
            });
        rtcPeerConnections.set(remoteUsername, rtcPeerConnection);
    }
});

//server emits answer
socket.on('answer', (sessionDesc, remoteUsername) => {
    console.log(`Received answer from ${remoteUsername}`);

    //stores it as remote desc
    let connection = rtcPeerConnections.get(remoteUsername);
    if (!connection.currentRemoteDescription) {
        console.log('Setting RDP');
        //ignores answer if peer connection is established already
        connection
            .setRemoteDescription(new RTCSessionDescription(sessionDesc))
            .catch(() => {
                console.log(remoteUsername);
            });
    }
});

//server emits candidate
socket.on('candidate', (event, remoteUsername) => {
    //creates canditate object

    //setting candidate is the last step for connection
    //we set candidate only if we haven't already
    let connection = rtcPeerConnections.get(remoteUsername);

    console.log(connection.connectionState);
    let candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate,
    });
    //stores candidate
    connection
        .addIceCandidate(candidate)
        .then(e => {
            console.log('Added candidate for ' + remoteUsername);
        })
        .catch(err => {
            console.log(err);
        });
    console.log(remoteUsername, connection);
});

//server emits room not found
socket.on('roomnotfound', room => {
    changeModalFailed();
    openModal();
});

//handing peer disconnection
socket.on('peerDisconnected', remoteUsername => {
    //removing html element
    document.getElementById(`${remoteUsername}`).remove();
    //removing rtcPeerConnection
    rtcPeerConnections.delete(remoteUsername);
});

socket.on('usernametaken', () => {
    textUsernameError.textContent = `Username taken. Please pick another username and re-join the call.`;
});
