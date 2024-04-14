// import io from 'socket.io-client'
import { uploadApi, getFiles } from "../api/upload";
const socket = io('http://127.0.0.1:12306', {
  withCredentials: true
});
console.log('socket', socket)

let socketId,
    myVideo,
    localStream = null,
    peers = {}, // 房间内所有人
    selfTrack,
    username,
    recorder,
    user,
    shareStream,
    senders = [],
    shareTrack = null,
    shareScreen = false, // 标记自己是否正在进行屏幕共享
    sponsor = null,
    userList = [],
    local = null

const config = {
  iceServers: [
    { urls: 'stun:stun.xten.com' }
  ]
}
// 初始化
socket.on('connect', () => {
  console.log('【connect】', socket.id)
  socketId = socket.id
})
console.log(123123)

// 获取本地媒体流（MediaStream）信息，并保存
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  selfTrack = stream.getVideoTracks()[0]
  localStream = stream
  // const tracks = stream.getTracks()
  // console.log(tracks)
  console.log('本地媒体流 ===>', localStream)
})

document.querySelector('#login').onclick = () => {
  username = document.querySelector('#input').value
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

let roomId = null
document.querySelector('#create-btn').onclick = () => {
  roomId = Math.random().toString(32).slice(-8);
  if (user) {
    socket.emit('create', {
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
    if (peers[socketId]) {
        alert('您已经在房间中')
        return
    }
    if (roomId) {
      socket.emit('join', {
        user,
        roomId,
        from: socketId
      })
    }
    else {
      alert('请输入房间号或创建房间')
    }
  } else {
    alert('请先登录')
  }
}

document.querySelector('#exit-btn').onclick = () => {
  socket.emit('exit', {
    roomId,
    from: socketId
  })
  selfTrack.stop()
  for (const prop in peers) {
    peers[prop].close()
    peers[prop] = null
  }
  roomId = null
  peers = {}
  document.querySelector('#remote-video-container').innerHTML = '' // 当前用户退出，将看不到所有人的video
  document.querySelector('#my-video-container').removeChild(document.querySelector('#my-video'))
}

document.querySelector('#send-btn').onclick = () => {
  if (!peers[socketId]) {
    alert('请先进入房间')
    return
  }
  const message = document.querySelector('#textarea').value
  console.log(message)
  if (message.trim() !== '') {
    socket.emit('message', {
      from: socketId,
      msg: message,
      username
    })
    const talkBox = document.createElement('div')
    talkBox.innerText = `${username}: ${message}`
    const chatContent = document.querySelector('.chat-content')
    chatContent.appendChild(talkBox)
  }
}

document.querySelector('.start_btn').onclick = () => {
  if (!peers[socketId]) {
    alert('请先加入房间')
    return
  }
  console.log('开始录制')
  recordStart(recorder)
}

document.querySelector('.pause_btn').onclick = () => {
  console.log('暂停录制')
  recordPause(recorder)
}

document.querySelector('.resume_btn').onclick = () => {
  console.log('继续录制')
  recordResume(recorder)
}

document.querySelector('.stop_btn').onclick = () => {
  console.log('结束录制')
  recordStop(recorder)
}

document.querySelector('.share_on_btn').onclick = () => {
  console.log('开启屏幕共享') // 更改的是视频流
  navigator.mediaDevices.getDisplayMedia().then((stream) => {
    shareStream = stream
    shareTrack = stream.getVideoTracks()[0];
    shareScreen = true
    // for(const prop in peers) {
    //   if (prop !== socketId) {
    //     const senders = peers[prop].getSenders()
    //     const index = senders.findIndex(item => item.track && item.track.kind === 'video')
    //     if (index !== -1) {
    //       peers[prop].removeTrack(senders[index])
    //       peers[prop].addTrack(track, localStream)
    //     }
    //   }
    // }
    for(const prop in peers) {
      if (prop !== socketId) {
        const senders = peers[prop].getSenders()
        const index = senders.findIndex(item => item.track && item.track.kind === 'video') // 替换videoTrack
        if (index !== -1) {
          senders[index].replaceTrack(shareTrack)
        }
      }
    }
    console.log('== 共享时的senders ==', senders)
    getRTCSenders()
    const myVideo = document.getElementById('my-video')
    myVideo.srcObject = stream
    myVideo.play()
    socket.emit('shareScreen', {
      from: socketId
    })
    stream.getVideoTracks()[0].onended = handleShareScreenEnded
  })
}

function handleShareScreenEnded(e) {
  console.log('handleShareScreenEnded', e)
  console.log('==========')
  const videoTrack = localStream.getVideoTracks()[0]
  for (const prop in peers) {
    if (prop !== socketId && shareTrack) {
      const senders = peers[prop].getSenders()
      const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
      if (index !== -1) {
        senders[index].replaceTrack(videoTrack)
      }
    }
  }
  document.getElementById('my-video').srcObject = localStream
  console.log('共享结束时 senders ===>', senders)
  getRTCSenders()
  socket.emit('shareClose', {
    from: socketId
  })
  console.log('==========')
}

function getRTCSenders() {
  for (const prop in peers) {
    const senders = peers[prop].getSenders()
    console.log(`【${prop}】: `, senders)
  }
}

document.querySelector('.share_off_btn').onclick = () => {
  console.log('结束屏幕共享')
  shareScreen = false
  const videoTrack = localStream.getVideoTracks()[0]
  // for (const prop in peers) {
  //   if (prop !== socketId && shareTrack) {
  //     const senders = peers[prop].getSenders()
  //     const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
  //     if (index !== -1) {
  //       peers[prop].removeTrack(senders[index])
  //       peers[prop].addTrack(videoTrack, localStream)
  //       senders[index].replaceTrack()
  //     }
  //   }
  // }
  for (const prop in peers) {
    if (prop !== socketId && shareTrack) {
      const senders = peers[prop].getSenders()
      const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
      if (index !== -1) {
        senders[index].replaceTrack(videoTrack)
      }
    }
  }
  document.getElementById('my-video').srcObject = localStream
  console.log('共享结束时 senders ===>', senders)
  getRTCSenders()
  socket.emit('shareClose', {
    from: socketId
  })
  shareTrack.stop()
}


document.querySelector('.mute_on_btn').onclick = () => {
  muteOn()
}

function muteOff() {
  console.log('取消静音')
  const tracks = localStream.getAudioTracks()
  tracks.forEach(t => {
    if (t.kind === 'audio' && t.enabled === false) {
      t.enabled = true
    }
  })
}

function muteOn() {
  console.log('静音')
  const tracks = localStream.getAudioTracks()
  tracks.forEach(t => {
    if (t.kind === 'audio' && t.enabled === true) {
      t.enabled = false
    }
  })
}

document.querySelector('.mute_off_btn').onclick = () => {
  muteOff()
}

document.querySelector('.video_on_btn').onclick = () => {
  console.log('开启视频')
  const tracks = localStream.getVideoTracks()
  tracks.forEach(t => {
    if (t.kind === 'video' && t.enabled === false) {
      t.enabled = true
    }
  })
}

document.querySelector('.video_off_btn').onclick = () => {
  console.log('关闭视频')
  const tracks = localStream.getVideoTracks()
  tracks.forEach(t => {
    if (t.kind === 'video' && t.enabled === true) {
      t.enabled = false
    }
  })
}

function WebRTC(socket, localStream) {
  this.socketId = socket;
  this.pc = this.createPeer(socket, localStream)
}

WebRTC.prototype.createPeer = function (socket, stream) {
  const peerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  const pc = new peerConnection(config);
  pc.onicecandidate = this.handleIceCandidate.bind(this);
  pc.ontrack = e => this.handleTrack(e, socketId);
  const tracks = stream.getTracks()
  tracks.forEach((track) => {
    const sender = pc.addTrack(track, stream)
    senders.push({
      sender,
      socketId: socket
    })
  })
  console.log('初始 senders ===>>>', senders)
  peers[socket] = pc
  console.log('peers ===>>', peers)
  return pc
}

// WebRTC.prototype.handleTrack = function (event) {
//   console.log('track', event)
//   if (shareScreen) { // 我自己在进行屏幕共享，这时候有人进入房间，我在本地创建这个人的远端建立连接，触发了handleTrack函数
//     // 因此，这里的this是针对加入者的WebRTC实例
//     // 这里track会触发两次，一个audio，一个video
//     if (event.track.kind === 'video') {
//       const senders = this.pc.getSenders()
//       const sender = senders.filter(item => item.track.kind === 'video')[0]
//       sender.replaceTrack(shareTrack)
//     }
//   }
//   let video = document.getElementById(this.socketId)
//   if (!video) {
//     video = document.createElement('video')
//     video.id = this.socketId
//     video.width = 200
//     video.height = 200
//     if ('srcObject' in video) {
//       video.srcObject = event.streams[0];
//     } else if ('mozSrcObject' in video) {
//       video.mozSrcObject = event.streams[0]
//     } else if ('webkitSrcObject' in video) {
//       video.webkitSrcObject = event.streams[0]
//     } else {
//       video.src = window.URL.createObjectURL(event.streams[0]);
//     }
//     document.querySelector('#remote-video-container').appendChild(video)
//     video.onloadedmetadata = function(e) {
//       video.play();
//     }
//   } else {
//     video.srcObject = event.streams[0]
//     shareStream = event.streams[0]
//   }
// }

WebRTC.prototype.handleTrack = function (event, socketId) {
  const userInfo = userList.find(item => item.user === user)
  if (userInfo && userInfo.socketId === this.socketId) {
    // 当前用户是发起人
    return
  }
  if (shareScreen) { // 我自己在进行屏幕共享，这时候有人进入房间，我在本地创建这个人的远端建立连接，触发了handleTrack函数
    // 因此，这里的this是针对加入者的WebRTC实例
    // 这里track会触发两次，一个audio，一个video
    if (event.track.kind === 'video') {
      const senders = this.pc.getSenders()
      const sender = senders.filter(item => item.track.kind === 'video')[0]
      sender.replaceTrack(shareTrack)
    }
  }
  if (event.track.kind === 'video') {
    const video = document.createElement('video')
    video.width = 300
    video.height = 200
    const title = document.createElement('div')
    title.innerText = userList.filter(item => item.socketId = socketId)[0].user
    title.height = 50
    title.style.position = 'absolute'
    title.style.top = '10px'
    title.style.color = '#fff'
    title.style.background = '#000'
    const videoCon = document.createElement('div')
    videoCon.style.position = 'relative'
    videoCon.appendChild(video)
    videoCon.appendChild(title)
    document.querySelector('#remote-video-container').appendChild(videoCon)
    video.srcObject = event.streams[0]
    video.onloadedmetadata = function(e) {
      video.play();
    }
  }
}

WebRTC.prototype.handleIceCandidate = function (event) {
  if (event.candidate) {
    for (const prop in peers) {
      if (prop !== socketId) {
        socket.emit('ice', {
          from: socketId,
          to: prop, // 新加入成员
          roomId,
          ice: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          }
        })
      }
    }
  }
}

socket.on('created', (data) => {
  document.querySelector('#room').value = data.roomId
  sponsor = data.sponsor
  console.log(sponsor)
})

// livestream（需要区分加入的人是否是sponsor，sponsor加入后直播才开始）
// socket.on('joined', (data) => {
//   console.log('【joined】', data)
//   if (sponsor === data.user) {
//     console.log('I(sponsor) join room')
//     userList.push({
//       user: data.user,
//       socketId: data.from
//     })
//     socket.emit('sponsor', {
//       from: sponsor,
//       socketId
//     })
//     local = new WebRTC(socketId, localStream) // 加入房间时，在本地创建自己的peerConnection
//     console.log('我加入了房间', peers[socketId])
//     myVideo = document.createElement('video')
//     myVideo.width = 300
//     myVideo.height = 200
//     myVideo.setAttribute('id', 'my-video')
//     const myVideoContainer = document.querySelector('#my-video-container')
//     myVideoContainer.appendChild(myVideo)
//     if ('srcObject' in myVideo) {
//       myVideo.srcObject = localStream;
//     } else if ('mozSrcObject' in myVideo) {
//       myVideo.mozSrcObject = localStream
//     } else if ('webkitSrcObject' in myVideo) {
//       myVideo.webkitSrcObject = localStream
//     } else {
//       myVideo.src = window.URL.createObjectURL(localStream);
//     }
//     myVideo.onloadedmetadata = function(e) {
//       myVideo.play();
//     }
//   } else if (userList.find(item => sponsor === item.user) !== 'undefined') {
//     console.log('sponsor already in room')
//     userList.push({
//       user: data.user,
//       socketId: data.from
//     })
//     if (data.from !== socketId) {
//       console.log('有人加入房间', data)
//       if (user === sponsor) {
//         socket.emit('sponsor', {
//           from: sponsor,
//           socketId
//         })
//       }
//     } else {
//       const _socketId = userList.find(item => item.user === sponsor).socketId // sponsor的socketId
//       console.log('我加入房间，我不是sponsor', _socketId)
//       const remote = new WebRTC(_socketId, localStream)
//       remote.pc.createOffer().then((offer) => {
//         remote.pc.setLocalDescription(offer)
//         socket.emit('offer', {
//           from: socketId,
//           to: _socketId,
//           offer
//         })
//       })
//     }
//   } else {
//     console.log('sponsor is not in room')
//   }
// })

socket.on('sponsor', (data) => {
  console.log('sponsor', data)
  sponsor = data.from
  userList.push({
    user: data.from,
    socketId: data.socketId
  })
})
 
// 有人加入房间，所有人收到加入信息。
// 我收到我自己的加入信息
// 我收到别人的加入信息
// remote
socket.on('joined', (data) => {
  userList.push({
    user: data.user,
    socketId: data.from
  })
  if (data.from !== socketId) {
    console.log('有人加入房间', data)
    if (shareScreen) {
      socket.emit('onShare', {
        from: socketId,
        to: data.from
      })
    }
    new WebRTC(data.from, localStream)
  } else {
    new WebRTC(socketId, localStream) // 加入房间时，在本地创建自己的peerConnection
    console.log('我加入了房间', peers[socketId])
    myVideo = document.createElement('video')
    myVideo.width = 300
    myVideo.height = 200
    myVideo.setAttribute('id', 'my-video')
    const myVideoContainer = document.querySelector('#my-video-container')
    myVideoContainer.appendChild(myVideo)
    if ('srcObject' in myVideo) {
      myVideo.srcObject = localStream;
    } else if ('mozSrcObject' in myVideo) {
      myVideo.mozSrcObject = localStream
    } else if ('webkitSrcObject' in myVideo) {
      myVideo.webkitSrcObject = localStream
    } else {
      myVideo.src = window.URL.createObjectURL(localStream);
    }
    myVideo.onloadedmetadata = function(e) {
      myVideo.play();
    }
    getMediaRecord(localStream)
    if (data.peers.length > 0) { // 房间内还有其他人
      data.peers.forEach((p) => {
        const peer = new WebRTC(p, localStream) // 我加入房间时，在本地创建房间内其他人的RemotePeerConnection
        peer.pc.createOffer().then((offer) => {
          peer.pc.setLocalDescription(offer);
          socket.emit('offer', {
            roomId,
            from: socketId,
            to: peer.socketId,
            offer
          })
        })
      })
    }
  }
})

socket.on('offer', (data) => {
  if (data.from !== socketId) {
    const sdp = new RTCSessionDescription({
      'type': 'offer',
      'sdp': data.offer.sdp
    })
    peers[data.from].setRemoteDescription(sdp)
    peers[data.from].createAnswer().then((answer) => {
      peers[data.from].setLocalDescription(answer)
      socket.emit('answer', {
        from: socketId,
        to: data.from,
        answer
      })
    })
  }
})

// socket.on('offer', (data) => {
//   const sdp = new RTCSessionDescription({
//     'type': 'offer',
//     'sdp': data.offer.sdp
//   })
//   local.pc.setRemoteDescription(sdp)
//   local.pc.createAnswer().then((answer) => {
//     local.pc.setLocalDescription(answer)
//     socket.emit('answer', {
//       from: socketId,
//       to: data.from,
//       answer
//     })
//   })
// })

socket.on('answer', (data) => {
  const sdp = new RTCSessionDescription({
    'type': data.answer.type,
    'sdp': data.answer.sdp
  })
  peers[data.from].setRemoteDescription(sdp)
})

socket.on('ice', (data) => {
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: data.ice.sdpMLineIndex,
    candidate: data.ice.candidate
  })
  peers[data.from].addIceCandidate(candidate)
})

// socket.on('ice', (data) => {
//   console.log(data)
//     const candidate = new RTCIceCandidate({
//     sdpMLineIndex: data.ice.sdpMLineIndex,
//     candidate: data.ice.candidate
//   })
//   local.pc.addIceCandidate(candidate)
// })

socket.on('exit', (data) => {
  console.log('收到有人exit', data, peers[data.from])
  delete peers[data.from]
  document.querySelector('#remote-video-container').removeChild(document.querySelector(`#${data.from}`))
})

socket.on('break', (data) => {
  console.log(`${data.from}断开连接`)
  const breakVideo = document.querySelector(`#${data.from}`)
  if (breakVideo) {
    delete peers[data.from]
    document.querySelector('#remote-video-container').removeChild(breakVideo)
  }
})

socket.on('message', (data) => {
  console.log('收到消息', data)
  const talkBox = document.createElement('div')
  talkBox.style.width = '100%'
  talkBox.innerText = `${data.username}: ${data.msg}`
  const chatContent = document.querySelector('.chat-content')
  chatContent.appendChild(talkBox)
})

socket.on('share', (data) => {
  console.log('收到他人的屏幕共享', data)
  shareTrack = localStream.getVideoTracks()[0]
  // for (const prop in peers) {
  //   if (prop !== socketId) {
  //     const senders = peers[prop].getSenders()
  //     const index = senders.findIndex(item => item.track && item.track.kind === 'video')
  //     if (index !== -1) {
  //       peers[prop].removeTrack(senders[index])
  //       peers[prop].addTrack(shareTrack, localStream)
  //     }
  //   }
  // }
  for (const prop in peers) {
    if (prop !== socketId) {
      const senders = peers[prop].getSenders()
      const index = senders.findIndex(item => item.track && item.track.kind === 'video')
      if (index !== -1) {
        senders[index].replaceTrack(shareTrack)
      }
    }
  }
  console.log('== 共享时的senders ==', senders)
  getRTCSenders()
})

socket.on('shareClose', (data) => {
  console.log('收到屏幕共享关闭', data)
  const videoTrack = localStream.getVideoTracks()[0]
  // for (const prop in peers) {
  //   if (prop !== socketId) {
  //     const senders = peers[prop].getSenders()
  //     const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
  //     if (index !== -1) {
  //       peers[prop].removeTrack(senders[index])
  //       peers[prop].addTrack(videoTrack, localStream)
  //     }
  //   }
  // }
  for (const prop in peers) {
    if (prop !== socketId) {
      const senders = peers[prop].getSenders()
      const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
      if (index !== -1) {
        senders[index].replaceTrack(videoTrack)
      }
    }
  }
  console.log('共享结束时 senders ===>', senders)
  getRTCSenders()
})

socket.on('onShare', (data) => {
  console.log('该房间正在进行共享屏幕', data)
  const track = localStream.getVideoTracks()[0]
  const senders = peers[data.from].getSenders()
  const sender = senders.find(item => item.track.kind === 'video')
  if (sender) {
    sender.replaceTrack(track)
    shareTrack = localStream.getVideoTracks()[0]
  }
})

// 录制
function getMediaRecord(stream) {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=h264' });
  } else {
      recorder = new MediaRecorder(stream, {mimeType: 'video/mp4'})
  }
  recorder.ondataavailable = handleDataAvailable
}

function handleDataAvailable (e) {
  console.log('录制的video', e)
  if (e.data.size > 0) {
    // const recordVideo = document.createElement('video')
    // recordVideo.style.width = '300px';
    // recordVideo.style.height = '200px';
    // recordVideo.setAttribute('controls', true)
    // recordVideo.src = window.URL.createObjectURL(e.data)
    // document.querySelector('#my-video-container').appendChild(recordVideo)
    const formdata = new FormData()
    formdata.append('file', e.data)
    uploadApi(formdata).then((res) => {
      console.log(res)
      getFiles().then((resp) => {
        console.log(resp)
      })
    })
  }
}

function recordStart(recorder) {
  recorder.start();
}

function recordPause(recorder) {
  recorder.pause();
}

function recordResume(recorder) {
  recorder.resume();
}

function recordStop(recorder) {
  recorder.stop();
}
