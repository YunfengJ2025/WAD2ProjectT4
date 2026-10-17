import axios from 'axios';

const API = axios.create({
  baseURL: '/api' // Uses relative path handled by Vite Proxy
});

export default API;