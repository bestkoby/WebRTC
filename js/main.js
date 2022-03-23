'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var peers = [];
var current_connecting_socketID;
var peer_connection = new Map();
//var remoteStream;

var pcConfig = {
  'iceServers': [
    {
    'urls': 'stun:stun3.l.google.com:19302'
    },
    {"urls":"turn:numb.viagenie.ca", "username":"webrtc@live.com", "credential":"muazkh"}
  ]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};
/////////////////////////////////////////////

const room = prompt('Enter room name:');

var logger = document.getElementById("log");
var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or or or join room', room);
  addlog('Attempted to create or or or join room', room);
  var roomname = document.querySelector('#roomname');
  roomname.textContent = "welcome to video room "+ room
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  addlog('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room, socket_id){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  current_connecting_socketID = socket_id
  isChannelReady = true;
  isInitiator= true;
  isStarted = false;
});

socket.on('joined', function(room, socket_id) {
  isChannelReady = true;
  console.log('joined: ' + room);
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('socket_list', function(peer) {
  console.log("received socket_list")
  if(!isInitiator){
    console.log(peer);
    peers = peer;
  }
});

////////////////////////////////////////////////

function sendMessage(message, socket_id) {
  console.log('Client sending message: ', message, socket_id);
  socket.emit('message', message, room, socket_id);
}

// This client receives a message
socket.on('message', function(message, from_socketID, to_socketID) {
  console.log('Client received message:', message, from_socketID);
  addlog('Client received message:', message, " from:  ",from_socketID, " to: ", to_socketID);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    if (!isInitiator){
      peer_connection.get(from_socketID).setRemoteDescription(new RTCSessionDescription(message));
      doAnswer(from_socketID);
    }
  } else if (message.type === 'answer' && isStarted) {
    if (socket.id == to_socketID){
      peer_connection.get(from_socketID).setRemoteDescription(new RTCSessionDescription(message));
    }
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    peer_connection.get(from_socketID).addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
//var remoteVideo = document.querySelector('#remoteVideo');
//var localAudio = document.querySelector('#localAudio');

navigator.mediaDevices.getUserMedia({
  //audio: true,
  video: true
})
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: true,
  audio: true
};

console.log('Getting user media with constraints', constraints);

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    isStarted = true;
    if (isInitiator) {
      createPeerConnection(current_connecting_socketID);
      doCall(current_connecting_socketID);
    }else{
      console.log(peers);
      var peer_number = 0;
      while(peer_number< peers.length){
        createPeerConnection(peers[peer_number]);
        peer_number+=1
      }
    }
  }
  console.log(">>>>>>>>>>>>");
  console.log(peer_connection);
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection(socket_id) {
  try {
    var pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    pc.addStream(localStream)
    peer_connection.set(socket_id, pc)
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall(socket_id) {
  console.log('Sending offer to peer');
  peer_connection.get(socket_id).createOffer().then((sessionDescription, error)=>{
      setLocalAndSendMessage(sessionDescription, socket_id),
      handleCreateOfferError(error)
    }
  );
}

function doAnswer(socket_id) {
  console.log('Sending answer to peer.');
  peer_connection.get(socket_id).createAnswer().then((sessionDescription, error)=>{
      setLocalAndSendMessage(sessionDescription, socket_id),
      onCreateSessionDescriptionError(error)
    }
  );
}

function setLocalAndSendMessage(sessionDescription,socket_id) {
  peer_connection.get(socket_id).setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, socket_id);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error);
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  const newvideo = document.createElement("video")
  const video_list = document.querySelector("#videos")
  newvideo.autoplay=true;
  video_list.appendChild(newvideo)
  //remoteStream = event.stream;
  newvideo.srcObject = event.stream;
  //remoteVideo.srcObject = remoteStream
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  remoteVideo.srcObject = null;
  stop();
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

function addlog(data){
  if (typeof data == 'string'){
    logger.innerHTML += data + "<br />";
  }else{
    logger.innerHTML += JSON.stringify(JSON.parse(data),null,2);   + '<br />';
  }
}