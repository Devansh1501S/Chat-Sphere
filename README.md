# Chat-Sphere 🌐

Chat-Sphere is a modern, full-stack real-time chat application designed for seamless communication. Built with a robust backend using Node.js and Express, and a high-performance frontend using React and Vite, it leverages Socket.IO for instant messaging and live updates.

**Live Demo:** [https://chat-sphere1-neon.vercel.app/](https://chat-sphere1-neon.vercel.app/)

## ✨ Features

- **Real-time Messaging**: Instant message delivery using WebSocket (Socket.IO) technology.
- **Dynamic Logo & UI**: Interactive "Blinkit" animated logo and a clean, responsive design built with Tailwind CSS.
- **Friend System**: Send, receive, and manage friend requests with real-time status updates.
- **User Authentication**: Secure JWT-based authentication and session management.
- **Presence Indicators**: See when your friends are online or when they were last seen.
- **Typing Indicators**: Real-time feedback when someone is typing in a conversation.
- **Scalable Architecture**: Split deployment with Frontend on Vercel and Backend on Render for optimal performance.

## 🚀 Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, TanStack Query.
- **Backend**: Node.js, Express, Socket.IO.
- **Database**: PostgreSQL (via Supabase) with Drizzle ORM.
- **Authentication**: JSON Web Tokens (JWT), Passport.js.
- **Deployment**: Vercel (Frontend), Render (Backend).

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v20 or higher)
- A Supabase account and project

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Devansh1501S/Chat-Sphere.git
   cd Chat-Sphere
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add:
   ```env
   DATABASE_URL=your_supabase_connection_string
   JWT_SECRET=your_jwt_secret
   SESSION_SECRET=your_session_secret
   ```

4. **Push Database Schema**:
   ```bash
   npm run db:push
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

## 🌍 Deployment

This project is optimized for a split deployment:

### Backend (Render)
- **Build Command**: `npm install && npm run build:server`
- **Start Command**: `npm start`
- **Environment**: Ensure `DATABASE_URL`, `JWT_SECRET`, and `SESSION_SECRET` are configured in the Render dashboard.

### Frontend (Vercel)
- **Framework Preset**: Vite
- **Build Command**: `npm run build:client`
- **Output Directory**: `dist/public`
- **Environment Variable**: `VITE_API_URL` (pointing to your Render backend URL)

## 📄 License

This project is licensed under the MIT License.
