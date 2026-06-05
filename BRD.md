# Business Requirements Document (BRD)
## Project Name: Anonymous Office Chat (Chat-App-v2)

### 1. Executive Summary
The Chat-App-v2 project is a modern, real-time messaging application designed for seamless team communication. It provides robust features such as group chatting, private direct messaging, rich media sharing, thread replies, and admin moderation, accessible via web and Installable Progressive Web App (PWA).

### 2. Project Objectives
- Facilitate real-time, low-latency communication across the organization.
- Support both public/group conversations and secure private 1-on-1 messaging.
- Provide a responsive and intuitive User Interface (UI).
- Enable effective moderation and administrative control to maintain a professional environment.

### 3. Scope
**In-Scope:**
- User Authentication (Username/Password, Google OAuth).
- Real-time messaging using WebSockets.
- Global/Group Chat and Direct Messaging (DM).
- Rich text features, emojis, sticker and image sharing.
- Message interactions: Read receipts, editing, deleting, replying (threading), and emoji reactions.
- User presence tracking (Online/Last Seen).
- Role-based Access Control (Admin vs. User).
- PWA Support (Installable on desktop and mobile).

**Out-of-Scope:**
- Audio and Video Calling.
- Screen sharing.
- End-to-end encryption for group chats (standard TLS encryption applies).

### 4. Functional Requirements
**4.1 Authentication & Authorization**
- The system must allow users to register and login using credentials or Google OAuth.
- The system must assign standard or admin roles. Admin users can ban/mute other users.

**4.2 Messaging**
- The system must support a primary "System Chat" (Group chat).
- The system must support 1-to-1 private chat sessions.
- Users must be able to send text, images, and stickers.
- Users must be able to edit and delete their own messages.
- Users must be able to reply to specific messages (parent-child threading).
- The system must display read receipts indicating who read a message and when.
- Users must be able to add emoji reactions to messages.

**4.3 User Management**
- Users must have a profile with a display name and avatar.
- The system must display the online status and "last seen" timestamp of users.

**4.4 Media Management**
- Users can upload images which are stored and retrieved securely.
- Users can favorite media/stickers for quick reuse.

### 5. Non-Functional Requirements
- **Performance:** Messages must be delivered in real-time with sub-second latency.
- **Scalability:** The backend must handle concurrent WebSocket connections efficiently (built on Go).
- **Security:** Passwords must be hashed. APIs must be secured via authentication tokens/cookies.
- **Availability:** The system aims for 99.9% uptime.
- **Usability:** The frontend (Next.js) must be responsive, working on varying screen sizes.

### 6. Technical Stack
- **Frontend:** Next.js (React), Tailwind CSS or Custom CSS, PWA setup.
- **Backend:** Go (Golang), WebSockets for real-time events.
- **Database:** SQLite (with tables for users, chats, messages, image_files, etc.).

### 7. Assumptions & Constraints
- Users have modern web browsers supporting WebSockets and ES6+.
- Deployment requires a server capable of holding persistent WebSocket connections.
