import { db } from "./db";
import fs from "fs";
import path from "path";
import { 
  users, 
  conversations, 
  conversationParticipants, 
  messages,
  friendRequests,
  type User,
  type Conversation,
  type Message,
  type InsertMessage,
  type CreateConversationRequest,
  type ConversationWithDetails,
  type MessageWithSender,
  type ConversationParticipant,
  type FriendRequest,
  type FriendRequestWithSender,
} from "@shared/schema";
import { eq, and, desc, sql, inArray, or, ilike, ne } from "drizzle-orm";

const STORAGE_FILE = path.join(process.cwd(), "storage.json");

export interface IStorage {
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(username: string, hashedPassword: string, displayName: string, avatarColor: string): Promise<User>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  getAllUsers(): Promise<User[]>;
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;
  
  getConversationsByUserId(userId: string): Promise<ConversationWithDetails[]>;
  getConversationById(id: string): Promise<Conversation | undefined>;
  createConversation(data: CreateConversationRequest, creatorId: string): Promise<Conversation>;
  addParticipant(conversationId: string, userId: string): Promise<void>;
  getConversationParticipants(conversationId: string): Promise<User[]>;
  isUserInConversation(userId: string, conversationId: string): Promise<boolean>;
  markConversationAsRead(userId: string, conversationId: string): Promise<void>;
  getUnreadCount(userId: string, conversationId: string): Promise<number>;
  updateConversationLastMessage(conversationId: string): Promise<void>;
  
  getMessagesByConversationId(conversationId: string, limit?: number): Promise<MessageWithSender[]>;
  createMessage(data: InsertMessage): Promise<MessageWithSender>;
  
  findOrCreatePrivateConversation(userId1: string, userId2: string): Promise<Conversation>;

  getFriendRequests(userId: string): Promise<FriendRequestWithSender[]>;
  getSentFriendRequests(userId: string): Promise<FriendRequest[]>;
  sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest>;
  updateFriendRequestStatus(requestId: string, status: "accepted" | "rejected"): Promise<void>;
  getFriendRequestById(requestId: string): Promise<FriendRequest | undefined>;
  areFriends(userId1: string, userId2: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  private get db() {
    if (!db) {
      throw new Error("Database not connected. Please provide DATABASE_URL.");
    }
    return db;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(username: string, hashedPassword: string, displayName: string, avatarColor: string): Promise<User> {
    const [user] = await this.db.insert(users).values({
      username,
      password: hashedPassword,
      displayName,
      avatarColor,
    }).returning();
    return user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await this.db.update(users)
      .set({ 
        isOnline, 
        lastSeen: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    return await this.db
      .select()
      .from(users)
      .where(
        and(
          ne(users.id, excludeUserId),
          eq(users.username, trimmedQuery)
        )
      )
      .limit(1);
  }

  async getConversationsByUserId(userId: string): Promise<ConversationWithDetails[]> {
    const participantConversations = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    const conversationIds = participantConversations.map(p => p.conversationId);
    
    if (conversationIds.length === 0) {
      return [];
    }

    const conversationsList = await this.db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, conversationIds))
      .orderBy(desc(conversations.lastMessageAt));

    const result: ConversationWithDetails[] = [];

    for (const conv of conversationsList) {
      const participants = await this.getConversationParticipants(conv.id);
      
      const lastMessages = await this.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      let lastMessage;
      if (lastMessages.length > 0) {
        const lastMsg = lastMessages[0];
        let sender;
        if (lastMsg.senderId) {
          sender = await this.getUserById(String(lastMsg.senderId));
        }
        lastMessage = { ...lastMsg, sender: sender! };
      }

      const unreadCount = await this.getUnreadCount(userId, conv.id);

      result.push({
        ...conv,
        participants,
        lastMessage,
        unreadCount,
      });
    }

    return result;
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    const [conversation] = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return conversation;
  }

  async createConversation(data: CreateConversationRequest, creatorId: string): Promise<Conversation> {
    const [conversation] = await this.db.insert(conversations).values({
      name: data.name,
      isGroup: data.isGroup,
    }).returning();

    const allParticipantIds = [...data.participantIds, creatorId];
    const uniqueParticipantIds = [...new Set(allParticipantIds)];

    for (const participantId of uniqueParticipantIds) {
      await this.addParticipant(conversation.id, participantId);
    }

    return conversation;
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    await this.db.insert(conversationParticipants).values({
      conversationId,
      userId,
    });
  }

  async getConversationParticipants(conversationId: string): Promise<User[]> {
    const participants = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));

    const userIds = participants.map(p => p.userId);
    
    if (userIds.length === 0) {
      return [];
    }

    return await this.db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const [participant] = await this.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          eq(conversationParticipants.conversationId, conversationId)
        )
      )
      .limit(1);
    
    return !!participant;
  }

  async markConversationAsRead(userId: string, conversationId: string): Promise<void> {
    await this.db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          eq(conversationParticipants.conversationId, conversationId)
        )
      );
  }

  async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    const [participant] = await this.db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          eq(conversationParticipants.conversationId, conversationId)
        )
      )
      .limit(1);

    if (!participant) {
      return 0;
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.createdAt} > ${participant.lastReadAt}`
        )
      );

    return result?.count || 0;
  }

  async updateConversationLastMessage(conversationId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async getMessagesByConversationId(conversationId: string, limit: number = 100): Promise<MessageWithSender[]> {
    const messagesList = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const messagesWithSender: MessageWithSender[] = [];

    for (const message of messagesList.reverse()) {
      if (message.isSystem) {
        messagesWithSender.push({
          ...message,
          sender: undefined as any, // System messages don't have a sender
        });
        continue;
      }
      const sender = await this.getUserById(message.senderId!);
      if (sender) {
        messagesWithSender.push({
          ...message,
          sender,
        });
      }
    }

    return messagesWithSender;
  }

  async createMessage(data: any): Promise<MessageWithSender> {
    const [message] = await this.db.insert(messages).values(data).returning();
    
    await this.updateConversationLastMessage(data.conversationId);
    
    if (message.isSystem) {
      return {
        ...message,
        sender: undefined as any,
      };
    }

    if (message.senderId) {
      const sender = await this.getUserById(String(message.senderId));
      return {
        ...message,
        sender: sender!,
      };
    }

    return {
      ...message,
      sender: undefined as any,
    };
  }

  async findOrCreatePrivateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const user1Conversations = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1));

    const user2Conversations = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId2));

    const user1ConvIds = new Set(user1Conversations.map(p => p.conversationId));
    const commonConvIds = user2Conversations
      .map(p => p.conversationId)
      .filter(id => user1ConvIds.has(id));

    for (const convId of commonConvIds) {
      const conversation = await this.getConversationById(convId);
      if (conversation && !conversation.isGroup) {
        const participants = await this.getConversationParticipants(convId);
        if (participants.length === 2) {
          return conversation;
        }
      }
    }

    return await this.createConversation(
      { participantIds: [userId2], isGroup: false },
      userId1
    );
  }

  async getFriendRequests(userId: string): Promise<FriendRequestWithSender[]> {
    const requests = await this.db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.receiverId, userId),
          eq(friendRequests.status, "pending")
        )
      )
      .orderBy(desc(friendRequests.createdAt));

    const result: FriendRequestWithSender[] = [];
    for (const req of requests) {
      const sender = await this.getUserById(req.senderId);
      if (sender) {
        result.push({ ...req, sender });
      }
    }
    return result;
  }

  async getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return await this.db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.senderId, userId));
  }

  async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    const [existing] = await this.db
      .select()
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, receiverId)),
          and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, senderId))
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status === "rejected") {
        // This case might not be hit if we delete rejected requests, but kept for robustness
        const [updated] = await this.db
          .update(friendRequests)
          .set({ status: "pending", senderId, receiverId, createdAt: new Date() })
          .where(eq(friendRequests.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    const [request] = await this.db
      .insert(friendRequests)
      .values({ senderId, receiverId, status: "pending" })
      .returning();
    return request;
  }

  async updateFriendRequestStatus(requestId: string, status: "accepted" | "rejected"): Promise<void> {
    await this.db
      .update(friendRequests)
      .set({ status })
      .where(eq(friendRequests.id, requestId));
  }

  async getFriendRequestById(requestId: string): Promise<FriendRequest | undefined> {
    const [request] = await this.db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.id, requestId))
      .limit(1);
    return request;
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const [friendship] = await this.db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, "accepted"),
          or(
            and(eq(friendRequests.senderId, userId1), eq(friendRequests.receiverId, userId2)),
            and(eq(friendRequests.senderId, userId2), eq(friendRequests.receiverId, userId1))
          )
        )
      )
      .limit(1);
    
    return !!friendship;
  }
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private conversations = new Map<string, Conversation>();
  private conversationParticipants = new Map<string, ConversationParticipant[]>();
  private messages = new Map<string, Message[]>();
  private friendRequests = new Map<string, FriendRequest>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
        
        // Revive dates and maps
        if (data.users) {
          data.users.forEach((u: any) => {
            u.lastSeen = new Date(u.lastSeen);
            u.createdAt = new Date(u.createdAt);
            this.users.set(u.id, u);
          });
        }
        
        if (data.conversations) {
          data.conversations.forEach((c: any) => {
            c.createdAt = new Date(c.createdAt);
            c.lastMessageAt = c.lastMessageAt ? new Date(c.lastMessageAt) : null;
            this.conversations.set(c.id, c);
          });
        }
        
        if (data.conversationParticipants) {
          Object.entries(data.conversationParticipants).forEach(([convId, participants]: [string, any]) => {
            participants.forEach((p: any) => {
              p.joinedAt = new Date(p.joinedAt);
              p.lastReadAt = p.lastReadAt ? new Date(p.lastReadAt) : null;
            });
            this.conversationParticipants.set(convId, participants);
          });
        }
        
        if (data.messages) {
          Object.entries(data.messages).forEach(([convId, msgs]: [string, any]) => {
            msgs.forEach((m: any) => {
              m.createdAt = new Date(m.createdAt);
            });
            this.messages.set(convId, msgs);
          });
        }
        
        if (data.friendRequests) {
          data.friendRequests.forEach((r: any) => {
            r.createdAt = new Date(r.createdAt);
            this.friendRequests.set(r.id, r);
          });
        }
        
        console.log("Loaded storage from file");
      }
    } catch (err) {
      console.error("Failed to load storage:", err);
    }
  }

  private save() {
    try {
      const data = {
        users: Array.from(this.users.values()),
        conversations: Array.from(this.conversations.values()),
        conversationParticipants: Object.fromEntries(this.conversationParticipants),
        messages: Object.fromEntries(this.messages),
        friendRequests: Array.from(this.friendRequests.values()),
      };
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save storage:", err);
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(username: string, hashedPassword: string, displayName: string, avatarColor: string): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      username,
      password: hashedPassword,
      displayName,
      avatarColor,
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.save();
    return user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = new Date();
      this.users.set(userId, user);
      this.save();
    }
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const user = Array.from(this.users.values())
      .find(u => 
        u.id !== excludeUserId && 
        u.username === trimmedQuery
      );
    
    return user ? [user] : [];
  }

  async getConversationsByUserId(userId: string): Promise<ConversationWithDetails[]> {
    const convIds = Array.from(this.conversationParticipants.entries())
      .filter(([_, participants]) => participants.some(p => p.userId === userId))
      .map(([convId, _]) => convId);

    const result: ConversationWithDetails[] = [];
    for (const id of convIds) {
      const conv = this.conversations.get(id);
      if (conv) {
        const participants = await this.getConversationParticipants(id);
        const convMessages = this.messages.get(id) || [];
        const lastMessage = convMessages[convMessages.length - 1];
        let lastMessageWithSender = undefined;
        
        if (lastMessage) {
          if ((lastMessage as any).isSystem) {
            lastMessageWithSender = { ...lastMessage, sender: undefined as any };
          } else if (lastMessage.senderId) {
            const sender = await this.getUserById(String(lastMessage.senderId));
            if (sender) {
              lastMessageWithSender = { ...lastMessage, sender };
            }
          }
        }

        const unreadCount = await this.getUnreadCount(userId, id);

        result.push({
          ...conv,
          participants,
          lastMessage: lastMessageWithSender,
          unreadCount,
        });
      }
    }

    return result.sort((a, b) => (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0));
  }

  async getConversationById(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(data: CreateConversationRequest, creatorId: string): Promise<Conversation> {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      name: data.name || null,
      isGroup: data.isGroup,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };
    this.conversations.set(conv.id, conv);
    
    await this.addParticipant(conv.id, creatorId);
    for (const userId of data.participantIds) {
      await this.addParticipant(conv.id, userId);
    }

    this.save();
    return conv;
  }

  async addParticipant(conversationId: string, userId: string): Promise<void> {
    const participants = this.conversationParticipants.get(conversationId) || [];
    participants.push({
      id: crypto.randomUUID(),
      conversationId,
      userId,
      joinedAt: new Date(),
      lastReadAt: new Date(),
    });
    this.conversationParticipants.set(conversationId, participants);
    this.save();
  }

  async getConversationParticipants(conversationId: string): Promise<User[]> {
    const participants = this.conversationParticipants.get(conversationId) || [];
    return participants
      .map(p => this.users.get(p.userId))
      .filter((u): u is User => !!u);
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const participants = this.conversationParticipants.get(conversationId) || [];
    return participants.some(p => p.userId === userId);
  }

  async markConversationAsRead(userId: string, conversationId: string): Promise<void> {
    const participants = this.conversationParticipants.get(conversationId) || [];
    const p = participants.find(p => p.userId === userId);
    if (p) {
      p.lastReadAt = new Date();
      this.save();
    }
  }

  async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    const participants = this.conversationParticipants.get(conversationId) || [];
    const p = participants.find(p => p.userId === userId);
    if (!p) return 0;

    const convMessages = this.messages.get(conversationId) || [];
    return convMessages.filter(m => m.createdAt > (p.lastReadAt || new Date(0))).length;
  }

  async updateConversationLastMessage(conversationId: string): Promise<void> {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.lastMessageAt = new Date();
      this.save();
    }
  }

  async getMessagesByConversationId(conversationId: string, limit: number = 100): Promise<MessageWithSender[]> {
    const convMessages = this.messages.get(conversationId) || [];
    const limitedMessages = convMessages.slice(-limit);
    
    const result: MessageWithSender[] = [];
    for (const m of limitedMessages) {
      if ((m as any).isSystem) {
        result.push({
          ...m,
          sender: undefined as any,
        });
        continue;
      }
      const sender = await this.getUserById(m.senderId!);
      if (sender) {
        result.push({ ...m, sender });
      }
    }
    return result;
  }

  async createMessage(data: any): Promise<MessageWithSender> {
    const message: any = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
    };
    
    const convMessages = this.messages.get(data.conversationId) || [];
    convMessages.push(message);
    this.messages.set(data.conversationId, convMessages);
    
    await this.updateConversationLastMessage(data.conversationId);
    
    if (message.isSystem) {
      this.save();
      return {
        ...message,
        sender: undefined as any,
      };
    }

    if (message.senderId) {
      const sender = await this.getUserById(String(message.senderId));
      this.save();
      return { ...message, sender: sender! };
    }

    this.save();
    return { ...message, sender: undefined as any };
  }

  async findOrCreatePrivateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const allConvs = Array.from(this.conversations.values());
    for (const conv of allConvs) {
      if (!conv.isGroup) {
        const participants = this.conversationParticipants.get(conv.id) || [];
        const userIds = participants.map(p => p.userId);
        if (userIds.length === 2 && userIds.includes(userId1) && userIds.includes(userId2)) {
          return conv;
        }
      }
    }

    return await this.createConversation(
      { participantIds: [userId2], isGroup: false },
      userId1
    );
  }

  async getFriendRequests(userId: string): Promise<FriendRequestWithSender[]> {
    const requests = Array.from(this.friendRequests.values())
      .filter(r => r.receiverId === userId && r.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const result: FriendRequestWithSender[] = [];
    for (const req of requests) {
      const sender = await this.getUserById(req.senderId);
      if (sender) {
        result.push({ ...req, sender });
      }
    }
    return result;
  }

  async getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return Array.from(this.friendRequests.values()).filter(r => r.senderId === userId);
  }

  async sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
    const existing = Array.from(this.friendRequests.values()).find(
      r => (r.senderId === senderId && r.receiverId === receiverId) ||
           (r.senderId === receiverId && r.receiverId === senderId)
    );

    if (existing) {
      if (existing.status === "rejected") {
        // This case might not be hit if we delete rejected requests, but kept for robustness
        existing.status = "pending";
        existing.senderId = senderId;
        existing.receiverId = receiverId;
        existing.createdAt = new Date();
        this.friendRequests.set(existing.id, existing);
        this.save();
        return existing;
      }
      return existing;
    }

    const request: FriendRequest = {
      id: crypto.randomUUID(),
      senderId,
      receiverId,
      status: "pending",
      createdAt: new Date(),
    };
    this.friendRequests.set(request.id, request);
    this.save();
    return request;
  }

  async updateFriendRequestStatus(requestId: string, status: "accepted" | "rejected"): Promise<void> {
    const request = this.friendRequests.get(requestId);
    if (request) {
      request.status = status;
      this.friendRequests.set(requestId, request);
    }
    this.save();
  }

  async getFriendRequestById(requestId: string): Promise<FriendRequest | undefined> {
    return this.friendRequests.get(requestId);
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return Array.from(this.friendRequests.values()).some(
      r => r.status === "accepted" && (
        (r.senderId === userId1 && r.receiverId === userId2) ||
        (r.senderId === userId2 && r.receiverId === userId1)
      )
    );
  }
}

// Check if we should use database or memory storage
// We only use DatabaseStorage if DATABASE_URL is provided AND we can actually connect
// For now, we'll stick to the simple check, but in a real app we might do a ping.
export let storage: IStorage;

if (process.env.DATABASE_URL) {
  console.log("Using DatabaseStorage");
  storage = new DatabaseStorage();
} else {
  console.log("DATABASE_URL not found. Using MemStorage.");
  storage = new MemStorage();
}
