import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Trophy, Star, Anchor, Crown, Award, Gift, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [subs, setSubs] = useState([]);
  const [scratches, setScratches] = useState([]);
  const [revealed, setRevealed] = useState(null);

  const loadAll = () => {
    api.get("/bookings/me").then(r=>setBookings(r.data)).catch(()=>{});
    api.get("/subscriptions/me").then(r=>setSubs(r.data)).catch(()=>{});
    api.get("/scratch/me").then(r=>setScratches(r.data)).catch(()=>{});
  };
  useEffect(() => { if (user) loadAll(); }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "owner") return <Navigate to="/owner" replace />;

  const activeSub = subs.find(s => s.status === "active");
  const count = bookings.length;
  const nextMilestone = Math.ceil((count+1)/5)*5;
  const toGo = nextMilestone - count;
  const progressPct = ((count % 5) / 5) * 100;

  const reveal = async (code) => {
    try {
      const { data } = await api.post(`/scratch/${code}/reveal`);
      setRevealed(data); loadAll();
    } catch { toast.error("Could not reveal"); }
  };

  const badges = [
    { name: "First Mate", earned: count > 0 },
    { name: "Streak x3", earned: count >= 3 },
    { name: "Crew Captain", earned: count >= 10 },
    { name: "Subscriber", earned: !!activeSub },
  ];

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="user-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.picture ? (
            <img src={user.picture} className="w-16 h-16 rounded-full ring-2 ring-[var(--pizo-gold)] object-cover" alt={user.name}/>
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--pizo-coral)]/20 ring-2 ring-[var(--pizo-gold)] flex items-center justify-center font-bebas text-2xl gold-text">{user.name?.[0] || "P"}</div>
          )}
          <div>
            <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CAPTAIN'S DECK</div>
            <h1 className="font-display text-3xl md:text-4xl font-black">Ahoy, {user.name?.split(" ")[0]}</h1>
          </div>
        </div>
        {!activeSub ? (
          <Link to="/plans" className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white font-bold text-sm coral-glow" data-testid="dashboard-upgrade-button">Activate a Pass</Link>
        ) : activeSub.plan_id !== "premium" && (
          <Link to="/plans" className="px-5 py-2.5 rounded-full glass hover:bg-white/10 text-white font-bold text-sm flex items-center gap-1" data-testid="dashboard-upgrade-premium">
            <Crown size={14}/> Upgrade to Premium
          </Link>
        )}
      </div>

      {/* Progress to next scratch */}
      <div className="mt-8 glass rounded-3xl p-6" data-testid="scratch-progress">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]">SCRATCH PROGRESS</div>
            <div className="font-display text-xl mt-1">{toGo === 5 ? "🎉 Scratch unlocked!" : `${toGo} more booking${toGo>1?"s":""} → unlock scratch card`}</div>
          </div>
          <div className="font-bebas text-4xl gold-text">{count}/{nextMilestone}</div>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.8 }}
            className="h-full bg-gradient-to-r from-[var(--pizo-gold)] to-[var(--pizo-coral)] rounded-full"/>
        </div>
      </div>

      {scratches.length > 0 && (
        <div className="mt-6 glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Gift size={12}/> YOUR SCRATCH CARDS</div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {scratches.map(s => (
              <motion.div key={s.code} whileHover={{ scale: 1.03 }}
                onClick={()=>!s.revealed && !s.used && reveal(s.code)}
                className={`relative rounded-2xl p-5 aspect-[16/10] cursor-pointer flex flex-col items-center justify-center overflow-hidden ${s.used ? "opacity-40" : ""}`}
                style={{ background: s.revealed || s.used ? "linear-gradient(135deg, #D4AF37, #b8860b)" : "linear-gradient(135deg, #2a2a2a, #1a1a1a)" }}
                data-testid={`scratch-card-${s.code}`}>
                {!s.revealed && !s.used ? (
                  <>
                    <Sparkles className="text-[var(--pizo-gold)] animate-pulse" size={32}/>
                    <div className="text-xs tracking-widest text-zinc-400 mt-2">TAP TO SCRATCH</div>
                  </>
                ) : (
                  <>
                    <div className="font-bebas text-5xl text-black">{s.discount_pct}%</div>
                    <div className="text-xs font-bold text-black/80 mt-1">OFF NEXT BOOKING</div>
                    <div className="absolute bottom-2 text-[9px] font-mono text-black/60">{s.code}</div>
                    {s.used && <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-bold">USED</div>}
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        <StatCard label="BOOKINGS" value={count} icon={<Calendar/>}/>
        <StatCard label="ACTIVE PLAN" value={activeSub?.plan_name || "None"} icon={<Crown/>}/>
        <StatCard label="POINTS" value={count * 50} icon={<Star/>}/>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        <div className="md:col-span-2 glass rounded-3xl p-7">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Calendar size={12}/> RECENT BOOKINGS</div>
          <div className="mt-5 space-y-3">
            {bookings.length === 0 && <div className="text-sm text-zinc-400">No bookings yet. <Link to="/venues" className="text-[var(--pizo-gold-soft)] underline">Find a venue</Link>.</div>}
            {bookings.slice(0,6).map(b => (
              <div key={b.booking_id} className="flex items-center justify-between glass-strong rounded-2xl p-4">
                <div>
                  <div className="font-display text-lg font-bold">{b.venue_name}</div>
                  <div className="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={11}/>{b.date}</span>
                    <span>{b.slot}</span>
                    {b.num_players > 1 && <span>• {b.num_players}p ₹{b.per_player}/ea</span>}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">{b.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-3xl p-7">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Award size={12}/> BADGES</div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {badges.map((b,i)=>(
              <motion.div key={i} whileHover={{ scale: 1.05 }}
                className={`rounded-2xl p-4 text-center ${b.earned ? "glass-strong ring-1 ring-[var(--pizo-gold)]/40" : "bg-white/[0.02] opacity-60"}`}>
                <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center ${b.earned ? "bg-[var(--pizo-gold)]/20 text-[var(--pizo-gold-soft)]" : "bg-white/5 text-zinc-600"}`}>
                  <Trophy size={16}/>
                </div>
                <div className="text-xs mt-2 font-semibold">{b.name}</div>
                <div className="text-[9px] tracking-widest text-zinc-500 mt-1">{b.earned ? "EARNED" : "LOCKED"}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
      {revealed && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={()=>setRevealed(null)}>
          <motion.div initial={{scale:0.5, rotate:-10}} animate={{scale:1, rotate:0}} transition={{ type:"spring" }}
            className="glass-strong rounded-3xl p-8 max-w-sm text-center">
            <Sparkles className="mx-auto text-[var(--pizo-gold)]" size={40}/>
            <div className="font-bebas text-7xl gold-text mt-3">{revealed.discount_pct}% OFF</div>
            <div className="text-sm text-zinc-300 mt-2">Apply <span className="font-mono">{revealed.code}</span> on your next booking</div>
            <button onClick={()=>{navigator.clipboard.writeText(revealed.code); toast.success("Copied!");}} className="mt-5 px-5 py-2 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold flex items-center gap-2 mx-auto">
              <Copy size={14}/> Copy Code
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </main>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="glass rounded-3xl p-6 flex items-center justify-between">
      <div>
        <div className="text-[10px] tracking-[0.3em] text-zinc-400">{label}</div>
        <div className="font-bebas text-4xl gold-text mt-1">{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-[var(--pizo-coral)]/15 border border-[var(--pizo-coral)]/30 text-[var(--pizo-coral-soft)] flex items-center justify-center">{icon}</div>
    </div>
  );
}
