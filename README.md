main 分支虽然基本逻辑完成了，但易报错。noMainVideo 分支中每个 vidoe 的大小是一样的，没有main video，共享时界面放大直接共享者的远端 video 。

如果是有 main video 的情况，涉及到很多 replaceTrack 去替换 main video 的 video track，然后重新设置 video 的 MediaStream 。

noMainVideo 分支部署时，需要修改以下内容：

1. index.js 需引入证书，然后创建 server 时配置进去（证书提前配置好，因为 WebRTC 需要 https）：

```js
var options = {
    key: fs.readFileSync("./cert/server.key", 'utf8'),
    cert: fs.readFileSync("./cert/server.crt", 'utf8')
};

const httpServer = http.createServer(options, app)
const io = new Server(httpServer, {
    pingTimeout: 60000
})
```

2. js/socket.js 文件的修改：
   创建 socket 时将请求的服务端地址修改为部署的后台地址

```js
socket = io('http://127.0.0.1:12306', { // 修改为你自己的后台地址
  withCredentials: true,
  autoConnect: false
});
```

修改创建 RTCPeerConnection 传入的 config （需要提前在服务器创建好 turnserver 服务，然后将该服务的地址、用户名、密码配置到这里）

```js
const config = {
  iceServers: [
    { url: 'stun:stun.xten.com' }
//    {
//      url: 'turn:xxx.xxx.xxx.xxx:3478', // turnserver 服务地址，也就是服务器的 IP
//      username: 'demo', // 用户名
//      credential: '123456' // 密码
//    }
  ]
}
```

断开连接的问题：

socket.io-client 版本低于 4.1.3 时，心跳机制会导致 websocket 断开连接和 timeout 超时问题，官方建议将 pingTimeout 的时间延长，来防止该问题。或者直接使用更高的版本，注意客户端和浏览器端的版本要兼容。
