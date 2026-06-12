import axios from 'axios';
import { message } from 'antd';

const client = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  return config;
});

let isRedirecting = false;

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;

    // 401: token 过期
    if (status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (!location.pathname.startsWith('/login')) {
        message.warning('登录已过期，请重新登录');
        setTimeout(() => {
          isRedirecting = false;
          location.href = '/login';
        }, 800);
      }
    }

    // 403 + ADMIN_DISABLED: 管理员账户被封禁
    if (status === 403 && code === 'ADMIN_DISABLED' && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      if (!location.pathname.startsWith('/login')) {
        message.error('管理员账户已被禁用，请联系超级管理员');
        setTimeout(() => {
          isRedirecting = false;
          location.href = '/login';
        }, 800);
      }
    }

    return Promise.reject(err);
  }
);

export default client;
