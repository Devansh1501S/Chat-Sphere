import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { storage } from "./storage";
import { verifySocketToken } from "./middleware/auth";

const userSockets = new Map<string, Set<string>>();
const typingTimeouts = new Map<string, NodeJS.Timeout>();

export function setupSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/ws",
  });

  io.use((socket, next) => {
    const token = socket.handshake.query.token as string;
    
    if (!token) {
      return next(new Error("Authentication error"));
    }

    const userId = verifySocketToken(token);
    
    if (!userId) {
      return next(new Error("Invalid token"));
    }

    socket.data.userId = userId;
    next();
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    await storage.updateUserOnlineStatus(userId, true);
    
    io.emit("presence", {
      userId,
      isOnline: true,
    });

    socket.on("join", async (data: { conversationId: string }) => {
      const { conversationId } = data;
      
      const isParticipant = await storage.isUserInConversation(userId, conversationId);
      
      if (isParticipant) {
        socket.join(`conversation:${conversationId}`);
      }
    });

    socket.on("typing", async (data: { conversationId: string; isTyping: boolean }) => {
      const { conversationId, isTyping } = data;
      
      const isParticipant = await storage.isUserInConversation(userId, conversationId);
      
      if (!isParticipant) {
        return;
      }

      const user = await storage.getUserById(userId);
      
      if (!user) {
        return;
      }

      const timeoutKey = `${userId}:${conversationId}`;
      
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey)!);
        typingTimeouts.delete(timeoutKey);
      }

      socket.to(`conversation:${conversationId}`).emit("typing", {
        conversationId,
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        isTyping,
      });

      if (isTyping) {
        const timeout = setTimeout(() => {
          socket.to(`conversation:${conversationId}`).emit("typing", {
            conversationId,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            isTyping: false,
          });
          typingTimeouts.delete(timeoutKey);
        }, 3000);
        
        typingTimeouts.set(timeoutKey, timeout);
      }
    });

    socket.on("disconnect", async () => {
      const userSocketSet = userSockets.get(userId);
      
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          
          await storage.updateUserOnlineStatus(userId, false);
          
          io.emit("presence", {
            userId,
            isOnline: false,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });
  });

  return io;
}

export function getIO(httpServer: HttpServer): Server {
  return new Server(httpServer);
}
