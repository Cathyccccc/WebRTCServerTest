const express = require('express');
const app = express();
const { Server } = require('socket.io');
// const https = require('https');
// const httpServer = https.createServer(app)
const http = require('http');
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: ["http://127.0.0.1:12306"],
    credentials: true
  }
})
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' })); // 解析json格式的请求体

const upload = multer({
  dest: path.resolve(__dirname, './Public/upload')
})

app.use(express.static(path.join(__dirname, '/Public/dist')));
app.get('*', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*") // 解决跨域问题
})

app.post('/upload', upload.single('file'), (req, res) => {
  console.log(req.file);
  res.send(req.file);
})

app.get('/file', (req, res) => {
  fs.readdir(path.resolve(__dirname, './Public/upload'), (err, files) => {
    if (err) {
      res.send(err);
    } else {
      res.send(files);
    }
  })
})

app.use('/delfile', (req, res) => {
  const name = req.body.data
  fs.unlink(path.join(path.resolve(__dirname, './Public/upload'), name), (err) => {
    if (err) {
      res.send({
        status: 0,
        msg: 'delete failed'
      })
    } else {
      res.send({
        status: 1,
        msg: 'delete success',
        data: name
      })
    }
  })
})

let room;
let clientsInRoom;
io.on('connection', (socket) => {
  console.log('=== connection success ===', socket.id)

  // socket.on('login', (data, callback) => {
  //   console.log('=== login ===', data)
  //   callback(data)
  // })

  // socket.on('create', (data) => {
  //   console.log('=== create ===', data)
  //   room = data.roomId
  //   socket.emit('created', data)
  //   // 数据库中存储房间id（meetingid）和初次邀请用户，被邀请用户界面上有入口
  // })

  socket.on('join', (data) => {
    const { user, roomId, from } = data;
    if (!room) {
      room = roomId; // 这里逻辑简化，第一个加入的人直接创建房间（房间号不同的话加入的是不同的房间）
    }
    socket.join(room); // 加入房间的机制由 Adapter 配置
    console.log('=== join room ===')
    clientsInRoom = Array.from(socket.adapter.rooms.get(roomId)) // 所有加入该房间的用户的socket id构成的数组
    const peers = clientsInRoom.filter(socketId => socketId !== data.from)
    // io.to 和 socket.to 的区别：socket.to 向房间发送消息时，不包括自己
    io.to(room).emit('joined', {
      from,
      user,
      peers
    })
  })

  socket.on('sponsor', (data) => {
    socket.broadcast.emit('sponsor', data)
  })

  socket.on('offer', (data) => {
    // console.log('=== offer ===', data);
    const socketItem = io.sockets.sockets.get(data.to)
    console.log(socketItem.id)
    socketItem.emit('offer', data)
  })

  socket.on('answer', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('answer', data)
    // console.log('=== answer ===', data, socketItem.id)
  })

  socket.on('ice', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('ice', data)
    console.log('=== ice ===', data, socketItem.id)
  })

  socket.on('exit', (data) => {
    console.log('=== exit ===', data)
    if (socket.rooms.has(data.roomId)) {
      socket.leave(data.roomId)
      io.to(data.roomId).emit('exit', data) // 将某人退出的消息传递给房间内的其他人
      socket.emit('exited', { success: true })
    } else {
      socket.emit('exited', { success: false, error: 'Not in room' })
    }
  })

  socket.on('message', (data) => {
    console.log('=== message ===', data)
    socket.to(room).emit('message', data)
  })

  socket.on('shareScreen', (data) => {
    console.log('=== shareScreen ===', data)
    socket.to(room).emit('share', data)
  })

  socket.on('shareClose', (data) => {
    console.log('=== shareClose ===', data)
    socket.to(room).emit('shareClose', data)
  })

  socket.on('onShare', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('onShare', data)
  })

  socket.on('disconnect', (reason) => {
    console.log('=== disconnect ===', reason)
    socket.to(room).emit('break', { // 房间内某个人断开通知到个人
      from: socket.id
    })
  })
})

const stun = require('stun')
stun.request('127.0.0.1', (err, res) => {
  if (err) {
    console.error(err);
  } else {
    const { address } = res.getXorAddress();
    console.log('your ip', address);
    console.log(res);
  }
});

httpServer.listen(12306, () => { // 如果使用createServer，这里必须用createServer来监听端口，不能再使用app监听了
  console.log('服务器监听12306端口')
})
