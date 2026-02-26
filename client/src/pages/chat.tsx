import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/chat/sidebar";
import ChatArea from "@/components/chat/chat-area";
import { MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const activeId = params.id || null;

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Mobile view logic: hide sidebar if chat is open, hide chat if no active chat */}
      <div className={`h-full w-full flex transition-transform duration-300 md:translate-x-0 ${activeId ? '-translate-x-full md:transform-none' : ''}`}>
        
        {/* Sidebar Container */}
        <div className="w-full md:w-auto h-full shrink-0 flex">
          <Sidebar activeId={activeId} />
        </div>

        {/* Main Chat Area Container */}
        <div className="w-full h-full shrink-0 md:shrink md:flex-1 relative flex bg-secondary/10">
          {activeId ? (
            <ChatArea conversationId={activeId} />
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground relative z-0">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 shadow-xl shadow-black/5 flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 text-primary/60" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground">Messenger</h2>
                <p className="mt-2 text-[15px]">Select a conversation to start chatting</p>
                <p className="text-xs mt-8 opacity-50">End-to-End Encrypted Simulation</p>
              </motion.div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
