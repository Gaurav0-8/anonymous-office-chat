# 🔒 Anonymous Office Chat — Go + Next.js + SQLite

A privacy-first, anonymous chat application with **passwordless WebAuthn authentication** (Face ID / Windows Hello / Passkey). Built with Go (Fiber) backend and Next.js frontend.

## ✨ Features

- **Passwordless Auth** — WebAuthn passkey login (Face ID, fingerprint, device PIN)
- **Anonymous Identity** — Choose from 50 unique display names
- **Auto-Delete Messages** — Messages expire after 30 minutes
- **Real-time Chat** — WebSocket-powered instant messaging
- **Private Messaging** — 1-on-1 chats between anonymous users
- **Image Sharing** — Upload & send images with previews
- **Favorites** — Save media for later
- **Admin Controls** — Ban, unban, mute, unmute users
- **Dark/Light Mode** — Theme toggle with system preference detection
- **Mobile Responsive** — Works on all screen sizes
- **Anti Multi-Account** — Same device can only register one account

## 📁 Project Structure

```
Chat-App-v2/
├── backend/           ← Go (Fiber) API server
│   ├── db/            ← SQLite schema & queries
│   ├── handlers/      ← Route handlers (auth, chats, messages, webauthn, admin)
│   ├── middleware/     ← JWT auth middleware
│   ├── wauthn/        ← WebAuthn initialization
│   ├── ws/            ← WebSocket manager
│   ├── main.go        ← Entry point
│   └── .env.example   ← Environment template
├── frontend/          ← Next.js (App Router)
│   ├── app/           ← Pages (login, register, chat, admin-setup)
│   ├── components/    ← Reusable UI components
│   ├── context/       ← Theme context provider
│   └── lib/           ← API client, WebAuthn helpers
├── .gitignore
└── README.md
```

## 🚀 Setup

### Prerequisites

- **Go** 1.21+
- **Node.js** 18+ (or Bun)
- **HTTPS domain** (required for WebAuthn in production — localhost works for dev)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/anonymous-office-chat.git
cd anonymous-office-chat

# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your values:
#   JWT_SECRET_KEY    — random secret for JWT signing
#   WEBAUTHN_RP_ID    — your domain (e.g., chat.example.com)
#   WEBAUTHN_RP_ORIGIN — full origin (e.g., https://chat.example.com)
#   ADMIN_SETUP_TOKEN — secret token for initial admin setup
```

### 2. Backend

```bash
cd backend
go mod tidy
go run .
# Server starts on :8080
```

### 3. Frontend

```bash
cd frontend
npm install    # or: bun install
npm run dev    # or: bun run dev
# Runs on http://localhost:3000
```

### 4. Admin Setup (first time only)

1. Navigate to `/admin-setup` in your browser
2. Enter the `ADMIN_SETUP_TOKEN` from your `.env`
3. Choose a username and display name
4. Complete the passkey enrollment
5. This page locks after one admin is created

## 🔐 Authentication Flow

### Registration
1. User picks a display name + username
2. Clicks "Set up Passkey & Join"
3. Browser prompts Face ID / fingerprint / PIN
4. Credential is stored server-side → JWT returned

### Login
1. User enters username
2. Clicks "Sign In with Passkey"
3. Browser prompts biometric verification
4. Server validates → JWT returned

> Each device credential can only be used for **one account**, preventing multi-account abuse.

## 📡 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **WebAuthn** | | | |
| POST | `/auth/webauthn/register/begin` | No | Start passkey registration |
| POST | `/auth/webauthn/register/finish` | No | Complete registration |
| POST | `/auth/webauthn/login/begin` | No | Start passkey login |
| POST | `/auth/webauthn/login/finish` | No | Complete login |
| POST | `/auth/admin-setup/begin` | Token | Start admin registration |
| POST | `/auth/admin-setup/finish` | No | Complete admin registration |
| **Auth (legacy)** | | | |
| POST | `/auth/register` | No | Register (password) |
| POST | `/auth/login` | No | Login (password) |
| GET | `/auth/check-username/:name` | No | Check availability |
| GET | `/auth/display-names` | No | Get available names |
| **Chats** | | | |
| GET | `/chats/main` | JWT | Main group chat |
| POST | `/chats/private` | JWT | Create/get private chat |
| GET | `/chats/my-chats` | JWT | List user's chats |
| GET | `/chats/:id/messages` | JWT | Get messages |
| GET | `/chats/:id/details` | JWT | Chat details |
| **Messages** | | | |
| POST | `/messages` | JWT | Send message |
| PATCH | `/messages/:id/edit` | JWT | Edit own message |
| PATCH | `/messages/:id/delete` | JWT | Soft-delete message |
| GET | `/messages/:id/readers` | JWT | Who read this |
| POST | `/messages/:id/read` | JWT | Mark as read |
| **Images** | | | |
| POST | `/images/upload` | JWT | Upload image |
| POST | `/images/message` | JWT | Send image message |
| **Favorites** | | | |
| GET | `/favorites` | JWT | List favorites |
| POST | `/favorites` | JWT | Add favorite |
| DELETE | `/favorites/:id` | JWT | Remove favorite |
| **Admin** | | | |
| GET | `/admin/users` | Admin | List all users |
| POST | `/admin/ban/:id` | Admin | Ban user |
| POST | `/admin/unban/:id` | Admin | Unban user |
| POST | `/admin/mute/:id` | Admin | Mute user |
| POST | `/admin/unmute/:id` | Admin | Unmute user |
| **WebSocket** | | | |
| GET | `/ws?token=...` | JWT | Real-time connection |

## 🛠 Tech Stack

- **Backend:** Go, Fiber, SQLite (modernc.org/sqlite), JWT, WebAuthn
- **Frontend:** Next.js 14 (App Router), React 18, Axios
- **Auth:** WebAuthn (passkeys) — zero passwords
- **Real-time:** WebSocket (Fiber WebSocket)
- **Deployment:** Cloudflare Tunnel (HTTPS)

## 📄 License

MIT
