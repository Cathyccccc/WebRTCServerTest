const e = require("express");

// const socket = io('http://');

let localStream = null;
let socketId;
let user = null;
let rtcConnections = {}
let selfTrack // 用于控制本人摄像头的关闭（占用）
const config = {
  iceServers: [
    { url: 'stun:stun.xten.com' },
    // {
    //   url: "turn:***",
    //   username: '', // 用户名
    //   credential: '' // 密码
    // }
  ]
}

socket.on('connect', () => {
  socketId = socket.id
  console.log('socket连接成功', socketId)
})

document.querySelector('#login').onclick = () => {
  const username = document.querySelector('#input').value
  if (username) {
    socket.emit('login', {
      user: username,
      socket: socketId
    }, (response) => {
      alert(`用户${response.user}登录成功`)
      user = response.user
    })
  } else {
    alert('请输入用户名')
  }
}

// 创建房间，其他什么都没干
let roomId = null
document.querySelector('#create-btn').onclick = () => {
  roomId = Math.random().toString(32).slice(-8);
  // console.log(roomId)
  if (user) {
    socket.emit('createRoom', {
      roomId,
      sponsor: user
    })
  } else {
    alert('请先登录')
  }
}


document.querySelector('#join-btn').onclick = () => {
  roomId = document.querySelector('#room').value
  if (user) {
    if (roomId) {
      socket.emit('joinRoom', {
        user,
        roomId,
        from: socketId
      })
      createPeerConnection(socketId) // 加入房间时，在本地创建自己的peerConnection
    }
    else {
      alert('请输入房间号或创建房间')
    }
  } else {
    alert('请先登录')
  }
}

// 自己点击退出按钮
document.querySelector('#exit-btn').onclick = () => {
  socket.emit('exit', {
    roomId,
    from: socketId
  })
  for (prop in rtcConnections) {
    let pc = rtcConnections[prop]
    selfTrack.stop()
    pc.close()
    pc = null
  }
  roomId = null
  rtcConnections = {}
  document.querySelector('#remote-video-container').innerHTML = '' // 当前用户退出，将看不到所有人的video
  document.querySelector('#my-video-container').removeChild(document.querySelector('#my-video'))
}

// 点击发送按钮发送消息
document.querySelector('#send-btn').onclick = () => {
  document.createElement('div')
}

function createPeerConnection (id) {
  if (rtcConnections[id]) {
    return rtcConnections[id]
  } else {
    let PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
    const pc = new PeerConnection(config);
    // 注册回调，处理事件
    console.log('创建pc====', pc)
    pc.onicecandidate = (event) => handleIceCandidate(id, event)
    pc.ontrack = (event) => handleTrack(id, event)
    pc.oniceconnectionstatechange = (event) => handleIceConnectionStateChange(id, event)
    if (localStream !== null) { // 我自己加入房间的时候localStream是没有的，正在创建中
      console.log('tracks', localStream.getTracks())
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream)
      })
    }
    rtcConnections[id] = pc // 将本地创建的所有peerConnection都记录下来（包括localPeerConnection和remotePeerConnection）
    return pc
  }
}

function handleIceCandidate (id, event) {
  console.log('触发icecandidate', id, event);
  // const pc = createPeerConnection(id)
  // pc.addIceCandidate(candidate)
  if (event.candidate) {
    socket.emit('candidate', {
      from: socketId,
      to: id,
      roomId,
      candidate: event.candidate
    })
  }
}
 
function handleTrack (id, event) {
  console.log('触发track', id, event);
  const video = document.createElement('video')
  video.id = id
  video.autoplay = 'autoplay'
  video.style.width = 200
  video.style.height = 200
  document.querySelector('#remote-video-container').appendChild(video)
  video.srcObject = event.streams[0]
  console.log(video)
  video.onloadedmetadata = function(e) {
    video.play();
  }
}

// 监听ICE连接状态
function handleIceConnectionStateChange (id, event) {
  console.log(`ID ${id} ICE connection state change: ${event.target.iceConnectionState}`)
}
// 7种状态
// new        ICE代理正在收集候选人或等待提供远程候选人。
// checking   ICE代理已经在至少一个组件上接收了远程候选者，并且正在检查候选但尚未找到连接。除了检查，它可能还在收集。
// connected  ICE代理已找到所有组件的可用连接，但仍在检查其他候选对以查看是否存在更好的连接。它可能还在收集。
// completed  ICE代理已完成收集和检查，并找到所有组件的连接。
// failed     ICE代理已完成检查所有候选对，但未能找到至少一个组件的连接。可能已找到某些组件的连接。
// disconnected ICE 连接断开
// closed      ICE代理已关闭，不再响应STUN请求。

// sponsor房间创建成功
socket.on('created', (data) => {
  console.log(`房间创建成功, 发起人${data.sponsor}, 房间号${data.roomId}`)
  document.querySelector('#room').value = data.roomId
})

socket.on('joined', (data) => {
  console.log(`${data.from} 加入了房间`, data)
  if (data.from === socketId) { // 我自己加入房间，需要我在本地设置其他人的peerConnection信息
    data.peers.forEach((peer) => {
      const pc = createPeerConnection(peer) // 根据房间其他人的socket id创建peerConnection
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer) // 将peerConnection(指向remote)创建的offer存到本地
        socket.emit('offer', {
          roomId,
          from: socketId,
          to: peer,
          sdp: offer.sdp
        })
      })
    })
    // 开启本地摄像头（自己的）
    // 判断是否有 navigator.mediaDevices，没有赋成空对象
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }
    // 继续判断是否有 navigator.mediaDevices.getUserMedia，没有就采用 navigator.getUserMedia
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(prams) {
          let getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
          // 兼容获取
          if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
          }
          return new Promise(function(resolve, reject) {
              getUserMedia.call(navigator, prams, resolve, reject);
          });
      };
    }
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then((stream) => {
      console.log('MediaStream', stream)
      selfTrack = stream.getVideoTracks()[0];
      console.log(selfTrack)
      const myVideo = document.createElement('video')
      myVideo.width = 300
      myVideo.height = 200
      myVideo.setAttribute('id', 'my-video')
      const myVideoContainer = document.querySelector('#my-video-container')
      myVideoContainer.appendChild(myVideo)
      if ('srcObject' in myVideo) {
        myVideo.srcObject = stream;
      } else if ('mozSrcObject' in myVideo) {
        myVideo.mozSrcObject = stream
      } else if ('webkitSrcObject' in myVideo) {
        myVideo.webkitSrcObject = stream
      } else {
        myVideo.src = window.URL.createObjectURL(stream);
      }
      myVideo.onloadedmetadata = function(e) {
        myVideo.play();
      }
      localStream = stream; // 保存本地流到全局
    })
  } else {
    createPeerConnection(data.from) // 收到有人加入房间的消息，‘我’（房间其他人）在本地创建了这个人的peerConnection(remote)
  }
})


socket.on('offer', (data) => {
  console.log('收到offer', data) // 各自收到各自的offer
  const remotePC = createPeerConnection(data.from); // 找到这个人加入时我在本地创建的peerConnection
  const rtcDescription = { type: 'offer', sdp: data.sdp } // 加入房间后将自己的sdp发送给其他人(交换sdp信息)
  remotePC.setRemoteDescription(rtcDescription) // 将这个加入人的传过来的sdp信息，设置到这个人对应的peerConnection上。因为信息是他传过来的，所以是remote
  remotePC.createAnswer().then((answer) => { // 创建对应的应答（包含sdp信息）
    remotePC.setLocalDescription(answer) // 因为这个应答是我本地创建的，所以是local
    socket.emit('answer', {
      from: socketId,
      to: data.from,
      sdp: answer.sdp
    })
  })
})

socket.on('answer', (data) => { // 我加入房间后，向其他人offer（sdp信息），其他人answer（他们的sdp），我收到他们的answer
  console.log('收到answer', data)
  const pc = createPeerConnection(data.from) // 找到创建的其他人对应的peerConnection
  const rtcDescription = { type: 'answer', sdp: data.sdp }
  pc.setRemoteDescription(rtcDescription) // sdp信息是其他人传过来的，所以是remote
})

socket.on('candidate', (data) => {
  console.log('收到candidate', data)
  const pc = createPeerConnection(data.from)
  const iceCandidate = new RTCIceCandidate(data.candidate) // 收到消息后，在本地创建ice，在本地关于对方的PeerConnection上，放入对方传的sdp信息
  pc.addIceCandidate(iceCandidate)
})

socket.on('exit', (data) => {
  console.log('收到有人exit', data) // 有人退出房间了
  const pc = rtcConnections[data.from]
  if (pc) {
    createPeerConnection(data.socketId).close()
    delete rtcConnections[data.from]
    document.querySelector('#remote-video-container').removeChild(document.querySelector(`#${data.from}`))
  }
})
