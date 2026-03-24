"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Loader2, Compass, CheckCircle2, Lock, UserPlus, LogIn } from "lucide-react";
import { GlassCard, Button, Input, cn } from "@/components/ui";
import { signIn, signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

type AuthType = 'magic' | 'password' | 'signup';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [authType, setAuthType] = useState<AuthType>('password');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    setMessage("");
    
    try {
      if (authType === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (!error) setSent(true);
        else setError(error.message);
      } else if (authType === 'password') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          router.refresh();
          onClose();
        }
        else setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (!error) {
          setSent(true);
          setMessage("Check your email to confirm your account.");
        } else {
          setError(error.message);
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000]"
          />
          <div className="fixed inset-0 flex items-center justify-center z-[2001] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md pointer-events-auto"
            >
              <GlassCard className="p-8 relative overflow-visible">
                <button
                  onClick={onClose}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border border-surface-border flex items-center justify-center text-muted hover:text-foreground transition-colors shadow-xl"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/20">
                    <Compass className="text-white w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-foreground">
                      {authType === 'signup' ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-muted text-sm font-medium">
                      {sent 
                        ? (message || "Check your inbox for a confirmation link.") 
                        : "Sign in to save itineraries and curate your personal map."}
                    </p>
                  </div>

                  {sent ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4 py-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <p className="text-emerald-500 font-bold text-sm uppercase tracking-widest">Success!</p>
                      <Button variant="secondary" onClick={onClose} className="mt-2">Close</Button>
                    </motion.div>
                  ) : (
                    <div className="w-full space-y-6">
                      <nav className="flex bg-background/50 p-1 rounded-xl border border-surface-border">
                        <button 
                          onClick={() => { setAuthType('password'); setError(""); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                            authType === 'password' ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
                          )}
                        >
                          <LogIn className="w-3 h-3" />
                          Login
                        </button>
                        <button 
                          onClick={() => { setAuthType('signup'); setError(""); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                            authType === 'signup' ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
                          )}
                        >
                          <UserPlus className="w-3 h-3" />
                          Sign Up
                        </button>
                        <button 
                          onClick={() => { setAuthType('magic'); setError(""); }}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                            authType === 'magic' ? "bg-surface text-foreground shadow-sm border border-surface-border" : "text-muted hover:text-foreground"
                          )}
                        >
                          <Mail className="w-3 h-3" />
                          Magic
                        </button>
                      </nav>

                      <form onSubmit={handleAuth} className="w-full space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-11 h-12"
                            required
                          />
                        </div>

                        {authType !== 'magic' && (
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                            <Input
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-11 h-12"
                              required
                            />
                          </div>
                        )}

                        {error && (
                          <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider bg-red-400/10 border border-red-400/20 p-3 rounded-xl">{error}</p>
                        )}

                        <Button
                          type="submit"
                          isLoading={loading}
                          className="w-full h-12 font-black uppercase tracking-widest"
                        >
                          {authType === 'magic' ? 'Send Magic Link' : authType === 'signup' ? 'Create Account' : 'Sign In'}
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
