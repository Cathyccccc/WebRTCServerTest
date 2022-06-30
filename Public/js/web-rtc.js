let localStream;
const config = {
  iceServers: [{ url: 'stun:stun.xten.com' }]
}
const localPC = new RTCPeerConnection(config);
const remotePC = new RTCPeerConnection(config);

const sendChannel = localPC.createDataChannel('sendDataChannel');

// 注册回调，处理事件
localPC.onicecandidate = (event) => {
  console.log('icecandidate', event);
}
localPC.ontrack = (event) => {
  console.log('track', event);
  localStream.getTracks().forEach((track) => {
    localPC.addTrack(track, localStream)
  })
}


navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
  console.log('MediaStream', stream)
  document.querySelector('#my-video').srcObject = stream;
  localStream = stream;
}).catch(err => console.log(err))



remotePC.ondatachannel = (event) => {
  console.log('datachannel', event)
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessage;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
};

function onReceiveMessage(event) {
  document.querySelector("#textarea").value = event.data;
}

document.querySelector("#send-btn").onclick = () => {
  var data = document.querySelector("#input").value;
  sendChannel.send(data);
};

// 设置offer
// const offer = await localPC.createOffer()


