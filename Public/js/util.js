export function getRandomStr() {
  return Math.random().toString(32).slice(-8)
}
export function getRTCSenders(peers) {
  for (const prop in peers) {
    const senders = peers[prop].getSenders()
    console.log(`【${prop}】: `, senders)
  }
}
export function getStreamTracks(stream) {
  const tracks = stream.getTracks()
  console.log('【tracks】：', tracks)
}
// 使用 canvas 画随机头像
// 这里画布和画纸宽高都为50px
// 每个矩形大小为5px*5px
export function randomAvatar() {
  const canvas = document.createElement('canvas')
  // canvas.style.width = '50px'
  // canvas.style.height = '50px'
  canvas.width = 50
  canvas.height = 50
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = randomColor();//设置图形填充颜色
  for(let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      if (Math.random() > 0.5) {
        ctx.beginPath()
        ctx.fillRect(i*5, j*5, 5, 5);//画一个填充的矩形(起点x坐标，起点y坐标，矩形宽，矩形高)
        ctx.closePath()
      }
    }
  }
  return canvas
}

export function randomColor() {
  return '#'+('00000'+ (Math.random()*0x1000000<<0).toString(16)).slice(-6); 
}