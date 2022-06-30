import instance from './index'

export function uploadApi(data) {
  return instance.post('/upload', data)
}

export function getFiles() {
  return instance.get('/file')
}

export function deleteFile(filename) {
  return instance.post('/delfile', {
    data: filename
  })
}