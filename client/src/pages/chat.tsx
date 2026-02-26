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
        <div className="w-full h-full shrink-0 md:shrink md:flex-1 relative flex bg-secondary/10 watermark-bg overflow-hidden">
          {activeId ? (
            <ChatArea conversationId={activeId} />
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground relative z-10">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-center gap-4 mb-6">
                  <motion.div 
                    animate={{ 
                      y: [0, -8, 0],
                      rotate: [0, 5, 0, -5, 0]
                    }}
                    transition={{ 
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-16 h-16 drop-shadow-2xl"
                  >
                    <img src="/logo.svg" alt="Chat Sphere" className="w-full h-full object-contain" />
                  </motion.div>
                  <h2 className="text-4xl font-display font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                    Chat Sphere
                  </h2>
                </div>
                <p className="mt-2 text-[15px] font-medium opacity-70">Select a conversation to start chatting</p>
                <div className="flex items-center gap-2 mt-12 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <p className="text-[10px] font-bold tracking-widest uppercase opacity-60">End-to-End Encrypted</p>
                </div>
              </motion.div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
