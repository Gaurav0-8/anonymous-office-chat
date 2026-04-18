import axios from 'axios';

// Empty string = relative URLs → all requests go through Next.js proxy (next.config.js rewrites)
// This works on any domain (local, Cloudflare, etc.) without hardcoding a hostname
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  checkUsername: (username) => api.get(`/auth/check-username/${username}`),
  getDisplayNames: () => api.get('/auth/display-names'),
  
  // WebAuthn
  webAuthnRegisterBegin: (data) => api.post('/auth/webauthn/register/begin', data),
  webAuthnRegisterFinish: (data) => api.post('/auth/webauthn/register/finish', data),
  webAuthnLoginBegin: (data) => api.post('/auth/webauthn/login/begin', data),
  webAuthnLoginFinish: (data) => api.post('/auth/webauthn/login/finish', data),

  // Admin Setup
  adminSetupBegin: (data, token) => api.post('/auth/admin-setup/begin', data, {
    headers: { 'X-Admin-Setup-Token': token }
  }),
  adminSetupFinish: (data) => api.post('/auth/admin-setup/finish', data),
};

// ── Chats ─────────────────────────────────────────────────────────────────────
export const chatsAPI = {
  getMainChat: () => api.get('/chats/main'),
  getMyChats: () => api.get('/chats/my-chats'),
  createPrivateChat: (targetUserId) => api.post('/chats/private', { target_user_id: targetUserId }),
  getChatMessages: (chatId) => api.get(`/chats/${chatId}/messages`),
  getChatDetails: (chatId) => api.get(`/chats/${chatId}/details`),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messagesAPI = {
  send: (chatId, messageText) => api.post('/messages', { chat_id: chatId, message_text: messageText }),
  edit: (messageId, messageText) => api.patch(`/messages/${messageId}/edit`, { message_text: messageText }),
  delete: (messageId) => api.patch(`/messages/${messageId}/delete`),
  getReaders: (messageId) => api.get(`/messages/${messageId}/readers`),
  markRead: (messageId) => api.post(`/messages/${messageId}/read`),
};

// ── Images ────────────────────────────────────────────────────────────────────
export const imagesAPI = {
  upload: (formData) => api.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  sendImageMessage: (chatId, fileId, messageText = '') =>
    api.post('/images/message', { chat_id: chatId, file_id: fileId, message_text: messageText }),
  markRead: (fileId) => api.post(`/images/${fileId}/read`),
  getUrl: (fileId, ext = 'jpg') => `${API_URL}/uploads/${fileId}.${ext}`,
};

// ── Favorites ─────────────────────────────────────────────────────────────────
export const favoritesAPI = {
  list: () => api.get('/favorites'),
  add: (mediaUrl, mediaType) => api.post('/favorites', { media_url: mediaUrl, media_type: mediaType }),
  remove: (favoriteId) => api.delete(`/favorites/${favoriteId}`),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  listUsers: () => api.get('/admin/users'),
  ban: (userId) => api.post(`/admin/ban/${userId}`),
  unban: (userId) => api.post(`/admin/unban/${userId}`),
  mute: (userId, mutedUntil) => api.post(`/admin/mute/${userId}`, { muted_until: mutedUntil }),
  unmute: (userId) => api.post(`/admin/unmute/${userId}`),
};
