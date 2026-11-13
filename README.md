# Study Partner

**Study Partner** is a modern, collaborative video workspace designed for study groups, teams, and persistent virtual rooms. It features **permanent meeting rooms**, reliable real-time video/audio, multi-presenter screen sharing, permission-based remote desktop control, image copy-paste uploads, and persistent chat history.

---

## Key Features

### 1. Permanent Rooms
- Rooms are **permanent entities** that persist across sessions.
- Always accessible via their unique URL (e.g., `/room/deep-nav`).
- Participants configure mic and camera in the lobby before entering.
- Chat history, pinned messages, reactions, and attachments persist indefinitely.

### 2. Video & Audio Conferencing
- Real-time video and audio communication.
- Responsive multi-participant video grid.
- Dynamic speaking visualizers with audio ripples.
- Smooth camera toggle with avatar display fallback when camera is off.
- Microphone input level meter and device selector modal.
- Native Picture-in-Picture (PiP) support for meetings and presentations.

### 3. Multi-Screen Sharing & Presentation
- Simultaneous presentation mode: multiple participants can share their screen at the same time.
- Switch between split view and single screen spotlight with one click.
- Audio sharing toggle during presentations.
- Viewers can silence presentation audio individually.

### 4. Permission-Based Remote Control
- Request control of another participant's shared desktop.
- Requires explicit consent via an approval modal; never allows access without approval.
- Presenter can revoke control instantly at any moment or press `Esc`.

### 5. Persistent Chat System
- Real-time messaging with live sync across all devices.
- Direct clipboard image copy & paste (`Ctrl+V`) into chat.
- Threaded message replies and emoji reactions.
- Pinned messages bar and full-text search.
- One-click JSON chat transcript export.
- **Admin Wipe Chat**: Room administrators can wipe the entire chat history for all participants with confirmation.

### 6. Security & Access Control
- Admin master password authentication.
- Single-use or recurring participant passcodes created dynamically by the host.
- Single incorrect passcode attempts trigger silent security notices with camera snapshot for admin review.
- Repeated failed attempts trigger high-visibility alerts with warning sirens.
- Unlimited password retries without arbitrary locking.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, NestJS 10, REST API, Socket.IO WebSockets
- **Database**: Prisma ORM (SQLite for local development, PostgreSQL for production)
- **Authentication**: JWT authentication with Passport and bcryptjs
- **File Storage**: Multipart file upload storage with static serving

---

## Getting Started Locally

### Prerequisites
- Node.js (v18 or v20+)
- npm (v9+)

### Installation
```bash
# Install dependencies for both client and server
npm run install:all
```

### Database Initialization
```bash
cd server
npx prisma generate
npx prisma db push
npx prisma db seed
cd ..
```

### Running Locally
```bash
# Start both server (port 4000) and client (port 5173) concurrently
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## Vercel Deployment Guide

### Deploying Frontend to Vercel
1. Import this repository into [Vercel](https://vercel.com).
2. Framework Preset: **Vite**
3. Root Directory: `./` (or `./client`)
4. Build Command: `npm --prefix client run build` (or `npm run build` if root is `client`)
5. Output Directory: `client/dist` (or `dist` if root is `client`)
6. **Environment Variables**:
   - `VITE_API_URL`: Your deployed backend API URL (e.g. `https://your-backend.railway.app`)
   - `VITE_WS_URL`: Your deployed backend WebSocket URL

### Deploying Backend (Railway, Render, Fly.io, or VPS)
Because WebSocket signaling and persistent file uploads require a long-running process, host the `server/` directory on a platform that supports persistent Node.js services (e.g. Railway, Render, Fly.io, DigitalOcean):
1. Set Root Directory to `server`
2. Build Command: `npm run build`
3. Start Command: `npm run start`
4. Set Environment Variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random secret key (32+ characters)
   - `CLIENT_ORIGIN`: Your Vercel domain (e.g. `https://your-app.vercel.app`)
