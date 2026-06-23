import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Mail, Building, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("pizo_admin") || "");
  const [authed, setAuthed] = useState(false);
  const [overview, setOverview] = useState(null);
  const [venues, setVenues] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tab, setTab] = useState("venues");

  const tryAuth = async (t) => {
    try {
      const { data } = await api.get("/admin/overview", { headers: { "X-Admin-Token": t } });
      setOverview(data); setAuthed(true); localStorage.setItem("pizo_admin", t);
      const v = await api.get("/admin/venues", { headers: { "X-Admin-Token": t } });
      setVenues(v.data);
      const c = await api.get("/admin/contacts", { headers: { "X-Admin-Token": t } });
      setContacts(c.data);
    } catch { toast.error("Invalid token"); setAuthed(false); }
  };
  useEffect(() => { if (token) tryAuth(token); }, []);

  const toggleVerify = async (v) => {
    const ep = v.verified ? "unverify" : "verify";
    await api.post(`/admin/venues/${v.venue_id}/${ep}`, {}, { headers: { "X-Admin-Token": token }});
    toast.success(v.verified ? "Badge removed" : "Verified ✓");
    tryAuth(token);
  };

  if (!authed) return (
    <main className="pt-32 pb-24 px-6 max-w-md mx-auto" data-testid="admin-page">
      <div className="glass-strong rounded-3xl p-8">
        <Lock className="text-[var(--pizo-gold)]" size={28}/>
        <h1 className="font-display text-3xl font-black mt-3">Admin Console</h1>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Admin token" data-testid="admin-token-input"
          className="w-full mt-5 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm outline-none"/>
        <button onClick={()=>tryAuth(token)} data-testid="admin-login" className="w-full mt-3 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow">Unlock</button>
        <p className="text-[10px] text-zinc-500 mt-3">Default token: pizo-admin-2026 (change in backend/.env)</p>
      </div>
    </main>
  );

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="admin-dashboard">
      <h1 className="font-display text-4xl font-black"><span className="gold-text">Admin</span> Console</h1>
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        {overview && Object.entries(overview).map(([k,v])=>(
          <div key={k} className="glass rounded-2xl p-5">
            <div className="text-[10px] tracking-widest text-zinc-400">{k.toUpperCase().replace("_"," ")}</div>
            <div className="font-bebas text-4xl gold-text mt-1">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-8">
        {[["venues","Venues"],["contacts","Contact Messages"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={`text-xs px-4 py-2 rounded-full ${tab===v?"bg-[var(--pizo-coral)] text-white":"glass"}`}>{l}</button>
        ))}
      </div>
      {tab==="venues" && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {venues.map(v=>(
            <div key={v.venue_id} className="glass rounded-2xl p-5 flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-bold">{v.name} {v.verified && <span className="text-emerald-300 text-xs ml-2">✓ VERIFIED</span>}</div>
                <div className="text-xs text-zinc-400">{v.city} • {v.category} • ₹{v.price_per_hour}/hr</div>
              </div>
              <button onClick={()=>toggleVerify(v)} className={`px-4 py-2 rounded-full text-xs font-bold ${v.verified?"bg-red-500/15 text-red-300":"bg-emerald-500/15 text-emerald-300"}`}>
                {v.verified?"Remove Badge":"Verify"}
              </button>
            </div>
          ))}
        </div>
      )}
      {tab==="contacts" && (
        <div className="mt-6 space-y-3">
          {contacts.map(c=>(
            <div key={c.contact_id} className="glass rounded-2xl p-5">
              <div className="flex justify-between"><b>{c.name}</b><span className="text-xs text-zinc-400">{c.email}</span></div>
              <p className="text-sm text-zinc-300 mt-2">{c.message}</p>
              <div className="text-[10px] text-zinc-500 mt-2">{c.created_at}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
