const express = require('express');
const app = express();
const socketIO = require('socket.io');
const http = require('http');
const server = http.createServer(app)
const io = socketIO(server)
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // 解析json格式的请求体

const upload = multer({
  dest: path.resolve(__dirname, './Public/upload')
})

app.use(express.static(path.join(__dirname, '/Public/dist')));
// app.get('*', (req, res) => {
//   return 
// })

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

let roomId;
let clientsInRoom;
io.on('connection', (socket) => {
  console.log('=== connection success ===', socket.id)
  socket.on('createRoom', (data) => {
    console.log('=== createRoom ===', data);
    roomId = data.roomId
    socket.emit('created', {
      sponsor: data.sponsor,
      roomId: data.roomId
    })
    // 数据库中存储房间id（meetingid）和初次邀请用户，被邀请用户界面上有入口
  })

  socket.on('joinRoom', (data) => {
    console.log(`=== ${data.username} join room ===`, data)
    socket.join(roomId); // 不会重复进入房间（先进来的在前，后进来的在后）
    clientsInRoom = Array.from(socket.adapter.rooms.get(roomId)) // 所有加入该房间的用户的socket id构成的数组
    const peers = clientsInRoom.filter(socketId => socketId !== data.from) // 除当前加入者外，房间内其他人的socket id
    clientsInRoom.forEach((socketId) => {
      const socketItem = io.sockets.sockets.get(socketId)
      socketItem.emit('joined', {
        from: data.from,
        roomId,
        peers
      })
    })
  })

  socket.on('offer', (data) => { // 收到来自加入者的offer
    console.log('=== offer ===', data)
    clientsInRoom.forEach((socketId) => {
      if (socketId !== data.from) {
        const socketItem = io.sockets.sockets.get(socketId)
        socketItem.emit('offer', data) // 房间其他人各自给发送offer
      }
    })
  })

  socket.on('answer', (data) => {
    console.log('=== answer ===', data)
    clientsInRoom.forEach((socketId) => {
      if (socketId === data.to) {
        const socketItem = io.sockets.sockets.get(socketId)
        socketItem.emit('answer', data) // 将answer传递给想要传递的人
      }
    })
  })

  socket.on('candidate', (data) => {
    console.log('=== candidate ===', data)
    clientsInRoom.forEach((socketId) => {
      if (socketId === data.to) {
        const socketItem = io.sockets.sockets.get(socketId)
        socketItem.emit('candidate', data) // 将candidate传递给其他连接人
      }
    })
  })

  socket.on('exit', (data) => {
    console.log('=== exit ===', data)
    socket.leave(data.roomId)
    if (clientsInRoom) {
      clientsInRoom.forEach((socketId) => {
        if (socketId !== data.from) {
          const socketItem = io.sockets.sockets.get(socketId)
          socketItem.emit('exit', data) // 将某人退出的消息传递给其他人
        }
      })
    }
  })

  socket.on('disconnect', (reason) => {
    console.log('=== disconnect ===', reason)
    socket.broadcast.emit('exit', {
      from: socket.id,
      roomId: ''
    })
  })
})

server.listen(12306, () => { // 如果使用createServer，这里必须用createServer来监听端口，不能再使用app监听了
  console.log('服务器监听12306端口')
})
