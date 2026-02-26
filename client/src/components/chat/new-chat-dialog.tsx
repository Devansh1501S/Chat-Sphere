import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCreateConversation, useSearchUsers, useSendFriendRequest, useFriendStatus } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { Search, Users, Check, UserPlus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

function UserListItem({ 
  u, 
  isSelected, 
  onClick, 
  isGroupMode 
}: { 
  u: any, 
  isSelected: boolean, 
  onClick: () => void,
  isGroupMode: boolean
}) {
  const { data: friendStatus, isLoading: statusLoading } = useFriendStatus(u.id);
  const sendFriendRequest = useSendFriendRequest();
  const { toast } = useToast();

  const handleSendRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await sendFriendRequest.mutateAsync(u.id);
      toast({
        title: "Friend request sent",
        description: `You've sent a friend request to ${u.displayName}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send friend request",
      });
    }
  };

  const canChat = isGroupMode || friendStatus?.status === 'accepted';
  const isPending = friendStatus?.status === 'pending';
  const isReceived = friendStatus?.status === 'received';

  return (
    <div 
      onClick={canChat ? onClick : undefined}
      className={cn(
        "flex items-center justify-between p-3 transition-colors",
        canChat ? "cursor-pointer hover:bg-secondary/50" : "opacity-70",
        isSelected ? "bg-primary/5" : ""
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback color={u.avatarColor}>
            {u.displayName.substring(0,2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm text-foreground">{u.displayName}</p>
          <p className="text-xs text-muted-foreground">@{u.username}</p>
        </div>
      </div>
      
      {canChat ? (
        isSelected && (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <Check className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        )
      ) : (
        <div onClick={e => e.stopPropagation()}>
          {statusLoading ? (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          ) : isPending ? (
            <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Pending
            </Button>
          ) : isReceived ? (
            <div className="text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded-lg">
              Check Requests
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-1.5 text-xs h-8 rounded-lg"
              onClick={handleSendRequest}
              disabled={sendFriendRequest.isPending}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Friend
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewChatDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { user: currentUser } = useAuth();
  const createConv = useCreateConversation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");

  const { data: searchResults, isLoading, error: searchError } = useSearchUsers(activeSearch);

  const handleSearch = () => {
    const trimmed = search.trim();
    if (!trimmed) {
      toast({
        variant: "destructive",
        title: "Empty search",
        description: "Please enter a username to search",
      });
      return;
    }
    setActiveSearch(trimmed);
  };

  const toggleUser = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(i => i !== id));
    } else {
      if (!isGroupMode) {
        setSelectedIds([id]); // Only one for direct chat
      } else {
        setSelectedIds(prev => [...prev, id]);
      }
    }
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const conv = await createConv.mutateAsync({
        participantIds: selectedIds,
        isGroup: isGroupMode,
        name: isGroupMode ? groupName : undefined
      });
      
      onOpenChange(false);
      setSelectedIds([]);
      setGroupName("");
      setSearch("");
      setActiveSearch("");
      setLocation(`/chat/${conv.id}`);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to create chat",
      });
    }
  };

  const displayUsers = searchResults || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Conversation</DialogTitle>
          <DialogDescription>
            Search for users to add as friends or start a chat.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <Button 
            variant={!isGroupMode ? "default" : "outline"} 
            className="flex-1 rounded-xl"
            onClick={() => { setIsGroupMode(false); setSelectedIds(selectedIds.slice(0,1)); }}
          >
            Direct Message
          </Button>
          <Button 
            variant={isGroupMode ? "default" : "outline"} 
            className="flex-1 rounded-xl"
            onClick={() => setIsGroupMode(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Group Chat
          </Button>
        </div>

        {isGroupMode && (
          <div className="mt-4">
            <Input 
              placeholder="Group Name" 
              value={groupName} 
              onChange={e => setGroupName(e.target.value)}
              className="rounded-xl border-primary/20 focus:border-primary bg-secondary/50"
            />
          </div>
        )}

        <div className="relative mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Enter exact username..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="pl-9 rounded-xl border-border focus:border-primary"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading} className="rounded-xl px-4">
            Search
          </Button>
        </div>

        <div className="mt-4 border rounded-xl overflow-hidden bg-card shadow-sm h-[240px] overflow-y-auto chat-scroll">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
              Searching user...
            </div>
          ) : searchError ? (
            <div className="p-8 text-center text-sm text-red-500">
              Failed to search users. Please try again.
            </div>
          ) : !activeSearch ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Enter an exact username to search.
            </div>
          ) : !displayUsers || displayUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No user found with that exact username.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {displayUsers.map(u => (
                <UserListItem 
                  key={u.id}
                  u={u}
                  isSelected={selectedIds.includes(u.id)}
                  onClick={() => toggleUser(u.id)}
                  isGroupMode={isGroupMode}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button 
            disabled={selectedIds.length === 0 || (isGroupMode && (!groupName || selectedIds.length < 1)) || createConv.isPending}
            onClick={handleCreate}
            className="rounded-xl px-8 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
          >
            {createConv.isPending ? "Starting..." : "Start Chat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
