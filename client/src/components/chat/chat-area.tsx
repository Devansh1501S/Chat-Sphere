import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send, Image as ImageIcon, Smile, MoreVertical } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useConversation, useMessages, useSendMessage, useMarkAsRead } from "@/hooks/use-chat";
import { useSocket } from "@/hooks/use-socket";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatArea({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId);
  const { data: messages, isLoading: msgsLoading } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markRead = useMarkAsRead();
  const { emitTyping, typingUsers, socket, isConnected } = useSocket();
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Join socket room when opening a conversation
  useEffect(() => {
    if (conversationId && socket && isConnected) {
      socket.emit("join", { conversationId });
    }
  }, [conversationId, socket, isConnected]);

  // Mark as read when conversation is opened or new messages arrive
  useEffect(() => {
    if (conversationId && messages?.length) {
      markRead.mutate(conversationId);
    }
  }, [conversationId, messages?.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !conversationId) return;
    
    const content = input.trim();
    setInput("");
    emitTyping(conversationId, false);
    
    try {
      await sendMessage.mutateAsync({ conversationId, content });
    } catch (err) {
      console.error("Failed to send", err);
      setInput(content); // restore on fail
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    // Typing indicator logic
    emitTyping(conversationId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(conversationId, false);
    }, 2000);
  };

  if (convLoading || msgsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-secondary/10">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-secondary/10">
        <p className="text-muted-foreground font-medium">Conversation not found.</p>
      </div>
    );
  }

  const isGroup = conversation.isGroup;
  const otherUser = isGroup ? null : conversation.participants.find((p: any) => p.id !== user?.id);
  const title = isGroup ? conversation.name : (otherUser?.displayName || "Unknown user");
  const avatarColor = isGroup ? "#6366f1" : (otherUser?.avatarColor || "#94a3b8");
  const initials = isGroup ? title.substring(0, 2) : title.substring(0, 2).toUpperCase();
  const statusText = isGroup 
    ? `${conversation.participants.length} members` 
    : (otherUser?.isOnline ? "Online" : "Offline");

  const currentTyping = typingUsers[conversationId] || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-background/95 relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/50 blur-3xl mix-blend-multiply"></div>
      </div>

      {/* Header */}
      <div className="h-[72px] px-6 border-b border-border/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md flex items-center justify-between z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-10 w-10 shadow-sm">
              <AvatarFallback color={avatarColor}>{initials}</AvatarFallback>
            </Avatar>
            {!isGroup && otherUser?.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-background"></div>
            )}
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground leading-tight">{title}</h2>
            <p className={cn("text-xs mt-0.5", otherUser?.isOnline ? "text-green-600 font-medium" : "text-muted-foreground")}>
              {statusText}
            </p>
          </div>
        </div>
        <div>
          <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full hover:bg-secondary">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto chat-scroll p-6 flex flex-col gap-4 z-10"
      >
        <div className="text-center my-6">
          <span className="bg-secondary/50 text-muted-foreground text-xs font-medium px-3 py-1 rounded-full backdrop-blur-sm shadow-sm border border-border/50">
            Chat started
          </span>
        </div>

        {messages?.map((msg: any, i: number) => {
          const isMe = msg.senderId === user?.id;
          const showAvatar = isGroup && !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              key={msg.id} 
              className={cn("flex w-full", isMe ? "justify-end" : "justify-start")}
            >
              <div className={cn("flex max-w-[75%] md:max-w-[65%]", isMe ? "flex-row-reverse" : "flex-row")}>
                
                {isGroup && !isMe && (
                  <div className="w-8 shrink-0 mr-2 flex items-end pb-1">
                    {showAvatar && (
                      <Avatar className="h-6 w-6 shadow-sm">
                        <AvatarFallback color={msg.sender?.avatarColor} className="text-[10px]">
                          {msg.sender?.displayName?.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}

                <div className={cn(
                  "relative px-4 py-2.5 shadow-sm break-words",
                  isMe 
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm bubble-tail-right" 
                    : "bg-card text-card-foreground border border-border/50 rounded-2xl rounded-bl-sm bubble-tail-left"
                )}>
                  {isGroup && !isMe && showAvatar && (
                    <p className="text-[11px] font-bold mb-1" style={{ color: msg.sender?.avatarColor }}>
                      {msg.sender?.displayName}
                    </p>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <div className={cn(
                    "text-[10px] mt-1 text-right w-full flex justify-end items-center gap-1",
                    isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        <AnimatePresence>
          {currentTyping.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex justify-start pl-10"
            >
              <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-muted-foreground font-medium ml-1">
                  {currentTyping.join(', ')} typing...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Empty div to ensure padding at bottom */}
        <div className="h-2"></div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-t border-border/40 z-10 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-2 relative">
          <div className="flex-1 bg-card border border-border/60 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all flex items-end overflow-hidden p-1">
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl text-muted-foreground hover:text-primary mb-0.5">
              <Smile className="w-5 h-5" />
            </Button>
            <input 
              className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-3 px-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              autoComplete="off"
            />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl text-muted-foreground hover:text-primary mb-0.5">
              <ImageIcon className="w-5 h-5" />
            </Button>
          </div>
          
          <Button 
            type="submit" 
            disabled={!input.trim() || sendMessage.isPending}
            className="h-[52px] w-[52px] rounded-2xl shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center p-0"
          >
            <Send className="w-5 h-5 ml-1" /> {/* ml-1 to visually center the arrow */}
          </Button>
        </form>
      </div>
    </div>
  );
}
