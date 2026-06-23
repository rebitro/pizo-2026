import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, MapPin, Calendar, Clock, Users, IndianRupee, Anchor, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";

export default function FindPirate() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ sport:"Turf 5v5", location:"", price_per_player:200, date:new Date(Date.now()+86400000).toISOString().slice(0,10), time:"7:00 PM", players_needed:2, note:"" });

  const load = () => api.get("/pirates/alerts").then(r => setAlerts(r.data)).catch(()=>{});
  useEffect(() => { load(); }, []);

  const post = async (e) => {
    e.preventDefault();
    if (!user) { setAuthOpen(true); return; }
    try {
      await api.post("/pirates/alerts", form);
      toast.success("Signal sent to the crew!");
      setOpen(false); load();
    } catch { toast.error("Could not post"); }
  };
  const join = async (id) => {
    if (!user) { setAuthOpen(true); return; }
    await api.post(`/pirates/alerts/${id}/join`);
    toast.success("You're in! Captain notified.");
    load();
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="pirate-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">FIND A PIRATE</div>
          <h1 className="font-display text-5xl md:text-7xl font-black mt-2">Short of <span className="gold-text">players?</span></h1>
          <p className="text-zinc-300 mt-3 max-w-xl">Drop a signal. Crew near you will jump aboard instantly.</p>
        </div>
        <button onClick={() => user ? setOpen(true) : setAuthOpen(true)} data-testid="pirate-post-cta"
          className="px-6 py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow flex items-center gap-2">
          <Plus size={14}/> Post a Signal
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {alerts.length === 0 && <div className="text-zinc-400 col-span-full text-center py-12">No active signals. Be the first captain →</div>}
        {alerts.map(a => (
          <motion.div key={a.alert_id} whileHover={{ y:-6 }} className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-[0.3em] text-[var(--pizo-coral-soft)]">{a.sport.toUpperCase()}</span>
              <span className="text-xs text-zinc-400">{a.user_name}</span>
            </div>
            <div className="font-display text-xl font-bold mt-3 flex items-center gap-1"><MapPin size={14}/> {a.location}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300">
              <div className="flex items-center gap-1"><Calendar size={12}/> {a.date}</div>
              <div className="flex items-center gap-1"><Clock size={12}/> {a.time}</div>
              <div className="flex items-center gap-1"><Users size={12}/> Need {a.players_needed}</div>
              <div className="flex items-center gap-1"><IndianRupee size={12}/> ₹{a.price_per_player}/player</div>
            </div>
            {a.note && <p className="text-xs text-zinc-400 mt-3 italic">"{a.note}"</p>}
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-zinc-500">{(a.responders||[]).length} joined</div>
              <button onClick={()=>join(a.alert_id)} data-testid={`pirate-join-${a.alert_id}`}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1">
                <Anchor size={12}/> Join Crew
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <motion.form onSubmit={post} initial={{scale:0.95,y:20}} animate={{scale:1,y:0}} onClick={(e)=>e.stopPropagation()}
            className="w-full max-w-md glass-strong rounded-3xl p-7 relative" data-testid="pirate-form">
            <button type="button" onClick={()=>setOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5"><X size={16}/></button>
            <h3 className="font-display text-2xl font-bold">Post a Signal</h3>
            <div className="space-y-3 mt-5">
              {[
                ["Sport / Activity","sport","text"],["Location","location","text"],
                ["Price per player (₹)","price_per_player","number"],["Date","date","date"],
                ["Time","time","text"],["Players needed","players_needed","number"]
              ].map(([l,k,t])=>(
                <div key={k}>
                  <label className="text-[10px] tracking-widest text-zinc-400">{l.toUpperCase()}</label>
                  <input type={t} required value={form[k]} onChange={e=>setForm({...form,[k]:t==="number"?Number(e.target.value):e.target.value})}
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--pizo-coral)] [color-scheme:dark]"/>
                </div>
              ))}
              <textarea placeholder="Note (optional)" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" rows={2}/>
            </div>
            <button type="submit" data-testid="pirate-submit" className="w-full mt-5 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow">Send Signal</button>
          </motion.form>
        </div>
      )}
      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)}/>
    </main>
  );
}
