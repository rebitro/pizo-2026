import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User as UserIcon, Anchor } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { LOGO_URL } from "@/lib/api";

export default function AuthModal({ open, onClose }) {
  const { loginEmail, registerEmail } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await loginEmail(form.email, form.password);
        toast.success("Welcome back, pirate!");
      } else {
        await registerEmail(form.name, form.email, form.password, form.role);
        toast.success("Welcome aboard the crew!");
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
          data-testid="auth-modal"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md glass-strong rounded-3xl p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10" data-testid="auth-close-button">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <img src={LOGO_URL} className="w-12 h-12 rounded-full ring-1 ring-[var(--pizo-gold)]/40" alt="PIZO"/>
              <div>
                <div className="font-bebas text-2xl gold-text">PIZO</div>
                <div className="text-xs text-zinc-400">{mode === "login" ? "Welcome back, captain" : "Join the crew"}</div>
              </div>
            </div>

            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-full">
              {["login","register"].map(m => (
                <button key={m}
                  onClick={() => setMode(m)}
                  data-testid={`auth-mode-${m}`}
                  className={`flex-1 text-sm py-2 rounded-full transition ${mode===m? "bg-white/10 text-white" : "text-zinc-400"}`}>
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {mode === "register" && (
                <Field icon={<UserIcon size={14}/>} placeholder="Your name" value={form.name} onChange={v=>setForm({...form,name:v})} testid="auth-name-input"/>
              )}
              <Field icon={<Mail size={14}/>} placeholder="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} testid="auth-email-input"/>
              <Field icon={<Lock size={14}/>} placeholder="Password" type="password" value={form.password} onChange={v=>setForm({...form,password:v})} testid="auth-password-input"/>
              {mode === "register" && (
                <div className="flex gap-2">
                  {[{v:"user",l:"I'm a Player"},{v:"owner",l:"I'm a Venue Owner"}].map(r => (
                    <button type="button" key={r.v} onClick={()=>setForm({...form, role:r.v})}
                      data-testid={`auth-role-${r.v}`}
                      className={`flex-1 text-xs py-2.5 rounded-xl border transition ${form.role===r.v ? "bg-[var(--pizo-coral)]/20 border-[var(--pizo-coral)] text-white" : "bg-white/5 border-white/10 text-zinc-400"}`}>
                      {r.l}
                    </button>
                  ))}
                </div>
              )}
              <button type="submit" disabled={loading}
                data-testid="auth-submit-button"
                className="w-full py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow disabled:opacity-60 transition flex items-center justify-center gap-2">
                <Anchor size={14}/> {loading ? "..." : (mode === "login" ? "Sign in" : "Hoist the colors")}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10"/>
              <span className="text-[10px] tracking-[0.3em] text-zinc-500">OR</span>
              <div className="flex-1 h-px bg-white/10"/>
            </div>

            <button onClick={handleGoogle}
              data-testid="auth-google-button"
              className="w-full py-3 rounded-full bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition flex items-center justify-center gap-3">
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 5.1 29.3 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36 26.8 37 24 37c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.3 40.7 16 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.4l6.2 5.2C40.9 35.7 45 30.4 45 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
              Continue with Google
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ icon, placeholder, type = "text", value, onChange, testid }) {
  return (
    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 focus-within:border-[var(--pizo-coral)] transition">
      <span className="text-zinc-500">{icon}</span>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
        data-testid={testid}
        required
      />
    </div>
  );
}
