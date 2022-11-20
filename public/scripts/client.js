'use strict';

//html elements
const inputroomID = document.getElementById('roomID');
const btnGoRoom = document.getElementById('goRoom');
const localVideo = document.getElementById('localVideo');
const mainUsername = document.querySelector('.main-username');
const btnGenerateRoom = document.getElementById('generateRoom');
const modalText = document.getElementById('modalText');
const btnCloseModal = document.getElementById('gotRoomID');
const btnCopyID = document.getElementById('copyID');
const inputUsername = document.getElementById('username');
const textUsernameError = document.getElementById('usernameError');

const callPageLayout = document.querySelector('.call-page-layout');
const mainGrid = document.querySelector('.main-grid');
const flexContainerVideos = document.querySelector('.flex-video-container');
const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const titleText = document.querySelector('.title');
const settingsOverlay = document.querySelector('.settings-overlay');
const btnSettings = document.querySelector('.settings');
const btnCloseSettings = document.querySelector('.settings-close-button');
const cameraOptions = document.querySelector('.cameras');
const micOptions = document.querySelector('.mics');
const speakerOptions = document.querySelector('.speakers');
const btnApply = document.querySelector('.apply-settings');
const btnSaveSettings = document.querySelector('.save-settings');
const btnMute = document.querySelector('.mute');
const btnSharescreen = document.querySelector('.sharescreen');
const mainVideoSection = document.getElementById('mainVideoSection');
const btnSendMessage = document.querySelector('.send-button');
const inputChatMessage = document.querySelector('.message-input');
const chatFlex = document.querySelector('.chat-flex');
const userList = document.querySelector('.user-flex-items');
const btnFileShare = document.querySelector('.file-share-button');

const allVideos = document.getElementsByTagName('video');

//GLOBAL variables
const CHUNK_MAX_SIZE = 16000;
let roomID;
let localStream;
//multiple rtc connections, username/connection key-value pair
let rtcPeerConnections = new Map();
let dataChannels = new Map();
let username;
let isScreenSharing = false;

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
const streamConstraints = {
    audio: true,
    video: {
        facingMode: 'user',
        width: { min: 1024, ideal: 1280, max: 1920 },
        height: { min: 576, ideal: 720, max: 1080 },
    },
};

const filePickerOptions = {
    startIn: 'desktop',
    types: [
        {
            description: 'Files',
            accept: {
                'video/mp4': ['.mp4'],
                'text/plain': ['.txt'],
                'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.gif'],
                'application/*': ['.doc', '.pdf', '.zip'],
            },
        },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
};

//connecting to socket.io server
const socket = io();

//detecting whos speaking

//device functions
function updateSettingsDeviceList() {
    let selects = document.querySelectorAll('select');
    selects.forEach(select => {
        while (select.firstChild) {
            select.removeChild(select.lastChild);
        }
    });

    navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
            devices.forEach(device => {
                let option = document.createElement('option');
                option.innerHTML = `${device.label}`;
                option.value = `${device.deviceId}`;
                if (device.kind === 'videoinput') {
                    cameraOptions.append(option);
                } else if (device.kind === 'audioinput') {
                    micOptions.append(option);
                } else {
                    speakerOptions.append(option);
                }
            });
        })
        .catch(err => console.log(err));
}

//sending new stream after input device changes/sharescreen
function sendNewStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream; //shows stream
    const [videoTrack] = stream.getVideoTracks();
    const [audioTrack] = stream.getAudioTracks();

    //sending audio and video tracks to every rtc connection
    rtcPeerConnections.forEach(pc => {
        const senderV = pc
            .getSenders()
            .find(s => s.track.kind === videoTrack.kind);
        senderV.replaceTrack(videoTrack);
        const senderA = pc
            .getSenders()
            .find(s => s.track.kind === audioTrack.kind);
        senderA.replaceTrack(audioTrack);
    });
}

//create new username within userlist

function createUserListItem(username) {
    let newP = document.createElement('p');
    newP.classList.add('user-flex-item');
    newP.textContent = username;
    userList.append(newP);
}

//creating new remote video element
function createRemoteVideo(remoteUsername) {
    //dynamically creating new video elements
    let newDiv = document.createElement('div');
    newDiv.classList.add('flex-video-item');
    newDiv.setAttribute('id', `${remoteUsername}`);
    let newSpan = document.createElement('span');
    newSpan.classList.add('remote-username');
    newSpan.textContent = ` ${remoteUsername}`;
    let video = document.createElement('video');
    video.classList.add('bottom');
    video.setAttribute('id', `${remoteUsername}`);
    video.setAttribute('autoplay', true);
    newDiv.appendChild(newSpan);
    newDiv.appendChild(video);
    flexContainerVideos.append(newDiv);
    return video;
}

//LAYOUT FUNCTIONS
function openSettings() {
    updateSettingsDeviceList();
    btnSettings.style.color = '#c65588';
    settingsOverlay.classList.add('settings-overlay-enable');
}

function closeSettings() {
    btnSettings.style.color = '#ffffff';
    settingsOverlay.classList.remove('settings-overlay-enable');
}

function settingsActive() {
    return settingsOverlay.classList.contains('settings-overlay-enable');
}

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
    background-color: #c65588; 
    color: #000;
    border-radius: 1rem;
    padding: 0.3rem;
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

//EVENT LISTENERS
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

//listener for logo reloading page
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

//Listener for settings button
btnSettings.addEventListener('click', e => {
    if (settingsActive()) {
        closeSettings();
    } else {
        openSettings();
    }
});

//listener for close settings button
btnCloseSettings.addEventListener('click', closeSettings);

//scrolling with grab listeners
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

//listener for mute/unmute
btnMute.addEventListener('click', e => {
    if (!localStream.getAudioTracks()[0].enabled) {
        btnMute.style.color = '#ffffff';
        localStream.getAudioTracks()[0].enabled = true;
    } else {
        btnMute.style.color = '#c65588';
        localStream.getAudioTracks()[0].enabled = false;
    }
});

//capturing screen
const shareScreen = () => {
    btnSharescreen.style.color = '#c65588';
    const sharescreenConstraints = {
        video: {
            cursor: 'always',
        },
        audio: false,
    };

    navigator.mediaDevices
        .getDisplayMedia(sharescreenConstraints)
        .then(stream => {
            let [screen] = stream.getVideoTracks();
            localStream = stream;
            localVideo.srcObject = stream;
            isScreenSharing = true;

            rtcPeerConnections.forEach(pc => {
                const senderV = pc
                    .getSenders()
                    .find(s => s.track.kind === screen.kind);
                senderV.replaceTrack(screen);
            });
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
};

//restoring initial stream with default constraints
const stopSharingScreen = () => {
    btnSharescreen.style.color = '#ffffff';
    navigator.mediaDevices
        .getUserMedia(streamConstraints) //getting media devices
        .then(stream => {
            sendNewStream(stream);
            isScreenSharing = false;
        }) //sending stream
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
};

//sharescreen button listener

btnSharescreen.addEventListener('click', e => {
    if (!isScreenSharing) shareScreen();
    else stopSharingScreen();
});

//changing devices to new ones
const changeInputDevices = () => {
    let newConstraints = {
        audio: {
            deviceId: {
                exact: micOptions.options[micOptions.selectedIndex].value,
            },
        },
        video: {
            deviceId: {
                exact: cameraOptions.options[cameraOptions.selectedIndex].value,
            },
        },
    };
    navigator.mediaDevices
        .getUserMedia(newConstraints) //getting media devices
        .then(stream => sendNewStream(stream)) //sending stream
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
};

//listener for applying device settings
btnApply.addEventListener('click', changeInputDevices);
btnSaveSettings.addEventListener('click', e => {
    changeInputDevices();
    closeSettings();
});

//event delegation for videos under flex container
flexContainerVideos.addEventListener('dblclick', e => {
    if (e.target && e.target.matches('.bottom')) {
        //video that needs change
        const clickedVideo = e.target;
        clickedVideo.classList.remove('bottom');
        clickedVideo.classList.add('target-main');
        let clickedUsername = clickedVideo.getAttribute('id');
        flexContainerVideos.removeChild(e.target.parentNode);

        //main video
        let main = document.querySelector('.target-main');
        let mainUsernameElement = document.querySelector('.main-username');
        let mainUsername = mainUsernameElement.textContent;

        //adding as main
        mainVideoSection.removeChild(main);
        mainVideoSection.appendChild(clickedVideo);
        main.classList.remove('target-main');
        mainUsernameElement.textContent = clickedUsername;

        //adding previous main video as flex item
        let newDiv = document.createElement('div');
        newDiv.classList.add('flex-video-item');
        newDiv.setAttribute('id', `${mainUsername}`);
        let newSpan = document.createElement('span');
        newSpan.textContent = ` ${mainUsername}`;
        main.classList.add('bottom');
        newDiv.appendChild(newSpan);
        newDiv.appendChild(main);
        flexContainerVideos.append(newDiv);
    }
});

function createSendLocalMessage() {
    let message = inputChatMessage.value;
    inputChatMessage.value = '';

    if (message != '') {
        let newMessageElement = document.createElement('p');
        newMessageElement.setAttribute('username', username);
        newMessageElement.classList.add('chat-flex-my-message', 'message');
        newMessageElement.textContent = message;
        chatFlex.append(newMessageElement);
        newMessageElement.scrollIntoView();

        const msgObject = {
            value: message,
            type: 'chat',
            from: username,
        };

        dataChannels.forEach((channel, user) => {
            channel.send(JSON.stringify(msgObject));
        });
    }
}

// //event delegation for clicks on files under chat
chatFlex.addEventListener('click', e => {
    if (e.target && e.target.matches('.file')) {
        console.log('clicked file');
        let targetA = e.target.nextElementSibling.nextElementSibling;
        targetA.click();
    }
});

//attaching file to element
function attachFileToElement(element, file) {
    element.style.cursor = 'pointer';
    const blob = window.URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = blob;
    anchor.download = file.name;
    element.appendChild(anchor);
}

//creating a new element for a new file locally
function createLocalFile(fileData) {
    const newDiv = document.createElement('div');
    newDiv.classList.add('file-flex', 'chat-flex-my-file');
    const newPusername = document.createElement('p');
    newPusername.textContent = username;
    const newImg = document.createElement('img');
    newImg.classList.add('file', 'my-file');
    newImg.setAttribute('src', 'icons/my-file-arrow-down-solid.svg');
    newImg.setAttribute('alt', 'file');
    const newPfilename = document.createElement('p');
    newPfilename.textContent = fileData.name;
    newDiv.appendChild(newPusername);
    newDiv.appendChild(newImg);
    newDiv.appendChild(newPfilename);

    //attaching file to our div
    attachFileToElement(newDiv, fileData);

    chatFlex.append(newDiv);
    newDiv.scrollIntoView();
}

//creating a new element for a new file locally
function createOthersFile(fileData) {
    const newDiv = document.createElement('div');
    newDiv.classList.add('file-flex', 'chat-flex-others-file');
    const newPusername = document.createElement('p');
    newPusername.textContent = username;
    const newImg = document.createElement('img');
    newImg.classList.add('file', 'others-file');
    newImg.setAttribute('src', 'icons/others-file-arrow-down-solid.svg');
    newImg.setAttribute('alt', 'file');
    const newPfilename = document.createElement('p');
    newPfilename.textContent = fileData.name;
    newDiv.appendChild(newPusername);
    newDiv.appendChild(newImg);
    newDiv.appendChild(newPfilename);

    //attaching file to our div
    attachFileToElement(newDiv, fileData);

    chatFlex.append(newDiv);
    newDiv.scrollIntoView();
}

//splitting size of file and sending it in chunks
function splitAndSend(buffer) {
    const numberOfChunks = (buffer.byteLength / CHUNK_MAX_SIZE) | 0;
    console.log(buffer);

    if (numberOfChunks === 0) {
        dataChannels.forEach((channel, user) => {
            channel.send(buffer);
        });
    } else {
        for (let i = 0; i < numberOfChunks; i++) {
            let start = i * CHUNK_MAX_SIZE,
                end = (i + 1) * CHUNK_MAX_SIZE;

            dataChannels.forEach((channel, user) => {
                channel.send(buffer.slice(start, end));
            });
        }

        if (buffer.byteLength % CHUNK_MAX_SIZE) {
            dataChannels.forEach((channel, user) => {
                channel.send(buffer.slice(numberOfChunks * CHUNK_MAX_SIZE));
            });
        }
    }
}

function sendLocalFile(fileData) {
    //converting file(blob) to arraybuffer as Chrome does not support it
    console.log(fileData);

    fileData
        .arrayBuffer()
        .then(buffer => {
            //sending a custom obj containing all information
            //for the file we are about to send next
            const msgObject = {
                from: username,
                filename: fileData.name,
                type: fileData.type,
                len: buffer.byteLength,
            };

            //sending initial message
            dataChannels.forEach((channel, user) => {
                channel.send(JSON.stringify(msgObject));
            });

            //sending file in chunks
            splitAndSend(buffer);
        })
        .catch(err => console.log(err));
}

function createLocalImage(fileData) {}
function sendLocalImage(fileData) {}

function createLocalVideo(fileData) {}
function sendLocalVideo(fileData) {}

//event listener for sending chat message
btnSendMessage.addEventListener('click', createSendLocalMessage);

//event listener for pressing enter while on message input area

inputChatMessage.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
        createSendLocalMessage();
    }
});

//event listener for file sharing button
//['.txt'],['.png', '.gif', '.jpeg', '.jpg', '.gif'],['.doc', '.pdf', '.zip'],['.mp4'],
btnFileShare.addEventListener('click', async e => {
    try {
        const [fileHandle] = await window.showOpenFilePicker(filePickerOptions);
        const fileData = await fileHandle.getFile();
        createLocalFile(fileData);
        sendLocalFile(fileData);
    } catch (err) {
        console.log(err);
    }
});

//checking if data is JSON
function isJson(data) {
    try {
        JSON.parse(data);
    } catch (e) {
        return false;
    }
    return true;
}

//handling chat message
function handleChatMessage(msgObject) {
    //chat message
    let remoteUsername = msgObject.from;
    let newMessageElement = document.createElement('p');
    newMessageElement.setAttribute('username', remoteUsername);
    newMessageElement.classList.add('chat-flex-others-message', 'message');
    newMessageElement.textContent = msgObject.value;
    chatFlex.append(newMessageElement);
    newMessageElement.scrollIntoView();
}

//keeping global vars for length and type of upcoming
let len, type, count, filename, buffer, bufferView;

//handling remote message
function handleMessage(data) {
    if (isJson(data)) {
        let msgObject = JSON.parse(data);
        if (msgObject.type === 'chat') {
            handleChatMessage(msgObject);
        } else {
            buffer = new ArrayBuffer(msgObject.len);
            console.log(buffer);
            //need a view to change dat under ArrayBuffer
            bufferView = new Uint8Array(buffer);
            count = 0;
            len = msgObject.len;
            type = msgObject.type;
            filename = msgObject.filename;
        }
    } else {
        //upcoming chunk

        let chunkSize = data.byteLength;
        //need a new view for the arraybufferchunk
        let newView = new Uint8Array(data);

        //setting chunk data on our main view
        bufferView.set([...newView], count);
        //keeping track of chunks
        count += chunkSize;
        console.log(count);
        console.log(buffer.byteLength);

        //last chunk
        if (count === buffer.byteLength) {
            let blob = new Blob([bufferView], {
                type: type,
            });
            let newFile = new File([blob], filename, { type: type });
            console.log(newFile);
            createOthersFile(newFile);
        }
    }
}

////-------------------------SIGNALING

//server emits created
socket.on('created', room => {
    roomID = room;
    createUserListItem(username);
    changeLayout();
    changeModalSuccess();
    openModal();

    navigator.mediaDevices
        .getUserMedia(streamConstraints) //getting media devices
        .then(stream => {
            localStream = stream;
            mainUsername.textContent = `${username}`;
            localVideo.setAttribute('id', `${username}`);
            localVideo.srcObject = stream; //shows stream locally
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
});

//server emits joined
socket.on('joined', room => {
    createUserListItem(username);
    changeLayout();
    navigator.mediaDevices
        .getUserMedia(streamConstraints)
        .then(stream => {
            localStream = stream;
            mainUsername.textContent = `${username}`;
            localVideo.setAttribute('id', `${username}`);
            localVideo.srcObject = stream;
            socket.emit('ready', roomID, username); //sends ready to the server
        })
        .catch(err => {
            console.log('An error occured when accessing media devices ' + err);
        });
});

//server emits ready
socket.on('ready', remoteUsername => {
    //if client hasnt established peer connection yet
    if (!rtcPeerConnections.has(remoteUsername)) {
        //creates an RTCPeerConnectoin object
        let rtcPeerConnection = new RTCPeerConnection(iceServers);

        //adds current local stream to the object
        localStream.getTracks().forEach(track => {
            rtcPeerConnection.addTrack(track, localStream);
        });

        //adding data channel for data exchange and chat implementation
        let newDataChannel =
            rtcPeerConnection.createDataChannel('Chat channel');
        newDataChannel.addEventListener('open', event => {
            console.log(event);
        });
        newDataChannel.addEventListener('message', event => {
            handleMessage(event.data);
        });

        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = event => {
            if (event.candidate) {
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
        dataChannels.set(remoteUsername, newDataChannel);
        createUserListItem(remoteUsername);
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

        //adding data channel for data exchange and chat implementation
        let newDataChannel;
        rtcPeerConnection.addEventListener('datachannel', event => {
            newDataChannel = event.channel;
            //need this for both Chrome and Mozilla
            newDataChannel.binaryType = 'arraybuffer';
            console.log('Data channel created');
            dataChannels.set(remoteUsername, newDataChannel);
            newDataChannel.addEventListener('message', event => {
                handleMessage(event.data);
            });
        });
        //adds event listeners to the newly created object above
        rtcPeerConnection.onicecandidate = event => {
            if (event.candidate) {
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
        createUserListItem(remoteUsername);
    }
});

//server emits answer
socket.on('answer', (sessionDesc, remoteUsername) => {
    //stores it as remote desc
    let connection = rtcPeerConnections.get(remoteUsername);
    if (!connection.currentRemoteDescription) {
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
    dataChannels.delete(remoteUsername);
});

socket.on('usernametaken', () => {
    textUsernameError.textContent = `Username taken. Please pick another username and re-join the call.`;
});
