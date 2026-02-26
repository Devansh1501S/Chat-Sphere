import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiFetch } from "@/lib/api-client";
import type { CreateConversationInput, SendMessageInput } from "@shared/routes";

export function useConversations() {
  return useQuery({
    queryKey: [api.conversations.list.path],
    queryFn: async () => {
      const data = await apiFetch(api.conversations.list.path);
      return api.conversations.list.responses[200].parse(data);
    },
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: [api.conversations.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.conversations.get.path, { id });
      const data = await apiFetch(url);
      return api.conversations.get.responses[200].parse(data);
    },
    enabled: !!id,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: [api.conversations.messages.path, conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const url = buildUrl(api.conversations.messages.path, { id: conversationId });
      const data = await apiFetch(url);
      return api.conversations.messages.responses[200].parse(data);
    },
    enabled: !!conversationId,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const data = await apiFetch(api.users.list.path);
      return api.users.list.responses[200].parse(data);
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: [api.users.search.path, query],
    queryFn: async () => {
      if (!query) return [];
      const data = await apiFetch(`${api.users.search.path}?q=${encodeURIComponent(query)}`);
      return api.users.search.responses[200].parse(data);
    },
    enabled: query.length >= 1,
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: [api.friends.listRequests.path],
    queryFn: async () => {
      const data = await apiFetch(api.friends.listRequests.path);
      return api.friends.listRequests.responses[200].parse(data);
    },
  });
}

export function useFriendStatus(userId: string) {
  return useQuery({
    queryKey: [api.friends.status.path, userId],
    queryFn: async () => {
      const url = buildUrl(api.friends.status.path, { userId });
      const data = await apiFetch(url);
      return api.friends.status.responses[200].parse(data);
    },
    enabled: !!userId,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (receiverId: string) => {
      const data = { receiverId };
      const validated = api.friends.sendRequest.input.parse(data);
      const res = await apiFetch(api.friends.sendRequest.path, {
        method: api.friends.sendRequest.method,
        body: JSON.stringify(validated),
      });
      return api.friends.sendRequest.responses[201].parse(res);
    },
    onSuccess: (_, receiverId) => {
      queryClient.invalidateQueries({ queryKey: [api.friends.status.path, receiverId] });
    },
  });
}

export function useUpdateFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string, status: 'accepted' | 'rejected' }) => {
      const url = buildUrl(api.friends.updateRequest.path, { id: requestId });
      const data = { status };
      const validated = api.friends.updateRequest.input.parse(data);
      const res = await apiFetch(url, {
        method: api.friends.updateRequest.method,
        body: JSON.stringify(validated),
      });
      return api.friends.updateRequest.responses[200].parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.friends.listRequests.path] });
      queryClient.invalidateQueries({ queryKey: [api.friends.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateConversationInput) => {
      const validated = api.conversations.create.input.parse(data);
      const res = await apiFetch(api.conversations.create.path, {
        method: api.conversations.create.method,
        body: JSON.stringify(validated),
      });
      return api.conversations.create.responses[201].parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.conversations.list.path] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendMessageInput) => {
      const validated = api.messages.send.input.parse(data);
      const res = await apiFetch(api.messages.send.path, {
        method: api.messages.send.method,
        body: JSON.stringify(validated),
      });
      return api.messages.send.responses[201].parse(res);
    },
    onSuccess: (newMessage: any) => {
      // Immediately update the messages cache for the sender
      queryClient.setQueryData(
        [api.conversations.messages.path, newMessage.conversationId],
        (old: any) => {
          if (!old) return [newMessage];
          if (old.some((m: any) => m.id === newMessage.id)) return old;
          return [...old, newMessage];
        }
      );
      // Update conversations list to reflect new last message
      queryClient.setQueryData([api.conversations.list.path], (old: any) => {
        if (!old) return old;
        return old.map((conv: any) =>
          conv.id === newMessage.conversationId
            ? { ...conv, lastMessage: newMessage, lastMessageAt: newMessage.createdAt, unreadCount: 0 }
            : conv
        ).sort((a: any, b: any) =>
          new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime()
        );
      });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const url = buildUrl(api.conversations.markRead.path, { id: conversationId });
      await apiFetch(url, { method: api.conversations.markRead.method });
    },
    onSuccess: (_, conversationId) => {
      queryClient.setQueryData([api.conversations.list.path], (old: any) => {
        if (!old) return old;
        return old.map((conv: any) => 
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        );
      });
    },
  });
}
