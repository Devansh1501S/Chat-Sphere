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

  app.get(api.users.search.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json([]);
      }
      
      const users = await storage.searchUsers(query, req.userId!);
      
      const usersWithoutPasswords = users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        isOnline: user.isOnline,
      }));

      res.json(usersWithoutPasswords);
    } catch (err) {
      console.error("Search users error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.friends.listRequests.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const requests = await storage.getFriendRequests(req.userId!);
      res.json(requests);
    } catch (err) {
      console.error("Get friend requests error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.friends.sendRequest.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const { receiverId } = api.friends.sendRequest.input.parse(req.body);
      
      if (receiverId === req.userId) {
        return res.status(400).json({ message: "Cannot send friend request to yourself" });
      }

      const request = await storage.sendFriendRequest(req.userId!, receiverId);
      
      // Emit socket event to receiver
      io.emit(`user:${receiverId}:friendRequest`, {
        ...request,
        sender: await storage.getUserById(req.userId!)
      });

      res.status(201).json(request);
    } catch (err) {
      console.error("Send friend request error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.friends.updateRequest.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const requestId = req.params.id;
      const { status } = api.friends.updateRequest.input.parse(req.body);
      
      // Get the request first to know who the sender and receiver are
      // We search across all requests to find this specific one regardless of status
      const request = await storage.getFriendRequestById(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Friend request not found" });
      }

      // Security check: only the receiver can update the status
      if (request.receiverId !== req.userId) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }
      
      await storage.updateFriendRequestStatus(requestId, status);

      if (status === 'accepted') {
        // Automatically create a private conversation
        const conversation = await storage.findOrCreatePrivateConversation(request.receiverId, request.senderId);
        
        // Create a system message "You both are friends now"
        await storage.createMessage({
          conversationId: conversation.id,
          content: "You both are friends now",
          isSystem: true,
        });
      }
      
      // Emit socket event to BOTH users to trigger UI refresh
      const updatePayload = { requestId, status, senderId: request.senderId, receiverId: request.receiverId };
      io.emit(`user:${request.senderId}:friendRequestUpdate`, updatePayload);
      io.emit(`user:${request.receiverId}:friendRequestUpdate`, updatePayload);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Update friend request error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.friends.status.path, verifyToken, async (req: AuthRequest, res) => {
    try {
      const otherUserId = req.params.userId;
      
      // Check if they are already friends first
      const areFriends = await storage.areFriends(req.userId!, otherUserId);
      if (areFriends) {
        return res.json({ status: "accepted" });
      }

      const sentRequests = await storage.getSentFriendRequests(req.userId!);
      // Use a more direct check for received requests that doesn't filter by pending
      const allRequests = await storage.getFriendRequests(req.userId!); // Wait, this only returns pending.
      
      // Let's use a new storage method or just search across all sent/received
      const sent = sentRequests.find(r => r.receiverId === otherUserId);
      
      if (sent) {
        if (sent.status === "pending") {
          return res.json({ status: "pending", requestId: sent.id });
        }
        if (sent.status === "rejected") {
          // If it was rejected, we want to allow sending again
          return res.json({ status: "none" });
        }
      }
      
      // For received requests, we still only care if it's pending
      const received = allRequests.find(r => r.senderId === otherUserId && r.status === "pending");
      
      if (received) {
        return res.json({ status: "received", requestId: received.id });
      }

      res.json({ status: "none" });
    } catch (err) {
      console.error("Get friend status error:", err);
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
        const otherUserId = input.participantIds[0];
        
        // Check if they are friends
        const areFriends = await storage.areFriends(req.userId!, otherUserId);
        if (!areFriends) {
          return res.status(403).json({ message: "You can only chat with friends" });
        }

        const conversation = await storage.findOrCreatePrivateConversation(
          req.userId!,
          otherUserId
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
