import { db } from "./db";
import { 
  users, 
  conversations, 
  conversationParticipants, 
  messages,
  type User,
  type Conversation,
  type Message,
  type InsertMessage,
  type CreateConversationRequest,
  type ConversationWithDetails,
  type MessageWithSender,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(username: string, hashedPassword: string, displayName: string, avatarColor: string): Promise<User>;
  updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
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
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async createUser(username: string, hashedPassword: string, displayName: string, avatarColor: string): Promise<User> {
    const [user] = await db.insert(users).values({
      username,
      password: hashedPassword,
      displayName,
      avatarColor,
    }).returning();
    return user;
  }

  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await db.update(users)
      .set({ 
        isOnline, 
        lastSeen: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getConversationsByUserId(userId: string): Promise<ConversationWithDetails[]> {
    const participantConversations = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId));

    const conversationIds = participantConversations.map(p => p.conversationId);
    
    if (conversationIds.length === 0) {
      return [];
    }

    const conversationsList = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, conversationIds))
      .orderBy(desc(conversations.lastMessageAt));

    const result: ConversationWithDetails[] = [];

    for (const conv of conversationsList) {
      const participants = await this.getConversationParticipants(conv.id);
      
      const lastMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      let lastMessage;
      if (lastMessages.length > 0) {
        const sender = await this.getUserById(lastMessages[0].senderId);
        lastMessage = { ...lastMessages[0], sender: sender! };
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
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return conversation;
  }

  async createConversation(data: CreateConversationRequest, creatorId: string): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values({
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
    await db.insert(conversationParticipants).values({
      conversationId,
      userId,
    });
  }

  async getConversationParticipants(conversationId: string): Promise<User[]> {
    const participants = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));

    const userIds = participants.map(p => p.userId);
    
    if (userIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const [participant] = await db
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
    await db
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
    const [participant] = await db
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

    const [result] = await db
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
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async getMessagesByConversationId(conversationId: string, limit: number = 100): Promise<MessageWithSender[]> {
    const messagesList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const messagesWithSender: MessageWithSender[] = [];

    for (const message of messagesList.reverse()) {
      const sender = await this.getUserById(message.senderId);
      if (sender) {
        messagesWithSender.push({
          ...message,
          sender,
        });
      }
    }

    return messagesWithSender;
  }

  async createMessage(data: InsertMessage): Promise<MessageWithSender> {
    const [message] = await db.insert(messages).values(data).returning();
    
    await this.updateConversationLastMessage(data.conversationId);
    
    const sender = await this.getUserById(message.senderId);
    
    return {
      ...message,
      sender: sender!,
    };
  }

  async findOrCreatePrivateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const user1Conversations = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1));

    const user2Conversations = await db
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
}

export const storage = new DatabaseStorage();
