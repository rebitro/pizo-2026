import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, Search, MapPin, Star, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";

const CATEGORIES = ["all","turf","gaming","billiards","pickleball"];
const SLOTS = ["6:00 AM - 7:00 AM","8:00 AM - 9:00 AM","11:00 AM - 12:00 PM","4:00 PM - 5:00 PM","6:00 PM - 7:00 PM","8:00 PM - 9:00 PM"];

export default function Venues() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [cat, setCat] = useState("all");
  const [city, setCity] = useState("all");
  const [q, setQ] = useState("");
  const [book, setBook] = useState(null);
  const [date, setDate] = useState(new Date(Date.now()+86400000).toISOString().slice(0,10));
  const [slot, setSlot] = useState(SLOTS[4]);
  const [numPlayers, setNumPlayers] = useState(2);
  const [coupon1, setCoupon1] = useState("");
  const [coupon2, setCoupon2] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (!book) return;
    api.get(`/venues/${book.venue_id}/availability`, { params: { date }})
      .then(r => setBookedSlots(r.data.slots.filter(s=>!s.available).map(s=>s.slot)))
      .catch(()=>setBookedSlots([]));
  }, [book, date]);

  const load = async () => {
    const params = {};
    if (cat !== "all") params.category = cat;
    if (city !== "all") params.city = city;
    const { data } = await api.get("/venues", { params });
    setVenues(data);
  };
  useEffect(() => { load(); }, [cat, city]);

  const cities = useMemo(() => Array.from(new Set(venues.map(v => v.city))), [venues]);
  const filtered = useMemo(() => venues.filter(v => v.name.toLowerCase().includes(q.toLowerCase())), [venues, q]);

  const confirmBooking = async () => {
    if (!user) { setAuthOpen(true); return; }
    try {
      const coupons = [coupon1, coupon2].filter(Boolean);
      const { data } = await api.post("/bookings", { venue_id: book.venue_id, date, slot, num_players: numPlayers, coupons });
      setConfirmed(data);
      toast.success(`Booked ${book.name} • ₹${data.per_player}/player`);
      setBook(null); setCoupon1(""); setCoupon2(""); setNumPlayers(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Booking failed");
    }
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="venues-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">VENUE AGGREGATION</div>
          <h1 className="font-display text-5xl md:text-7xl font-black mt-2">Drop anchor <span className="gold-text">anywhere.</span></h1>
        </div>
        <div className="flex items-center gap-2 glass rounded-full px-4 py-2">
          <Search size={14} className="text-zinc-400"/>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search venue..." className="bg-transparent text-sm outline-none w-44" data-testid="venue-search"/>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={()=>setCat(c)}
              data-testid={`category-${c}`}
              className={`text-xs tracking-widest px-4 py-2 rounded-full transition ${cat===c? "bg-[var(--pizo-coral)] text-white coral-glow":"glass hover:bg-white/10 text-zinc-300"}`}>
              {c.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 glass rounded-full px-3 py-1.5">
          <Filter size={14} className="text-zinc-400"/>
          <select value={city} onChange={(e)=>setCity(e.target.value)} className="bg-transparent text-sm outline-none pr-2" data-testid="city-filter">
            <option value="all" className="bg-zinc-900">All cities</option>
            {cities.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {filtered.map((v,i) => (
          <motion.div key={v.venue_id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.05}}
            whileHover={{ y: -8 }}
            className="group glass rounded-3xl overflow-hidden hover-lift" data-testid={`venue-card-${v.venue_id}`}>
            <div className="relative aspect-[16/11] overflow-hidden">
              <img src={v.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={v.name}/>
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] tracking-widest text-[var(--pizo-gold)]">{v.category.toUpperCase()}</div>
              {v.verified && <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 backdrop-blur text-[10px] text-emerald-200">✓ PIRATES VERIFIED</div>}
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-xs flex items-center gap-1"><Star size={12} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/> {v.rating}</div>
            </div>
            <div className="p-5">
              <div className="font-display text-xl font-bold">{v.name}</div>
              <div className="text-xs text-zinc-400 flex items-center gap-1 mt-1"><MapPin size={12}/> {v.city} • {v.address}</div>
              <p className="text-xs text-zinc-400 mt-3">{v.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {v.amenities?.slice(0,3).map((a,k)=>(<span key={k} className="px-2 py-1 rounded-full bg-white/5 text-[10px]">{a}</span>))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <span className="font-bebas text-3xl gold-text">₹{v.price_per_hour}</span>
                  <span className="text-xs text-zinc-400 ml-1">/ hr</span>
                </div>
                <button onClick={()=>setBook(v)} className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white text-sm font-bold coral-glow transition" data-testid={`venue-book-${v.venue_id}`}>
                  Book
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-zinc-400 py-20">No venues match. Try a different filter.</div>
      )}

      {book && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setBook(null)} data-testid="booking-modal">
          <motion.div initial={{ scale:0.95, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md glass-strong rounded-3xl p-7 relative" onClick={(e)=>e.stopPropagation()}>
            <button onClick={()=>setBook(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10"><X size={16}/></button>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">BOOK SLOT</div>
            <h3 className="font-display text-2xl font-bold mt-1">{book.name}</h3>
            <div className="text-xs text-zinc-400">{book.address}, {book.city}</div>
            <div className="mt-5">
              <label className="text-[10px] tracking-[0.3em] text-zinc-400">DATE</label>
              <div className="mt-2 flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3">
                <Calendar size={14} className="text-zinc-500"/>
                <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="bg-transparent py-3 text-sm w-full outline-none [color-scheme:dark]" data-testid="booking-date"/>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[10px] tracking-[0.3em] text-zinc-400">SLOT</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SLOTS.map(s => {
                  const isBooked = bookedSlots.includes(s);
                  return (
                    <button key={s} disabled={isBooked} onClick={()=>setSlot(s)} data-testid={`slot-${s.replace(/[: ]/g,'')}`}
                      className={`text-xs py-2.5 rounded-xl border transition ${isBooked ? "bg-red-500/10 border-red-500/30 text-red-300/60 line-through cursor-not-allowed" : slot===s ? "bg-[var(--pizo-coral)]/20 border-[var(--pizo-coral)] text-white" : "bg-white/5 border-white/10 text-zinc-400"}`}>
                      {isBooked ? "🔒 " : ""}{s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-[0.3em] text-zinc-400">PLAYERS (SPLIT)</label>
                <input type="number" min="1" max="20" value={numPlayers} onChange={e=>setNumPlayers(Number(e.target.value)||1)}
                  data-testid="booking-players"
                  className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div className="text-right">
                <div className="text-[10px] tracking-[0.3em] text-zinc-400">PER PLAYER</div>
                <div className="font-bebas text-3xl gold-text mt-1">₹{Math.round(book.price_per_hour/Math.max(1,numPlayers))}</div>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[10px] tracking-[0.3em] text-zinc-400">COUPONS (MAX 2) — FIRST10, LOYAL15, CR-XXXXXX, SCRATCH-XXXXXX</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={coupon1} onChange={e=>setCoupon1(e.target.value)} placeholder="Coupon 1" data-testid="coupon-1"
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none uppercase"/>
                <input value={coupon2} onChange={e=>setCoupon2(e.target.value)} placeholder="Coupon 2" data-testid="coupon-2"
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none uppercase"/>
              </div>
            </div>
            <button onClick={confirmBooking} data-testid="booking-confirm-button"
              className="w-full mt-6 py-3.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow">
              Confirm Booking — ₹{book.price_per_hour}
            </button>
          </motion.div>
        </div>
      )}

      <AuthModal open={authOpen} onClose={()=>setAuthOpen(false)}/>

      {confirmed && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur flex items-center justify-center p-4" onClick={()=>setConfirmed(null)}>
          <motion.div initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }} onClick={(e)=>e.stopPropagation()}
            className="w-full max-w-md glass-strong rounded-3xl p-7 relative text-center" data-testid="booking-confirmed">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">✓</div>
            <h3 className="font-display text-2xl font-bold mt-4">Booked!</h3>
            <p className="text-zinc-400 text-sm mt-2">{confirmed.venue_name} • {confirmed.date} • {confirmed.slot}</p>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="glass rounded-xl p-3"><div className="text-[10px] text-zinc-500">TOTAL</div><div className="font-bebas text-2xl">₹{confirmed.final_total}</div></div>
              <div className="glass rounded-xl p-3"><div className="text-[10px] text-zinc-500">PLAYERS</div><div className="font-bebas text-2xl">{confirmed.num_players}</div></div>
              <div className="glass rounded-xl p-3"><div className="text-[10px] text-zinc-500">PER PLAYER</div><div className="font-bebas text-2xl gold-text">₹{confirmed.per_player}</div></div>
            </div>
            {confirmed.discount_pct > 0 && <div className="mt-3 text-xs text-emerald-300">✓ {confirmed.discount_pct}% off via {confirmed.applied_coupons.join(", ")}</div>}
            <button onClick={()=>{
              const shareText = `🏴‍☠️ I booked ${confirmed.venue_name} on ${confirmed.date} ${confirmed.slot}. ₹${confirmed.per_player}/player. Join the crew! Ref: ${confirmed.share_token}`;
              if (navigator.share) navigator.share({ text: shareText });
              else { navigator.clipboard.writeText(shareText); toast.success("Copied! Share with crew."); }
            }} data-testid="booking-share" className="w-full mt-5 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow">Share with Crew</button>
          </motion.div>
        </div>
      )}
    </main>
  );
}
