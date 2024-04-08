import io from 'socket.io-client'
// import { uploadApi, getFiles } from "../api/upload";
import { getRandomStr, getRTCSenders, getStreamTracks } from './util';
let socket = null;
let socketId, // 当前用户的 socket.id
  localStream = null, // 本地流（摄像头视频流或屏幕共享流）
  peers = {}, // 房间内所有人
  selfTrack = null,
  username, // 用户进入房间时的用户名
  recorder,
  shareStream,
  senders = [],
  shareTrack = null,
  shareScreen = false, // 标记自己是否正在进行屏幕共享
  sponsor = null,
  userList = [],
  roomId = null,
  shareId = null
socket = io('http://127.0.0.1:12306', {
  withCredentials: true,
  autoConnect: false
});
// console.log('socket', socket)
// 初始化

socket.on('connect', () => {
  socketId = socket.id
  console.log(`【 ${socketId} connect success】`)
})
socket.on('reconnect', function (attemptNumber) {
  console.log(`【Reconnected to the server after ${attemptNumber} attempts!`);
})
socket.on('reconnect_attempt', function (attemptNumber) {
  console.log(`【Attempting to reconnect to the server ( ${attemptNumber} )】`);
});
socket.on('disconnect', function (reason) {
  if (reason === 'io server disconnect') {
    // 服务器正常关闭连接  
    console.log('【正常断开】')
  } else {
    // 处理非正常断开连接的情况  
    console.log('【非正常断开】')
  }
});
socket.on('error', function (err) {
  console.error(`【Socket.IO error: ${err}】`);
});
socket.on('joined', joinListener)
socket.on('offer', offerListener)
socket.on('answer', answerListener)
socket.on('ice', iceListener)
socket.on('exit', exitListener)
socket.on('break', breakListener)
socket.on('message', messageListener)
socket.on('share', shareListener)
socket.on('shareClose', shareCloseListener)
socket.on('onShare', onShareListener)
socket.on('exited', exitedListener)

// 有人进入房间
// 1.判断是我加入房间还是其他人加入房间
// （1）我加入房间，如果房间内有其他人，需要我创建我的视频，我的peer，并创建其他人的视频，其他人的peer
// （2）其他人加入房间，需要再创建房间内其他人的视频，其他人的peer
// 2.判断当前加入房间时的状态：是摄像头视频流（是否开启）还是屏幕视频流（屏幕共享）

function joinListener(data) {
  userList.push({
    user: data.user,
    socketId: data.from
  })
  if (data.from === socketId) {
    // 我加入房间
  }
  if (data.from !== socketId) {
    console.log(`【有人加入房间：${data.from}】`)
    if (shareScreen && shareId === socketId) { // 我正在进行屏幕共享，我通知进来的人
      socket.emit('onShare', {
        from: socketId,
        to: data.from
      })
    }
    new WebRTC(data.from, localStream)
  } else {
    new WebRTC(socketId, localStream) // 加入房间时，在本地创建自己的peerConnection
    console.log('【我加入房间】')
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
    const _myVideo = createVideoBox(socketId)
    setStream(_myVideo, localStream)
  }
}
function offerListener(data) {
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
}
function answerListener(data) {
  const sdp = new RTCSessionDescription({
    'type': data.answer.type,
    'sdp': data.answer.sdp
  })
  peers[data.from].setRemoteDescription(sdp)
}
function iceListener(data) {
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: data.ice.sdpMLineIndex,
    candidate: data.ice.candidate
  })
  peers[data.from].addIceCandidate(candidate)
}
function exitListener(data) {
  console.log(`【收到有人exit：${data.from}】`)
  delete peers[data.from]
  senders = senders.filter(item => item.socketId !== data.from)
  const _removeVideoBox = document.getElementById(data.from).parentElement
  _videoList.removeChild(_removeVideoBox)
}
function breakListener(data) {
  console.log(`【${data.from} 断开连接】`)
  try {
    const breakVideo = document.querySelector(`#${data.from}`)
    _videoList.removeChild(breakVideo.parentElement)
    delete peers[data.from]
  } catch (error) {
    console.log(error)
  }
}
function messageListener(data) {
  const talkBox = document.createElement('div')
  talkBox.style.width = '100%'
  talkBox.innerText = `${data.username}: ${data.msg}`
  const chatContent = document.querySelector('.chat-content')
  chatContent.appendChild(talkBox)
}
function shareListener(data) {
  console.log(`【收到 ${data.from} 的屏幕共享】`)
  shareScreen = true
  shareId = data.from
  showLarge(data.from)
}
function showLarge(socket_id) {
  try {
    const _video = document.getElementById(socket_id)
    const _parentBox = _video.parentElement
    _parentBox.classList.add('large')
    _parentBox.width = _videoList.width;
    _parentBox.height = _videoList.height;
  } catch (error) {
    console.log(error, '要放大：',socket_id, '本地：', socketId)
  }
}
function shareCloseListener(data) {
  console.log(`【收到 ${data.from} 的屏幕共享关闭】`)
  shareScreen = false
  shareId = null
  const _video = document.getElementById(data.from)
  const _parentBox = _video.parentElement
  _parentBox.classList.remove('large')
  // setStream(_video, localStream)
}
function onShareListener(data) {
  console.log(`【该房间正在进行屏幕共享，共享人 ${data.from} 】`)
  shareScreen = true;
  shareId = data.from;
}
function exitedListener(data) {
  if (data.success) {
    console.log('成功退出房间')
  } else {
    console.log('退出房间失败', data.error)
  }
}

const _videoList = document.querySelector('#video-list')
// 两个异步：防止用户再次进入房间时获取不到socket和本地流数据（需要更新）
function getConnect() {
  return new Promise((resolve, reject) => {
    socket.connect()
    socket.on('connect', () => {
      resolve()
    })
  }).catch(err => console.log(err))
}
function getUserMedia() {
  const getUserMedia = (navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia)
  // 获取本地的媒体流，并绑定到一个video标签上输出，并且发送这个媒体流给其他客户端
  return new Promise((resolve, reject) => {
    getUserMedia.call(navigator, {
      video: true,
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        simpleSize: 16
      }
    }, (stream) => {
      // 绑定本地媒体流到video标签用于输出
      localStream = stream
      selfTrack = stream.getVideoTracks()[0]
      resolve()
    }, function (error) {
      reject(error)
      // console.log(error);
      // 处理媒体流创建失败错误
    })
  })
}

function WebRTC(socket_id, localStream) {
  this.socketId = socket_id;
  this.pc = this.createPeer(socket_id, localStream)
}

const config = {
  iceServers: [
    { url: 'stun:stun.xten.com' }
  ]
}

WebRTC.prototype.createPeer = function (socket_id, stream) {
  console.log('【createPeer】')
  const peerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  const pc = new peerConnection(config);
  pc.onicecandidate = this.handleIceCandidate.bind(this);
  pc.ontrack = this.handleTrack.bind(this);
  const tracks = stream.getTracks()
  tracks.forEach((track) => {
    const sender = pc.addTrack(track, stream)
    senders.push({
      sender,
      socketId: socket_id
    })
  })
  peers[socket_id] = pc
  return pc
}

WebRTC.prototype.handleTrack = function (event) {
  if (event.track.kind === 'audio') return; // 不是 video 不进行后续处理。
  console.log('【handleTrack】', this.socketId, event.streams[0], localStream, shareStream)
  // 因为addTrack时会触发两次，所以这里只需要一次来创建其他人的video即可；而replaceTrack只触发一次
  const video = document.getElementById(this.socketId)
  if (!video) {
    if (this.socketId !== socketId) {
      const _otherVideo = createVideoBox(this.socketId)
      setStream(_otherVideo, event.streams[0])
    }
  }
  if (shareScreen && socketId !== shareId) {
    showLarge(shareId)
  }
  if (shareScreen && socketId === shareId) {
    console.log('when i sharing someone comes in')
    // 重新通过sender替换video track，更新共享流数据。因为此时用户进入房间时，之前的track是没有连接到新用户的
    const senders = this.pc.getSenders()
    const sender = senders.filter(item => item.track.kind === 'video')[0]
    sender.replaceTrack(shareTrack)
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
function createVideoBox(socket_id) {
  const _video = document.createElement('video');
  _video.style.width = '100%'
  _video.style.height = '100%'
  _video.id = socket_id; // 设置id为视频的标识符
  const _title = document.createElement('div');
  _title.innerText = socket_id
  const _videoBox = document.createElement('div')
  _videoBox.className = 'video-box'
  _videoBox.style.position = 'relative'
  _videoBox.appendChild(_video)
  _videoBox.appendChild(_title)
  _videoList.appendChild(_videoBox)
  return _video;
}

function setStream(video, stream) {
  if ('srcObject' in video) {
    video.srcObject = stream
  } else if ('mozSrcObject' in video) {
    video.mozSrcObject = stream
  } else if ('webkitSrcObject' in video) {
    video.webkitSrcObject = stream
  } else {
    video.src = window.URL.createObjectURL(stream)
  }
  video.onloadedmetadata = function () {
    video.play()
  }
}

// 用户输入用户名
const _inputUserName = document.querySelector('#username');
_inputUserName.addEventListener('blur', () => {
  username = _inputUserName.value;
})

// 随机生成房间号
const _btnRandom = document.querySelector('.btn-random');
const _inputRoomId = document.querySelector('#roomId');
_btnRandom.addEventListener('click', () => {
  roomId = getRandomStr();
  _inputRoomId.value = roomId;
})
// 输入房间号
_inputRoomId.addEventListener('change', () => {
  roomId = _inputRoomId.value;
})

// 用户点击进入房间按钮
const _btnLogin = document.querySelector('#btn-login');
const _mask = document.querySelector('.mask');
_btnLogin.addEventListener('click', async () => {
  if (!username) {
    alert('请输入用户名')
    return
  }
  if (!roomId) {
    alert('请输入房间号')
    return
  }
  await getConnect()
  await getUserMedia()
  if (!socketId) {
    console.log('socketId 不存在')
    return
  }
  if (!localStream) {
    console.log('localStream 不存在')
  }
  socket.emit('join', {
    roomId,
    user: username,
    from: socketId
  })
  _mask.style.display = 'none';
  _inputUserName.value = null;
  _inputRoomId.value = null;
})

const _chatContent = document.querySelector('.chat-content')
document.querySelector('#exit-btn').onclick = () => {
  socket.emit('exit', {
    roomId,
    from: socketId
  })
  selfTrack.stop()
  socket.offAny() // 删除所有 注册的listener
  socket.close()
  roomId = null
  peers = {}
  socketId = undefined
  selfTrack = null
  username = undefined
  localStream = null
  shareStream = null
  senders = []
  shareTrack = null
  shareScreen = false
  userList = []
  _mask.style.display = 'block'
  _chatContent.innerHTML = null
  _videoList.innerHTML = null
}

const _textarea = document.querySelector('#textarea')
document.querySelector('#send-btn').onclick = () => {
  if (!peers[socketId]) {
    alert('请先进入房间')
    return
  }
  const message = _textarea.value
  if (message.trim() !== '') {
    socket.emit('message', {
      from: socketId,
      msg: message,
      username
    })
    const talkBox = document.createElement('div')
    talkBox.innerText = `${username}: ${message}`

    _chatContent.appendChild(talkBox)
    _textarea.value = ''
  }
}

document.querySelector('.share_on_btn').onclick = () => {
  console.log('【我开启屏幕共享】') // 更改的是视频流
  if (shareScreen) {
    alert('正在屏幕共享')
    return
  }
  navigator.mediaDevices.getDisplayMedia().then((stream) => {
    shareStream = stream
    console.log('shareStream: ', stream)
    shareScreen = true
    shareId = socketId
    shareTrack = stream.getVideoTracks()[0];
    for (const prop in peers) {
      if (prop !== socketId) {
        const senders = peers[prop].getSenders()
        const index = senders.findIndex(item => item.track && item.track.kind === 'video') // 替换videoTrack
        if (index !== -1) {
          senders[index].replaceTrack(shareTrack)
        }
      }
    }
    const myVideo = document.getElementById(socketId)
    setStream(myVideo, stream)
    socket.emit('shareScreen', {
      from: socketId
    })
    stream.getVideoTracks()[0].onended = handleShareScreenEnded
  })
}

function handleShareScreenEnded() {
  shareScreen = false
  shareId = null
  console.log('【handleShareScreenEnded】')
  for (const prop in peers) {
    if (prop !== socketId && shareTrack) {
      const senders = peers[prop].getSenders()
      const index = senders.findIndex(item => item.track && item.track.id === shareTrack.id)
      if (index !== -1) {
        senders[index].replaceTrack(selfTrack) // 将共享流替换为本地流
      }
    }
  }
  const _myVideo = document.getElementById(socketId)
  setStream(_myVideo, localStream)
  socket.emit('shareClose', {
    from: socketId
  })
}

document.querySelector('.share_off_btn').onclick = () => {
  if (shareId !== socketId) return // 不能结束别人的屏幕共享
  if (!shareScreen) {
    console.log('【没有共享屏幕】')
    return
  }
  console.log('【我结束屏幕共享】')
  handleShareScreenEnded() // 如果是使用浏览器的【停止共享】按钮，是不会走按钮click的代码的；而按钮click时，需要手动调用停止共享逻辑，也就是下面的stop方法
  shareTrack.stop()
}

const _btnMuteOn = document.querySelector('.mute_on_btn')
const _btnMuteOff = document.querySelector('.mute_off_btn')
_btnMuteOn.onclick = () => {
  muteOn()
  _btnMuteOn.disabled = true
  _btnMuteOff.disabled = false
}

function muteOff() {
  console.log('【取消静音】')
  const tracks = localStream.getAudioTracks()
  tracks.forEach(t => {
    if (t.kind === 'audio' && t.enabled === false) {
      t.enabled = true
    }
  })
}

function muteOn() {
  console.log('【静音】')
  const tracks = localStream.getAudioTracks()
  tracks.forEach(t => {
    if (t.kind === 'audio' && t.enabled === true) {
      t.enabled = false
    }
  })
}

_btnMuteOff.onclick = () => {
  muteOff()
  _btnMuteOff.disabled = true
  _btnMuteOn.disabled = false
}

document.querySelector('.video_on_btn').onclick = () => {
  console.log('【开启视频】')
  const tracks = localStream.getVideoTracks()
  tracks.forEach(t => {
    if (t.kind === 'video' && t.enabled === false) {
      t.enabled = true
    }
  })
}

document.querySelector('.video_off_btn').onclick = () => {
  console.log('【关闭视频】')
  const tracks = localStream.getVideoTracks()
  tracks.forEach(t => {
    if (t.kind === 'video' && t.enabled === true) {
      t.enabled = false
    }
  })
}



// 录制
function getMediaRecord(stream) {
  if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=h264' });
  } else {
    recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' })
  }
  recorder.ondataavailable = handleDataAvailable
}

function handleDataAvailable(e) {
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
    // uploadApi(formdata).then((res) => {
    //   console.log(res)
    //   getFiles().then((resp) => {
    //     console.log(resp)
    //   })
    // })
  }
}

// document.querySelector('.start_btn').onclick = () => {
//   if (!peers[socketId]) {
//     alert('请先加入房间')
//     return
//   }
//   console.log('开始录制')
//   recordStart(recorder)
// }

// document.querySelector('.pause_btn').onclick = () => {
//   console.log('暂停录制')
//   recordPause(recorder)
// }

// document.querySelector('.resume_btn').onclick = () => {
//   console.log('继续录制')
//   recordResume(recorder)
// }

// document.querySelector('.stop_btn').onclick = () => {
//   console.log('结束录制')
//   recordStop(recorder)
// }

// function recordStart(recorder) {
//   recorder.start();
// }

// function recordPause(recorder) {
//   recorder.pause();
// }

// function recordResume(recorder) {
//   recorder.resume();
// }

// function recordStop(recorder) {
//   recorder.stop();
// }
