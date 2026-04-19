import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  withCredentials: true,
});

// Request interceptor to attach bearer token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear local state and redirect if unauthorized
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  googleLogin: (data) => api.post('/auth/google', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const chatsAPI = {
  getMainChat: () => api.get('/chats/main'),
  getChatMessages: (chatId) => api.get(`/chats/${chatId}/messages`),
  getUserChats: () => api.get('/chats/my-chats'),
  createPrivateChat: (targetUserId) => api.post('/chats/private', { target_user_id: targetUserId }),
};

export const messagesAPI = {
  send: (chatId, text, parentMessageId = null) => 
    api.post('/messages', { chat_id: chatId, message_text: text, parent_message_id: parentMessageId }),
  react: (messageId, emoji) => api.post(`/messages/${messageId}/react`, { emoji }),
  getReaders: (messageId) => api.get(`/messages/${messageId}/readers`),
  markRead: (messageId) => api.post(`/messages/${messageId}/read`),
};

export const imagesAPI = {
  upload: (formData) => api.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  sendImageMessage: (chatId, fileId, text) => api.post('/images/message', {
    chat_id: chatId,
    message_text: text,
    file_id: fileId,
  }),
};

export default api;
