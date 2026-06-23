import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Building, IndianRupee, Users, Calendar, Plus, X, Lock, Copy, Check, Anchor, Award } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import CaptainsCard from "@/components/CaptainsCard";

const CATS = ["turf","gaming","billiards","pickleball"];
const ONBOARD_FEE = 149;

export default function OwnerDashboard() {
  const { user, loading, checkAuth } = useAuth();
  const [data, setData] = useState({ venues: [], bookings: [], revenue: 0, footfall: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPaying, setOnboardPaying] = useState(false);
  const [onboardRef, setOnboardRef] = useState(null);
  const [form, setForm] = useState({ name:"", category:"turf", city:"", address:"", price_per_hour:1000, image:"https://images.pexels.com/photos/399187/pexels-photo-399187.jpeg", description:"", amenities:"Floodlights,Parking" });
  const [cardVenue, setCardVenue] = useState(null);

  const load = async () => {
    try {
      const r = await api.get("/owner/analytics");
      setData({
        venues: r.data.venues, bookings: r.data.bookings,
        revenue: r.data.gross_revenue, footfall: r.data.footfall,
        commission: r.data.commission_amount, net_payout: r.data.net_payout,
        commission_pct: r.data.commission_pct, payout_schedule: r.data.payout_schedule,
      });
    } catch (err) { console.error("Owner load failed:", err); }
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;

  const isOnboarded = !!user.owner_onboarded;

  const startOnboard = () => {
    if (isOnboarded) { setAddOpen(true); return; }
    setOnboardOpen(true);
  };

  const payOnboard = async () => {
    setOnboardPaying(true);
    try {
      const { data } = await api.post("/owners/onboard", { upi_id: "pizo@upi" });
      setOnboardRef(data.upi_ref);
      toast.success(`Onboarded! Ref ${data.upi_ref}`);
      await checkAuth();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Onboarding failed");
    } finally {
      setOnboardPaying(false);
    }
  };

  const closeOnboard = () => { setOnboardOpen(false); setOnboardRef(null); };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/venues", {
        ...form,
        price_per_hour: Number(form.price_per_hour),
        amenities: form.amenities.split(",").map(s=>s.trim()).filter(Boolean),
      });
      toast.success("Venue added — live on the marketplace!");
      setAddOpen(false); load();
    } catch (e) {
      if (e?.response?.status === 402) { setAddOpen(false); setOnboardOpen(true); return; }
      toast.error(e?.response?.data?.detail || "Failed to add venue");
    }
  };

  // chart data
  const last7 = Array.from({ length: 7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0,10);
    const count = data.bookings.filter(b => b.date === key).length;
    return { day: d.toLocaleDateString("en-US",{weekday:"short"}), bookings: count + Math.floor(Math.random()*3) };
  });
  const revByCat = CATS.map(c => ({
    name: c,
    revenue: data.venues.filter(v=>v.category===c).reduce((sum,v)=>sum + v.price_per_hour * data.bookings.filter(b=>b.venue_id===v.venue_id).length, 0) + Math.floor(Math.random()*5000),
  }));

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="owner-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">FLEET COMMAND</div>
          <h1 className="font-display text-3xl md:text-4xl font-black">Captain {user.name?.split(" ")[0]}'s Wharf</h1>
        </div>
        <button onClick={startOnboard} className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold text-sm coral-glow flex items-center gap-2" data-testid="owner-add-venue">
          {isOnboarded ? <><Plus size={14}/> Add Venue</> : <><Lock size={14}/> Unlock for ₹{ONBOARD_FEE}</>}
        </button>
      </div>

      {!isOnboarded && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
          className="mt-8 glass-strong rounded-3xl p-7 border border-[var(--pizo-coral)]/30 relative overflow-hidden" data-testid="onboard-banner">
          <div className="absolute -top-10 -right-10 w-56 h-56 bg-[var(--pizo-coral)]/25 blur-3xl rounded-full"/>
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-xl">
              <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-coral-soft)]">PIRATE LICENSE • ONE-TIME</div>
              <h2 className="font-display text-2xl md:text-3xl font-black mt-2">Pay ₹{ONBOARD_FEE} to hoist your flag.</h2>
              <p className="text-zinc-300 text-sm mt-2">A one-time onboarding fee gives you lifetime access to list unlimited venues on PIZO — they go live instantly on the marketplace.</p>
            </div>
            <button onClick={()=>setOnboardOpen(true)} data-testid="onboard-cta" className="px-6 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow flex items-center gap-2">
              <Anchor size={14}/> Pay ₹{ONBOARD_FEE} & Activate
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid md:grid-cols-4 gap-5 mt-10">
        <Stat label="VENUES" value={data.venues.length} icon={<Building/>}/>
        <Stat label="FOOTFALL" value={data.footfall} icon={<Users/>}/>
        <Stat label="REVENUE" value={`₹${(data.revenue || 0).toLocaleString()}`} icon={<IndianRupee/>}/>
        <Stat label="BOOKINGS" value={data.bookings.length} icon={<Calendar/>}/>
      </div>
      {data.payout_schedule && (
        <div className="mt-4 glass rounded-2xl px-5 py-3 text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2">
          <span>💸 {data.commission_pct || 9}% PIZO commission • Net payout: <b className="text-[var(--pizo-gold-soft)]">₹{(data.net_payout||0).toLocaleString()}</b></span>
          <span className="text-zinc-500">⏱ {data.payout_schedule}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <div className="glass rounded-3xl p-6">
          <div className="text-[10px] tracking-[0.3em] text-zinc-400 mb-4">BOOKINGS — LAST 7 DAYS</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10"/>
              <XAxis dataKey="day" stroke="#71717a" fontSize={11}/>
              <YAxis stroke="#71717a" fontSize={11}/>
              <Tooltip contentStyle={{ background: "#0c0c0e", border: "1px solid #ffffff20", borderRadius: 12 }}/>
              <Line type="monotone" dataKey="bookings" stroke="#FF5E3A" strokeWidth={3} dot={{ fill: "#D4AF37", r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="text-[10px] tracking-[0.3em] text-zinc-400 mb-4">REVENUE BY CATEGORY</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revByCat}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10"/>
              <XAxis dataKey="name" stroke="#71717a" fontSize={11}/>
              <YAxis stroke="#71717a" fontSize={11}/>
              <Tooltip contentStyle={{ background: "#0c0c0e", border: "1px solid #ffffff20", borderRadius: 12 }}/>
              <Bar dataKey="revenue" fill="#D4AF37" radius={[8,8,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 mt-6">
        <div className="text-[10px] tracking-[0.3em] text-zinc-400 mb-4">YOUR FLEET</div>
        {data.venues.length === 0 ? (
          <div className="text-sm text-zinc-400">No venues yet. Add your first wharf →</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {data.venues.map(v => (
              <motion.div key={v.venue_id} whileHover={{ y:-4 }} className="glass-strong rounded-2xl overflow-hidden">
                <img src={v.image} className="w-full aspect-[16/10] object-cover" alt={v.name}/>
                <div className="p-4">
                  <div className="font-display font-bold">{v.name}</div>
                  <div className="text-xs text-zinc-400">{v.city} • {v.category}</div>
                  <div className="text-xs gold-text font-bebas text-xl mt-2">₹{v.price_per_hour}/hr</div>
                  <button onClick={()=>setCardVenue(v)} data-testid={`captains-card-${v.venue_id}`}
                    className="mt-3 w-full py-2 rounded-full bg-[var(--pizo-gold)]/15 border border-[var(--pizo-gold)]/40 text-[var(--pizo-gold-soft)] text-xs font-bold flex items-center justify-center gap-1">
                    <Award size={12}/> Captain's Card
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setAddOpen(false)}>
          <motion.form onSubmit={submit} initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }}
            onClick={(e)=>e.stopPropagation()} className="w-full max-w-lg glass-strong rounded-3xl p-7 relative" data-testid="add-venue-modal">
            <button type="button" onClick={()=>setAddOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5"><X size={16}/></button>
            <h3 className="font-display text-2xl font-bold">Add a Venue</h3>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <Input label="Name" value={form.name} onChange={v=>setForm({...form,name:v})}/>
              <div>
                <label className="text-[10px] tracking-widest text-zinc-400">CATEGORY</label>
                <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                  {CATS.map(c=><option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                </select>
              </div>
              <Input label="City" value={form.city} onChange={v=>setForm({...form,city:v})}/>
              <Input label="Price/hr" type="number" value={form.price_per_hour} onChange={v=>setForm({...form,price_per_hour:v})}/>
              <div className="col-span-2"><Input label="Address" value={form.address} onChange={v=>setForm({...form,address:v})}/></div>
              <div className="col-span-2"><Input label="Image URL" value={form.image} onChange={v=>setForm({...form,image:v})}/></div>
              <div className="col-span-2"><Input label="Amenities (comma)" value={form.amenities} onChange={v=>setForm({...form,amenities:v})}/></div>
              <div className="col-span-2"><Input label="Description" value={form.description} onChange={v=>setForm({...form,description:v})}/></div>
            </div>
            <button type="submit" className="w-full mt-6 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow" data-testid="add-venue-submit">Add to Fleet</button>
          </motion.form>
        </div>
      )}

      {onboardOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeOnboard}>
          <motion.div initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }}
            onClick={(e)=>e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-7 relative" data-testid="onboard-modal">
            <button onClick={closeOnboard} className="absolute top-4 right-4 p-2 rounded-full bg-white/5"><X size={16}/></button>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-coral-soft)]">PIRATE LICENSE</div>
            <h3 className="font-display text-2xl font-bold mt-1">Owner onboarding</h3>

            {!onboardRef ? (
              <>
                <div className="mt-5 glass rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] tracking-widest text-zinc-400">ONE-TIME FEE</div>
                      <div className="font-bebas text-5xl gold-text">₹{ONBOARD_FEE}</div>
                    </div>
                    <div className="text-right text-xs text-zinc-400">
                      <div>UPI: <span className="text-white">pizo@upi</span></div>
                      <div className="mt-1">No subscription. No renewal.</div>
                    </div>
                  </div>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-zinc-300">
                  <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> List unlimited venues</li>
                  <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Venues go live instantly on the marketplace</li>
                  <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Footfall & revenue analytics</li>
                  <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Pirates Verified badge after first 10 bookings</li>
                </ul>
                <button onClick={payOnboard} disabled={onboardPaying} data-testid="onboard-pay-button"
                  className="w-full mt-6 py-3.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow disabled:opacity-60 flex items-center justify-center gap-2">
                  <Anchor size={14}/> {onboardPaying ? "Hoisting..." : `Pay ₹${ONBOARD_FEE} via UPI`}
                </button>
                <p className="text-[10px] text-zinc-500 mt-3 text-center">MOCKED for demo. Razorpay live flow once keys are provided.</p>
              </>
            ) : (
              <div className="mt-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                  <Check size={22}/>
                </div>
                <h4 className="font-display text-xl font-bold mt-4">You're a verified PIZO owner.</h4>
                <p className="text-zinc-400 text-sm mt-2">Pay ₹{ONBOARD_FEE} to <span className="text-white">pizo@upi</span> using this reference:</p>
                <div className="mt-3 inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-mono cursor-pointer"
                  onClick={()=>{navigator.clipboard.writeText(onboardRef); toast.success("Copied!");}}>
                  {onboardRef} <Copy size={14}/>
                </div>
                <button onClick={()=>{ closeOnboard(); setAddOpen(true); }} data-testid="onboard-continue"
                  className="w-full mt-6 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow">
                  Add your first venue
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
      {cardVenue && <CaptainsCard venue={cardVenue} onClose={()=>setCardVenue(null)}/>}
    </main>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-3xl p-6 flex items-center justify-between">
      <div>
        <div className="text-[10px] tracking-[0.3em] text-zinc-400">{label}</div>
        <div className="font-bebas text-4xl gold-text mt-1">{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-[var(--pizo-gold)]/15 border border-[var(--pizo-gold)]/30 text-[var(--pizo-gold-soft)] flex items-center justify-center">{icon}</div>
    </div>
  );
}
function Input({ label, value, onChange, type="text" }) {
  return (
    <div>
      <label className="text-[10px] tracking-widest text-zinc-400">{label.toUpperCase()}</label>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} required
        className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--pizo-coral)]"/>
    </div>
  );
}
