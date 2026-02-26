## Packages
socket.io-client | Required for real-time WebSocket connection for chat, typing, and presence events
date-fns | Required for human-readable timestamps (e.g., "Just now", "2:30 PM")
framer-motion | Required for smooth layout transitions, message bubble pop-ins, and UI animations
lucide-react | Required for high-quality SVG icons
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility to merge tailwind classes without style conflicts

## Notes
- Using localStorage for JWT token storage as requested.
- Custom fetch wrapper will be used to inject the `Authorization: Bearer <token>` header into API requests.
- Socket.io will connect to the same origin with standard path or specified `/ws` path, passing the token in auth/query.
- Font choices: 'Plus Jakarta Sans' for display, 'Inter' for UI body for a clean, modern messenger aesthetic.
