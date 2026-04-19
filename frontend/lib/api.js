import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  withCredentials: true,
});

// Interceptor for handling auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const chatsAPI = {
  getMainChat: () => api.get('/chats/main'),
  getChatMessages: (chatId) => api.get(`/chats/${chatId}/messages`),
  getUserChats: () => api.get('/chats/my-chats'),
  createPrivateChat: (targetUserId) => api.post('/private', { target_user_id: targetUserId }),
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
  sendImageMessage: (chatId, fileId, text) => api.post('/messages', {
    chat_id: chatId,
    message_text: text,
    image_file_id: fileId,
  }),
};

export default api;
