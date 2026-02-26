import { useEffect, useRef, useState, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { api, ws } from "@shared/routes";
import { useAuth } from "./use-auth";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  typingUsers: Record<string, string[]>; // conversationId -> array of typing usernames
  emitTyping: (conversationId: string, isTyping: boolean) => void;
}

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  typingUsers: {},
  emitTyping: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const token = localStorage.getItem("chat_token");
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Initialize socket connection. If VITE_API_URL is set (e.g. split deployment), use it.
    const socketUrl = import.meta.env.VITE_API_URL || "/";
    const newSocket = io(socketUrl, {
      path: "/ws",
      query: { token },
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
      
      // Join all conversations the user is part of
      // We do this by triggering a refetch which will emit joins, or the backend handles it on connect.
      // Usually better if backend joins user to their rooms on connect using their token userId.
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket");
      setIsConnected(false);
    });

    // Handle incoming messages
    newSocket.on("message", (raw) => {
      try {
        const msg = ws.receive.message.parse(raw);
        
        // Update messages list for the conversation
        queryClient.setQueryData(
          [api.conversations.messages.path, msg.conversationId],
          (old: any) => {
            if (!old) return [msg];
            // Prevent duplicates
            if (old.some((m: any) => m.id === msg.id)) return old;
            return [...old, msg];
          }
        );

        // Update the conversation list to show latest message & increment unread
        queryClient.setQueryData([api.conversations.list.path], (old: any) => {
          if (!old) return old;
          return old.map((conv: any) => {
            if (conv.id === msg.conversationId) {
              return {
                ...conv,
                lastMessage: msg,
                lastMessageAt: msg.createdAt,
                unreadCount: msg.senderId !== user.id ? (conv.unreadCount || 0) + 1 : 0
              };
            }
            return conv;
          }).sort((a: any, b: any) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
        });

      } catch (err) {
        console.error("Failed to parse incoming message", err);
      }
    });

    // Handle typing indicators
    newSocket.on("typing", (raw) => {
      try {
        const data = ws.receive.typing.parse(raw);
        if (data.userId === user.id) return; // Ignore own typing

        setTypingUsers((prev) => {
          const currentInConv = prev[data.conversationId] || [];
          let updatedInConv;

          if (data.isTyping) {
            if (!currentInConv.includes(data.username)) {
              updatedInConv = [...currentInConv, data.username];
            } else {
              updatedInConv = currentInConv;
            }
          } else {
            updatedInConv = currentInConv.filter(u => u !== data.username);
          }

          return { ...prev, [data.conversationId]: updatedInConv };
        });

        // Auto-clear typing after 3 seconds if no updates
        const timeoutKey = `${data.conversationId}-${data.userId}`;
        if (typingTimeouts.current[timeoutKey]) {
          clearTimeout(typingTimeouts.current[timeoutKey]);
        }
        
        if (data.isTyping) {
          typingTimeouts.current[timeoutKey] = setTimeout(() => {
            setTypingUsers((prev) => ({
              ...prev,
              [data.conversationId]: (prev[data.conversationId] || []).filter(u => u !== data.username)
            }));
          }, 3000);
        }

      } catch (err) {
        console.error("Failed to parse typing event", err);
      }
    });

    // Handle presence updates
    newSocket.on("presence", (raw) => {
      try {
        const data = ws.receive.presence.parse(raw);
        queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
      } catch (err) {
        console.error("Failed to parse presence", err);
      }
    });

    // Handle friend request events
    newSocket.onAny((event: string, data: any) => {
      if (event.endsWith(":friendRequest")) {
        queryClient.invalidateQueries({ queryKey: [api.friends.listRequests.path] });
        queryClient.invalidateQueries({ queryKey: [api.friends.status.path] });
      } else if (event.endsWith(":friendRequestUpdate")) {
        console.log("Friend request update received:", event, data);
        queryClient.invalidateQueries({ queryKey: [api.friends.listRequests.path] });
        queryClient.invalidateQueries({ queryKey: [api.friends.status.path] });
        // Invalidate all status queries to be safe
        queryClient.invalidateQueries({ queryKey: [api.friends.status.path] });
        if (data?.senderId) {
          queryClient.invalidateQueries({ queryKey: [api.friends.status.path, data.senderId] });
        }
        if (data?.receiverId) {
          queryClient.invalidateQueries({ queryKey: [api.friends.status.path, data.receiverId] });
        }
        if (data?.status === 'accepted') {
          queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
        }
      } else if (event.endsWith(":conversation:update") || event.endsWith(":conversation")) {
        queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
        // Re-join any new rooms we might not be in
        queryClient.getQueryData<any[]>([api.conversations.list.path])?.forEach((conv: any) => {
          newSocket.emit("join", { conversationId: conv.id });
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      Object.values(typingTimeouts.current).forEach(clearTimeout);
    };
  }, [user?.id, queryClient]);

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    if (socket && isConnected) {
      socket.emit("typing", { conversationId, isTyping });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, typingUsers, emitTyping }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
