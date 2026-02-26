import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import { generateToken, verifyToken, type AuthRequest } from "./middleware/auth";
import { setupSocketIO } from "./sockets";

const SALT_ROUNDS = 10;

const AVATAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", 
  "#10b981", "#06b6d4", "#6366f1", "#ef4444",
  "#14b8a6", "#f97316", "#a855f7", "#84cc16"
];

function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const io = setupSocketIO(httpServer);

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Username already exists",
          field: "username"
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);
      const avatarColor = getRandomAvatarColor();
      
      const user = await storage.createUser(
        input.username,
        hashedPassword,
        input.displayName,
        avatarColor
      );

      const token = generateToken(user.id);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Registration error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      
      const user = await storage.getUserByUsername(input.username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const isPasswordValid = await bcrypt.compare(input.password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      const token = generateToken(user.id);

      res.status(200).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Login error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.auth.me.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUserById(req.userId!);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        isOnline: user.isOnline,
      });
    } catch (err) {
      console.error("Get user error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.users.list.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      
      const usersWithoutPasswords = users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        isOnline: user.isOnline,
      }));

      res.json(usersWithoutPasswords);
    } catch (err) {
      console.error("Get users error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.conversations.list.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const conversations = await storage.getConversationsByUserId(req.userId!);
      res.json(conversations);
    } catch (err) {
      console.error("Get conversations error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.conversations.create.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const input = api.conversations.create.input.parse(req.body);
      
      if (!input.isGroup && input.participantIds.length === 1) {
        const conversation = await storage.findOrCreatePrivateConversation(
          req.userId!,
          input.participantIds[0]
        );
        
        const participants = await storage.getConversationParticipants(conversation.id);
        
        return res.status(201).json({
          ...conversation,
          participants,
          unreadCount: 0,
        });
      }

      const conversation = await storage.createConversation(input, req.userId!);
      const participants = await storage.getConversationParticipants(conversation.id);

      const conversationWithDetails = {
        ...conversation,
        participants,
        unreadCount: 0,
      };

      for (const participantId of [...input.participantIds, req.userId!]) {
        io.emit(`user:${participantId}:conversation`, conversationWithDetails);
      }

      res.status(201).json(conversationWithDetails);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Create conversation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.conversations.get.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.id;
      
      const isParticipant = await storage.isUserInConversation(req.userId!, conversationId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not a participant in this conversation" });
      }

      const conversation = await storage.getConversationById(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const participants = await storage.getConversationParticipants(conversationId);

      res.json({
        ...conversation,
        participants,
      });
    } catch (err) {
      console.error("Get conversation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.conversations.messages.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.id;
      
      const isParticipant = await storage.isUserInConversation(req.userId!, conversationId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not a participant in this conversation" });
      }

      const messages = await storage.getMessagesByConversationId(conversationId);
      
      res.json(messages);
    } catch (err) {
      console.error("Get messages error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.conversations.markRead.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const conversationId = req.params.id;
      
      const isParticipant = await storage.isUserInConversation(req.userId!, conversationId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not a participant in this conversation" });
      }

      await storage.markConversationAsRead(req.userId!, conversationId);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Mark read error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.messages.send.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const input = api.messages.send.input.parse(req.body);
      
      const isParticipant = await storage.isUserInConversation(req.userId!, input.conversationId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Not a participant in this conversation" });
      }

      const message = await storage.createMessage({
        conversationId: input.conversationId,
        senderId: req.userId!,
        content: input.content,
      });

      io.to(`conversation:${input.conversationId}`).emit("message", message);

      const participants = await storage.getConversationParticipants(input.conversationId);
      for (const participant of participants) {
        io.emit(`user:${participant.id}:conversation:update`);
      }

      res.status(201).json(message);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Send message error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  try {
    const existingUsers = await storage.getAllUsers();
    
    if (existingUsers.length === 0) {
      const hashedPassword = await bcrypt.hash("demo123", SALT_ROUNDS);
      
      const alice = await storage.createUser(
        "alice",
        hashedPassword,
        "Alice Johnson",
        "#3b82f6"
      );
      
      const bob = await storage.createUser(
        "bob",
        hashedPassword,
        "Bob Smith",
        "#8b5cf6"
      );
      
      const charlie = await storage.createUser(
        "charlie",
        hashedPassword,
        "Charlie Davis",
        "#ec4899"
      );

      const conversation1 = await storage.findOrCreatePrivateConversation(alice.id, bob.id);
      
      await storage.createMessage({
        conversationId: conversation1.id,
        senderId: alice.id,
        content: "Hey Bob! How are you doing?",
      });
      
      await storage.createMessage({
        conversationId: conversation1.id,
        senderId: bob.id,
        content: "Hi Alice! I'm doing great, thanks for asking!",
      });

      const groupConversation = await storage.createConversation(
        {
          participantIds: [bob.id, charlie.id],
          isGroup: true,
          name: "Team Chat",
        },
        alice.id
      );

      await storage.createMessage({
        conversationId: groupConversation.id,
        senderId: alice.id,
        content: "Welcome to the team chat everyone!",
      });

      console.log("✅ Database seeded with demo users and conversations");
      console.log("Demo accounts: alice, bob, charlie (password: demo123)");
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
