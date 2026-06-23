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
  const [authOpen, setAuthOpen] = useState(false);

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
      await api.post("/bookings", { venue_id: book.venue_id, date, slot });
      toast.success(`Booked ${book.name} on ${date}`);
      setBook(null);
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
                {SLOTS.map(s => (
                  <button key={s} onClick={()=>setSlot(s)} data-testid={`slot-${s.replace(/[: ]/g,'')}`}
                    className={`text-xs py-2.5 rounded-xl border transition ${slot===s? "bg-[var(--pizo-coral)]/20 border-[var(--pizo-coral)] text-white":"bg-white/5 border-white/10 text-zinc-400"}`}>
                    {s}
                  </button>
                ))}
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
    </main>
  );
}
