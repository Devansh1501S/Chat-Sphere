import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { Plus, Search, MessageSquare, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useConversations } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import NewChatDialog from "./new-chat-dialog";
import { motion } from "framer-motion";

export default function Sidebar({ activeId }: { activeId: string | null }) {
  const { user, logout } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const [search, setSearch] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const filteredConversations = conversations?.filter((c: any) => {
    if (!search) return true;
    const name = c.isGroup 
      ? c.name 
      : c.participants.find((p: any) => p.id !== user?.id)?.displayName || "";
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-full md:w-[320px] lg:w-[380px] h-full flex flex-col glass-panel border-r shrink-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 relative">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 ring-2 ring-background hover:ring-primary/50 transition-all cursor-pointer">
            <AvatarFallback color={user?.avatarColor}>
              {user?.displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-display font-bold text-foreground text-sm leading-none">{user?.displayName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Online</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground" onClick={logout} title="Logout">
            <LogOut className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary" onClick={() => setIsNewChatOpen(true)}>
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search chats..." 
            className="pl-9 bg-secondary/50 border-transparent focus:bg-background focus:border-primary/50 rounded-xl transition-all shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto chat-scroll p-2 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 opacity-50">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading chats...</p>
          </div>
        ) : filteredConversations?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center rotate-3 shadow-inner">
              <MessageSquare className="w-8 h-8 text-muted-foreground/50 -rotate-3" />
            </div>
            <div>
              <p className="font-display font-medium text-foreground">No chats yet</p>
              <p className="text-sm mt-1">Click the + button to start a new conversation.</p>
            </div>
          </div>
        ) : (
          filteredConversations?.map((conv: any, index: number) => {
            const isGroup = conv.isGroup;
            const otherUser = isGroup ? null : conv.participants.find((p: any) => p.id !== user?.id);
            const title = isGroup ? conv.name : (otherUser?.displayName || "Unknown");
            const avatarColor = isGroup ? "#6366f1" : (otherUser?.avatarColor || "#94a3b8");
            const initials = isGroup ? title.substring(0, 2) : title.substring(0, 2).toUpperCase();
            
            const lastMsg = conv.lastMessage;
            const isUnread = conv.unreadCount > 0;
            const isActive = activeId === conv.id;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                key={conv.id}
              >
                <Link href={`/chat/${conv.id}`}>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group relative",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                      : "hover:bg-secondary/80 text-foreground"
                  )}>
                    <div className="relative">
                      <Avatar className={cn("h-12 w-12 border-2", isActive ? "border-primary-foreground/20" : "border-background")}>
                        <AvatarFallback color={avatarColor}>{initials}</AvatarFallback>
                      </Avatar>
                      {!isGroup && otherUser?.isOnline && (
                        <div className={cn(
                          "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2",
                          isActive ? "border-primary bg-green-400" : "border-background bg-green-500"
                        )}></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className={cn("font-display font-semibold text-sm truncate", isActive ? "text-primary-foreground" : "text-foreground")}>
                          {title}
                        </h3>
                        {lastMsg && (
                          <span className={cn("text-[11px] whitespace-nowrap ml-2", 
                            isActive ? "text-primary-foreground/70" : (isUnread ? "text-primary font-bold" : "text-muted-foreground")
                          )}>
                            {formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false }).replace('about ', '').replace('less than a minute', 'now')}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center gap-2">
                        <p className={cn("text-sm truncate", 
                          isActive ? "text-primary-foreground/80" : (isUnread ? "text-foreground font-medium" : "text-muted-foreground")
                        )}>
                          {lastMsg 
                            ? (lastMsg.senderId === user?.id ? "You: " : "") + lastMsg.content 
                            : "No messages yet"}
                        </p>
                        
                        {isUnread && !isActive && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      <NewChatDialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen} />
    </div>
  );
}
