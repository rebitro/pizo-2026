import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Flame, Sparkles, Trophy, ArrowUp, ArrowDown, Award } from "lucide-react";
import { api } from "@/lib/api";

export default function CreatorClub() {
  const [creators, setCreators] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showJoinForm, setShowJoinForm] = useState(false);

  useEffect(() => { api.get("/creators").then(r => setCreators(r.data)).catch(()=>{}); }, []);

  const filtered = filter === "all" ? creators : creators.filter(c => c.category === filter);
  const podium = filtered.slice(0,3);
  const rest = filtered.slice(3);

  const monthly = {
    face: filtered.find(c => c.category === "face") || filtered[2],
    model: filtered.find(c => c.category === "model") || filtered[3],
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="creators-page">
      <div className="text-center">
        <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CREATOR CLUB</div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-3">Be the <span className="gold-text">flagship.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">Upload reels, score engagement, climb the leaderboard. Monthly rewards: Face of the Month, Model of the Month, cash prizes, free subscriptions, merch drops.</p>
      </div>

      {/* Monthly Rewards */}
      <div className="grid md:grid-cols-2 gap-5 mt-12">
        {[{ key:"face", label:"FACE OF THE MONTH", icon:<Crown/>, person: monthly.face },
          { key:"model", label:"MODEL OF THE MONTH", icon:<Sparkles/>, person: monthly.model }].map((m,i)=>(
          m.person && (
            <motion.div key={i} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
              className="relative glass rounded-3xl p-7 overflow-hidden" data-testid={`reward-${m.key}`}>
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[var(--pizo-gold)]/20 blur-3xl"/>
              <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{m.icon} {m.label}</div>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative">
                  <img src={m.person.avatar} className="w-24 h-24 rounded-full ring-2 ring-[var(--pizo-gold)] object-cover" alt={m.person.name}/>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[var(--pizo-coral)] flex items-center justify-center text-xs font-bold">#{m.person.rank}</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-bold">{m.person.name}</div>
                  <div className="text-xs text-zinc-400">{m.person.handle}</div>
                  <div className="flex gap-2 mt-2">
                    {m.person.badges?.map((b,k)=>(<span key={k} className="px-2 py-1 rounded-full bg-white/5 text-[10px]">{b}</span>))}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                <Pill l="Cash" v="₹10K"/><Pill l="Free Sub" v="3 mo"/><Pill l="Merch" v="Drop"/>
              </div>
            </motion.div>
          )
        ))}
      </div>

      {/* Filter */}
      <div className="mt-14 flex flex-wrap gap-2">
        {[{v:"all",l:"All"},{v:"gamer",l:"Gamers"},{v:"creator",l:"Creators"},{v:"model",l:"Models"},{v:"face",l:"Faces"}].map(f=>(
          <button key={f.v} onClick={()=>setFilter(f.v)}
            data-testid={`creator-filter-${f.v}`}
            className={`text-xs tracking-widest px-4 py-2 rounded-full transition ${filter===f.v? "bg-[var(--pizo-coral)] text-white coral-glow":"glass hover:bg-white/10 text-zinc-300"}`}>
            {f.l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Podium */}
      <div className="grid md:grid-cols-3 gap-5 mt-8">
        {podium.map((c,i) => (
          <motion.div key={c.creator_id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}
            className={`relative glass rounded-3xl p-6 overflow-hidden ${i===0? "md:order-2 md:-translate-y-6 ring-1 ring-[var(--pizo-gold)]/40":""}`}>
            <div className={`absolute top-4 right-4 font-bebas text-5xl ${i===0?"text-[var(--pizo-gold)]":"text-zinc-700"}`}>#{c.rank}</div>
            <img src={c.avatar} className="w-20 h-20 rounded-full ring-2 ring-white/10 object-cover" alt={c.name}/>
            <div className="font-display text-xl font-bold mt-4">{c.name}</div>
            <div className="text-xs text-zinc-400">{c.handle}</div>
            <p className="text-xs text-zinc-300 mt-3">{c.bio}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Pill l="ENG" v={c.engagement}/><Pill l="CON" v={c.consistency}/><Pill l="QUA" v={c.quality}/>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[10px] tracking-[0.3em] text-zinc-400">POINTS</div>
              <div className="font-bebas text-3xl gold-text">{c.points}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard rows */}
      <div className="mt-10 glass rounded-3xl overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_80px_80px_80px_100px] gap-3 px-6 py-4 text-[10px] tracking-[0.3em] text-zinc-500 border-b border-white/5">
          <div>RANK</div><div>CREATOR</div><div>ENG</div><div>CON</div><div>QUA</div><div className="text-right">POINTS</div>
        </div>
        {rest.map((c, i) => (
          <motion.div key={c.creator_id} initial={{opacity:0,x:-20}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*0.05}}
            className="grid grid-cols-[60px_1fr_80px_80px_80px_100px] gap-3 px-6 py-4 items-center border-b border-white/5 hover:bg-white/[0.03] transition" data-testid={`leaderboard-row-${i}`}>
            <div className="font-bebas text-2xl text-zinc-400">#{c.rank}</div>
            <div className="flex items-center gap-3">
              <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" alt={c.name}/>
              <div>
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-zinc-500">{c.handle}</div>
              </div>
            </div>
            <div className="text-sm text-zinc-300">{c.engagement}</div>
            <div className="text-sm text-zinc-300">{c.consistency}</div>
            <div className="text-sm text-zinc-300">{c.quality}</div>
            <div className="font-bebas text-2xl gold-text text-right">{c.points}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-14 glass-strong rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-[var(--pizo-coral)]/20 blur-3xl rounded-full"/>
        <div className="relative">
          <Trophy className="mx-auto text-[var(--pizo-gold)]" size={32}/>
          <h2 className="font-display text-3xl md:text-5xl font-black mt-4">Got the spark?</h2>
          <p className="text-zinc-300 mt-3 max-w-xl mx-auto">Drop your reel, claim a spot, and the next monthly crown could be yours.</p>
          <button onClick={()=> setShowJoinForm(true)} className="mt-6 px-7 py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow" data-testid="creator-apply-button">
            Apply to the Crew
          </button>
        </div>
        {showJoinForm && (
          <div className="mt-6">
            <JoinForm onClose={() => setShowJoinForm(false)} onJoined={() => { setShowJoinForm(false); window.location.reload(); }} />
          </div>
        )}
      </div>
    </main>
  );
}

function Pill({ l, v }) {
  return (
    <div className="glass rounded-xl px-2 py-2 text-center">
      <div className="text-[9px] tracking-widest text-zinc-500">{l}</div>
      <div className="font-bebas text-lg text-white">{v}</div>
    </div>
  );
}

function JoinForm({ onClose, onJoined }) {
  const [form, setForm] = useState({ name: '', phone: '', instagram: '', youtube: '', bio: '' });
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { alert('Name and contact required'); return; }
    setLoading(true);
    try {
      const r = await (await import('@/lib/api')).api.post('/creators/join', form);
      alert(`Welcome! Your referral code: ${r.data.referral_code}`);
      onJoined && onJoined();
    } catch (err) { alert('Join failed: ' + (err?.response?.data?.detail || err.message || 'error')); }
    finally { setLoading(false); }
  };
  return (
    <form onSubmit={submit} className="mt-4 glass rounded-2xl p-4">
      <div className="grid gap-3">
        <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="p-2 rounded bg-black/40" />
        <input placeholder="Phone or email" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="p-2 rounded bg-black/40" />
        <input placeholder="Instagram" value={form.instagram} onChange={e=>setForm({...form,instagram:e.target.value})} className="p-2 rounded bg-black/40" />
        <input placeholder="YouTube" value={form.youtube} onChange={e=>setForm({...form,youtube:e.target.value})} className="p-2 rounded bg-black/40" />
        <textarea placeholder="Short bio (optional)" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} className="p-2 rounded bg-black/40" />
        <div className="flex gap-2">
          <button disabled={loading} className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">{loading? 'Joining...':'Join'}</button>
          <button type="button" onClick={onClose} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
        </div>
      </div>
    </form>
  );
}
