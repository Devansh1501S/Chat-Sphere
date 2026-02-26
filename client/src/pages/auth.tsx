import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const { login, register, isLoggingIn, isRegistering } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    try {
      if (isLogin) {
        await login({ username, password });
      } else {
        await register({ username, password, displayName });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Authentication failed");
    }
  };

  const isPending = isLoggingIn || isRegistering;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/30 blur-[120px]"></div>
        <div className="absolute top-[40%] right-[20%] w-[20%] h-[20%] rounded-full bg-purple-500/10 blur-[80px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 shadow-2xl shadow-black/5">
          
          <div className="flex items-center justify-center gap-4 mb-10">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-14 h-14 drop-shadow-2xl flex-shrink-0"
            >
              <img src="/logo.svg" alt="Chat Sphere Logo" className="w-full h-full object-contain" />
            </motion.div>
            <h2 className="text-3xl font-display font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
              Chat Sphere
            </h2>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground">
              {isLogin ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin ? "Enter your details to access your chats" : "Sign up to start chatting with friends"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-sm font-medium ml-1">Display Name</label>
                  <Input 
                    placeholder="John Doe" 
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="h-12 rounded-xl bg-secondary/30 focus:bg-background border-border/50"
                    required={!isLogin}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Username</label>
              <Input 
                placeholder="johndoe" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="h-12 rounded-xl bg-secondary/30 focus:bg-background border-border/50"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Password</label>
              <Input 
                type="password"
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-12 rounded-xl bg-secondary/30 focus:bg-background border-border/50"
                required
                minLength={6}
              />
            </div>

            {errorMsg && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl font-medium text-center border border-destructive/20">
                {errorMsg}
              </motion.div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-[15px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all mt-4"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Please wait...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? "Sign In" : "Sign Up"}
                  <Sparkles className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button 
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setErrorMsg("");
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
