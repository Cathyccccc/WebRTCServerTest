import axios from 'axios'

const instance = axios.create({
  baseURL: 'http://127.0.0.1:12306/'
})

instance.interceptors.request.use((config) => {
  return config;
}, (error) => {
  Promise.reject(error);
})

instance.interceptors.response.use((res) => {
  return res.data;
}, (error) => {
  Promise.reject(error);
})

export default instance;