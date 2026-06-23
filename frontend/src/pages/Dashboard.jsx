import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, Star, Anchor, Crown, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get("/bookings/me").then(r=>setBookings(r.data)).catch(()=>{});
    api.get("/subscriptions/me").then(r=>setSubs(r.data)).catch(()=>{});
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "owner") return <Navigate to="/owner" replace />;

  const activeSub = subs.find(s => s.status === "active");
  const badges = [
    { name: "First Mate", earned: bookings.length > 0 },
    { name: "Streak x3", earned: bookings.length >= 3 },
    { name: "Crew Captain", earned: bookings.length >= 10 },
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
        {!activeSub && (
          <Link to="/plans" className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white font-bold text-sm coral-glow" data-testid="dashboard-upgrade-button">Activate a Pass</Link>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-10">
        <StatCard label="BOOKINGS" value={bookings.length} icon={<Calendar/>}/>
        <StatCard label="ACTIVE PLAN" value={activeSub?.plan_name || "None"} icon={<Crown/>}/>
        <StatCard label="POINTS" value={bookings.length * 50} icon={<Star/>}/>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        <div className="md:col-span-2 glass rounded-3xl p-7">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Calendar size={12}/> RECENT BOOKINGS</div>
          <div className="mt-5 space-y-3">
            {bookings.length === 0 && <div className="text-sm text-zinc-400">No bookings yet. <Link to="/venues" className="text-[var(--pizo-gold-soft)] underline">Find a venue</Link>.</div>}
            {bookings.slice(0,6).map(b => (
              <motion.div key={b.booking_id} initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}}
                className="flex items-center justify-between glass-strong rounded-2xl p-4">
                <div>
                  <div className="font-display text-lg font-bold">{b.venue_name}</div>
                  <div className="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={11}/>{b.date}</span>
                    <span>{b.slot}</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">{b.status}</span>
              </motion.div>
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

      {activeSub && (
        <div className="mt-6 glass rounded-3xl p-7">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Anchor size={12}/> ACTIVE SUBSCRIPTION</div>
          <div className="mt-4 grid md:grid-cols-4 gap-4">
            <Info l="Plan" v={activeSub.plan_name}/>
            <Info l="Amount" v={`₹${activeSub.amount}`}/>
            <Info l="Ref" v={activeSub.upi_ref}/>
            <Info l="Expires" v={new Date(activeSub.expires_at).toLocaleDateString()}/>
          </div>
        </div>
      )}
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
function Info({ l, v }) {
  return <div className="glass-strong rounded-2xl p-4"><div className="text-[10px] tracking-widest text-zinc-500">{l}</div><div className="font-display font-bold mt-1">{v}</div></div>;
}
