import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevWalletRef = useRef(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    // Skip anonymous /auth/me probe if no JWT token & no cookie hint
    if (!localStorage.getItem("pizo_token") && !document.cookie.includes("session_token")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  // Listen for wallet update events emitted by api responses
  useEffect(() => {
    function onWalletUpdate(e) {
      const newBal = e?.detail?.wallet_balance;
      if (typeof newBal === 'undefined' || newBal === null) return;
      const prev = prevWalletRef.current ?? user?.wallet_balance ?? 0;
      const delta = newBal - prev;
      prevWalletRef.current = newBal;
      // Update user in-place so components reflect new balance
      if (user) setUser((u) => ({ ...u, wallet_balance: newBal }));
      if (delta > 0) {
        toast.success(`+${delta} coins`, { duration: 2000 });
        // larger celebratory confetti
        try {
          const canvas = document.createElement('canvas');
          canvas.style.position = 'fixed';
          canvas.style.left = '0';
          canvas.style.top = '0';
          canvas.style.pointerEvents = 'none';
          canvas.style.zIndex = 9999;
          document.body.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          const W = canvas.width = window.innerWidth;
          const H = canvas.height = window.innerHeight;
          const particles = [];
          for (let i = 0; i < 300; i++) {
            particles.push({ x: W/2, y: H/3, vx: (Math.random()-0.5)*18, vy: Math.random()*-16-2, r: Math.random()*8+2, c: `hsl(${Math.random()*360},70%,60%)`, life: 120 });
          }
          let t = 0;
          function frame() {
            t++;
            ctx.clearRect(0,0,W,H);
            particles.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.45;
              p.life -= 1;
              ctx.fillStyle = p.c;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
              ctx.fill();
            });
            if (t < 180) requestAnimationFrame(frame);
            else { ctx.clearRect(0,0,W,H); document.body.removeChild(canvas); }
          }
          requestAnimationFrame(frame);
        } catch (e) {}
      }
    }
    window.addEventListener('pizo:wallet_update', onWalletUpdate);
    return () => window.removeEventListener('pizo:wallet_update', onWalletUpdate);
  }, [user]);

  const loginEmail = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("pizo_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const registerEmail = async (name, email, password, role = "user", referral_code = null) => {
    const { data } = await api.post("/auth/register", { name, email, password, role, referral_code });
    localStorage.setItem("pizo_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (err) { console.error("Logout error:", err); }
    localStorage.removeItem("pizo_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, checkAuth, setUser, loginEmail, registerEmail, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
