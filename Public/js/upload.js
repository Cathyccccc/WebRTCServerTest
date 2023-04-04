import { uploadApi, getFiles, deleteFile } from "../api/upload";

const upFile = document.querySelector('#upload-file');

upFile.onchange = function upload (e) {
  const data = new FormData();
  data.append("file", e.target.files[0])
  uploadApi(data).then((res) => {
    console.log(res)
    getFileList()
  })
}

const fileList = document.querySelector('#file-list');

function getFileList () {
  fileList.innerHTML = ''
  getFiles().then((res) => {
    let str = ''
    if (res) {
      res.forEach((filename) => {
        str += `<li class="file-item">${filename}<button class="del-btn">删除</button></li>`
      })
      fileList.innerHTML = str
    }
    
    const delBtnList = document.querySelectorAll('.del-btn')

    delBtnList.forEach((delBtn) => {
      delBtn.onclick = function () {
        deleteFileItem(delBtn)
      }
    })
  })
}

getFileList()

function deleteFileItem(delBtn) {
  const parentNode = delBtn.parentNode
  const filename = parentNode.innerText.slice(0, -2)
  deleteFile(filename).then((res) => {
    console.log(res)
    const parent = parentNode.parentNode
    parent.removeChild(parentNode)
  })
}



