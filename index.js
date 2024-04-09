const express = require('express');
const app = express();
const { Server } = require('socket.io');
const http = require('http');
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: ["http://127.0.0.1:12306"],
    credentials: true
  },
  pingTimeout: 60000,
})

let room;
let clientsInRoom;
io.on('connection', (socket) => {
  console.log('=== connection success ===', socket.id)

  socket.on('join', (data) => {
    const { user, roomId, from } = data;
    if (room !== roomId) {
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

  socket.on('offer', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('offer', data)
  })

  socket.on('answer', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('answer', data)
  })

  socket.on('ice', (data) => {
    const socketItem = io.sockets.sockets.get(data.to)
    socketItem.emit('ice', data)
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
    console.log(`=== disconnect === 【 ${reason} 】`)
    if (reason === 'client namespace disconnect') {
      console.log('客户端使用socket.disconnect()手动断开socket')
    } else if (reason === 'server namespace disconnect') {
      console.log('服务端使用socket.disconnect强行断开')
    } else if (reason === 'server shutting down') {
      console.log('服务器正在关闭')
    } else if (reason === 'ping timeout') {
      console.log('pingTimeout 客户端在延迟中没有发送 PONG 数据包')
    } else if (reason === 'transport close') {
      console.log('连接已关闭（例如：用户失去连接，或网络从 WiFi 更改为 4G）')
    } else if (reason === 'transport error') {
      console.log('连接遇到错误')
    }
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
