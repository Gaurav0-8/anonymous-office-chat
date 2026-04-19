import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (c) => api.post('/auth/login', c),
  register: (d) => api.post('/auth/register', d),
  googleLogin: (d) => api.post('/auth/google', d),
  getMe: () => api.get('/auth/me'),
  getDisplayNames: () => api.get('/auth/display-names'),
  setName: (d) => api.post('/auth/set-name', d),
};

export const chatsAPI = {
  getMainChat: () => api.get('/chats/main'),
  getChatMessages: (id) => api.get(`/chats/${id}/messages`),
  getUserChats: () => api.get('/chats/my-chats'),
  getMyChats: () => api.get('/chats/my-chats'),
  createPrivateChat: (id) => api.post('/chats/private', { target_user_id: id }),
};

export const messagesAPI = {
  send: (id, t, p = null) => api.post('/messages', { chat_id: id, message_text: t, parent_message_id: p }),
  react: (id, e) => api.post(`/messages/${id}/react`, { emoji: e }),
  getReaders: (id) => api.get(`/messages/${id}/readers`),
  markRead: (id) => api.post(`/messages/${id}/read`),
};

export const imagesAPI = {
  upload: (fd) => api.post('/images/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  sendImageMessage: (id, fid, text, viewOnce = false) => api.post('/images/message', {
    chat_id: id,
    message_text: text,
    file_id: fid,
    view_once: viewOnce
  }),
  confirmView: (msgId) => api.post(`/images/${msgId}/view`),
};

export default api;
