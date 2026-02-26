import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUsers, useCreateConversation } from "@/hooks/use-chat";
import { useAuth } from "@/hooks/use-auth";
import { Search, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function NewChatDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { data: users, isLoading } = useUsers();
  const { user: currentUser } = useAuth();
  const createConv = useCreateConversation();
  const [, setLocation] = useLocation();
  
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");

  const availableUsers = users?.filter(u => u.id !== currentUser?.id) || [];
  const filteredUsers = availableUsers.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

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
        participantIds: [...selectedIds, currentUser!.id],
        isGroup: isGroupMode,
        name: isGroupMode ? groupName : undefined
      });
      
      onOpenChange(false);
      setSelectedIds([]);
      setGroupName("");
      setLocation(`/chat/${conv.id}`);
    } catch (err) {
      console.error("Failed to create chat", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New Conversation</DialogTitle>
          <DialogDescription>
            Find a user to start chatting or create a group.
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

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-border focus:border-primary"
          />
        </div>

        <div className="mt-4 border rounded-xl overflow-hidden bg-card shadow-sm h-[240px] overflow-y-auto chat-scroll">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No users found.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredUsers.map(u => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <div 
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/5" : "hover:bg-secondary/50"
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
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )
              })}
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
