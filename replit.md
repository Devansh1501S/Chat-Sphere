# Real-Time Chat Application

A Telegram-like full-stack real-time chat app with WebSocket-based messaging, JWT authentication, and persistent PostgreSQL storage.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + Socket.io-client
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL (via Drizzle ORM)
- **Auth**: JWT (jsonwebtoken) + bcrypt password hashing
- **Routing**: Wouter (frontend), Express (backend)
- **State**: TanStack Query (React Query)

## Architecture

### Frontend (`client/src/`)
- `pages/auth.tsx` — Login/Register page
- `pages/chat.tsx` — Main chat layout (authenticated)
- `components/chat/sidebar.tsx` — Conversation list with unread badges
- `components/chat/chat-area.tsx` — Active chat window with messages
- `components/chat/new-chat-dialog.tsx` — Start new 1-on-1 or group chat
- `hooks/use-auth.tsx` — JWT auth logic with React Query
- `hooks/use-socket.tsx` — Socket.io context provider + event handlers
- `hooks/use-chat.tsx` — Conversation and message data hooks
- `lib/api-client.ts` — Fetch wrapper that injects Bearer token

### Backend (`server/`)
- `index.ts` — Express server setup
- `routes.ts` — REST API routes (auth, conversations, messages, users)
- `sockets.ts` — Socket.io server with presence, typing, room management
- `storage.ts` — DatabaseStorage class (all CRUD operations)
- `middleware/auth.ts` — JWT verification middleware

### Shared (`shared/`)
- `schema.ts` — Drizzle table definitions + TypeScript types
- `routes.ts` — API contract with Zod schemas (single source of truth)

## Features

- User registration and login with JWT + bcrypt
- Private (1-on-1) and group chat rooms
- Real-time messaging via Socket.io
- Typing indicators (auto-clear after 3 seconds)
- Online/offline presence tracking
- Unread message counts per conversation
- Message history loads automatically on page refresh
- Auto-scroll to latest messages
- Conversation search in sidebar
- Mobile-responsive layout

## Database Schema

- `users` — id, username, password (hashed), displayName, avatarColor, isOnline, lastSeen
- `conversations` — id, name, isGroup, lastMessageAt
- `conversation_participants` — conversationId, userId, lastReadAt (for unread counts)
- `messages` — id, conversationId, senderId, content, createdAt

## Demo Accounts

Pre-seeded demo accounts (password: `demo123`):
- `alice` / `demo123`
- `bob` / `demo123`
- `charlie` / `demo123`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — JWT signing secret (defaults to insecure string, MUST set in production)
- `SESSION_SECRET` — Session secret (available)

## WebSocket Events

**Client → Server:**
- `join` — Join a conversation room
- `typing` — Send typing status `{ conversationId, isTyping }`

**Server → Client:**
- `message` — New message in a conversation
- `typing` — Another user's typing status
- `presence` — User online/offline status change

## Running

```bash
npm run dev        # Start dev server (port 5000)
npm run db:push    # Sync schema to database
```
