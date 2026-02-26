import { z } from 'zod';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({
        username: z.string().min(3).max(30),
        password: z.string().min(6),
        displayName: z.string().min(1).max(50),
      }),
      responses: {
        201: z.object({
          token: z.string(),
          user: z.object({
            id: z.string(),
            username: z.string(),
            displayName: z.string(),
            avatarColor: z.string(),
          }),
        }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.object({
          token: z.string(),
          user: z.object({
            id: z.string(),
            username: z.string(),
            displayName: z.string(),
            avatarColor: z.string(),
          }),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.object({
          id: z.string(),
          username: z.string(),
          displayName: z.string(),
          avatarColor: z.string(),
          isOnline: z.boolean(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations' as const,
      responses: {
        200: z.array(z.any()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations' as const,
      input: z.object({
        participantIds: z.array(z.string()),
        isGroup: z.boolean(),
        name: z.string().optional(),
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/conversations/:id' as const,
      responses: {
        200: z.any(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    messages: {
      method: 'GET' as const,
      path: '/api/conversations/:id/messages' as const,
      responses: {
        200: z.array(z.any()),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    markRead: {
      method: 'POST' as const,
      path: '/api/conversations/:id/read' as const,
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  messages: {
    send: {
      method: 'POST' as const,
      path: '/api/messages' as const,
      input: z.object({
        conversationId: z.string(),
        content: z.string().min(1),
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  friends: {
    listRequests: {
      method: 'GET' as const,
      path: '/api/friends/requests' as const,
      responses: {
        200: z.array(z.any()),
        401: errorSchemas.unauthorized,
      },
    },
    sendRequest: {
      method: 'POST' as const,
      path: '/api/friends/requests' as const,
      input: z.object({
        receiverId: z.string(),
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    updateRequest: {
      method: 'PATCH' as const,
      path: '/api/friends/requests/:id' as const,
      input: z.object({
        status: z.enum(['accepted', 'rejected']),
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/friends/status/:userId' as const,
      responses: {
        200: z.object({ 
          status: z.enum(['none', 'pending', 'received', 'accepted']),
          requestId: z.string().optional(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(z.object({
          id: z.string(),
          username: z.string(),
          displayName: z.string(),
          avatarColor: z.string(),
          isOnline: z.boolean(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
    search: {
      method: 'GET' as const,
      path: '/api/users/search' as const,
      responses: {
        200: z.array(z.any()),
        401: errorSchemas.unauthorized,
      },
    },
  },
};

export const ws = {
  send: {
    message: z.object({ 
      conversationId: z.string(),
      content: z.string(),
    }),
    typing: z.object({ 
      conversationId: z.string(),
      isTyping: z.boolean(),
    }),
    join: z.object({
      conversationId: z.string(),
    }),
  },
  receive: {
    message: z.object({ 
      id: z.string(),
      conversationId: z.string(),
      senderId: z.string(),
      content: z.string(),
      createdAt: z.string(),
      sender: z.object({
        id: z.string(),
        username: z.string(),
        displayName: z.string(),
        avatarColor: z.string(),
      }),
    }),
    typing: z.object({ 
      conversationId: z.string(),
      userId: z.string(),
      username: z.string(),
      displayName: z.string(),
      isTyping: z.boolean(),
    }),
    presence: z.object({ 
      userId: z.string(),
      isOnline: z.boolean(),
      lastSeen: z.string().optional(),
    }),
    conversationUpdate: z.object({
      conversation: z.any(),
    }),
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type RegisterInput = z.infer<typeof api.auth.register.input>;
export type LoginInput = z.infer<typeof api.auth.login.input>;
export type AuthResponse = z.infer<typeof api.auth.register.responses[201]>;
export type CreateConversationInput = z.infer<typeof api.conversations.create.input>;
export type SendMessageInput = z.infer<typeof api.messages.send.input>;
