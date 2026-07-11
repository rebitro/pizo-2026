import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Copy, Share2, X } from "lucide-react";

export default function ReferCard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const canvasRef = useRef(null);

  const referralCode = user?.referral_code || null;
  const shareUrl = `${window.location.origin}/?ref=${referralCode || ""}`;

  function copyCode() {
    if (!referralCode) return toast.error("Sign in to get your referral code");
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Referral link copied!");
      fireConfetti();
    }).catch(() => toast.error("Copy failed"));
  }

  async function nativeShare() {
    if (!referralCode) return toast.error("Sign in to get your referral code");
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join PIZO", text: `Use my code ${referralCode} to get rewards!`, url: shareUrl });
        toast.success("Shared!");
        fireConfetti();
      } catch (e) {
        // user cancelled
      }
    } else {
      copyCode();
    }
  }

  function fireConfetti() {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width = window.innerWidth;
      const H = canvas.height = window.innerHeight;
      const particles = [];
      // larger, longer confetti
      for (let i = 0; i < 300; i++) {
        particles.push({ x: W/2, y: H/3, vx: (Math.random()-0.5)*18, vy: Math.random()*-16-2, r: Math.random()*8+2, c: `hsl(${Math.random()*360},70%,60%)`, life: 140 });
      }
      let t = 0;
      function frame() {
        t++;
        ctx.clearRect(0,0,W,H);
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.45; // gravity
          p.life -= 1;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
          ctx.fill();
        });
        if (t < 180) requestAnimationFrame(frame);
        else ctx.clearRect(0,0,W,H);
      }
      requestAnimationFrame(frame);
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="glass rounded-3xl p-6 flex items-center gap-4 md:gap-6">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 -z-10" />
      <div className="flex-1">
        <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">REFER & EARN</div>
        <div className="font-display text-2xl font-bold mt-2">Share & Get Coins</div>
        <p className="text-sm text-zinc-300 mt-2">Invite friends, both get 5 coins on signup. For each booking your friend makes, they get 5 coins and you get 10 coins.</p>
        <div className="mt-4 flex gap-3">
          <button onClick={() => { if (!user) return toast.error("Please sign in to refer"); setOpen(true); }}
            className="px-4 py-2 rounded-full bg-[var(--pizo-coral)] text-white font-semibold">Refer Now</button>
          <button onClick={() => { navigator.href = '/help/referral'; }} className="px-4 py-2 rounded-full glass text-sm">How it works</button>
        </div>
        {user && (
          <div className="mt-3 text-xs text-zinc-400">Your code: <span className="ml-2 font-semibold text-white">{referralCode}</span></div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} />
          <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-md glass rounded-2xl p-6">
            <button className="absolute right-4 top-4 p-2" onClick={()=>setOpen(false)}><X/></button>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">SHARE YOUR CODE</div>
            <div className="font-display text-2xl font-bold mt-2">Invite friends, earn coins</div>
            <p className="text-sm text-zinc-300 mt-2">Send this link or code to a friend. Rewards are added instantly to wallets.</p>
            <div className="mt-4 bg-black/30 rounded-xl p-3 flex items-center justify-between">
              <div className="text-sm font-medium">{referralCode || 'Sign in to get your code'}</div>
              <div className="flex items-center gap-2">
                <button onClick={copyCode} className="px-3 py-2 rounded-lg glass flex items-center gap-2"><Copy size={14}/> Copy</button>
                <button onClick={nativeShare} className="px-3 py-2 rounded-lg bg-[var(--pizo-gold)] text-black flex items-center gap-2"><Share2 size={14}/> Share</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
