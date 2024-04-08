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