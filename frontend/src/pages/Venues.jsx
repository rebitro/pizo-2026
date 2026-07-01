import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search, MapPin, Star, Calendar, X, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const fullUrl = (u) => (u && u.startsWith("/api/") ? `${BACKEND_URL}${u}` : u);

const CATEGORIES = ["all","turf","gaming","billiards","pickleball"];
const SLOTS = ["6:00 AM - 7:00 AM","8:00 AM - 9:00 AM","11:00 AM - 12:00 PM","4:00 PM - 5:00 PM","6:00 PM - 7:00 PM","8:00 PM - 9:00 PM"];
const SORTS = [
  { v: "newest",     l: "Newest" },
  { v: "price_asc",  l: "Price: Low → High" },
  { v: "price_desc", l: "Price: High → Low" },
  { v: "rating",     l: "Top Rated" },
];

export default function Venues() {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [cat, setCat] = useState("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [book, setBook] = useState(null);
  const [date, setDate] = useState(new Date(Date.now()+86400000).toISOString().slice(0,10));
  const [slot, setSlot] = useState(SLOTS[4]);
  const [numPlayers, setNumPlayers] = useState(2);
  const [coupon1, setCoupon1] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (!book) return;
    api.get(`/venues/${book.venue_id}/availability`, { params: { date }})
      .then(r => setBookedSlots(r.data.slots.filter(s=>!s.available).map(s=>s.slot)))
      .catch(()=>setBookedSlots([]));
  }, [book, date]);

  const load = async () => {
    const params = { sort };
    if (cat !== "all") params.category = cat;
    if (city !== "all") params.city = city;
    const { data } = await api.get("/venues", { params });
    setVenues(data);
  };
  useEffect(() => { load(); }, [cat, city, sort]);

  const cities = useMemo(() => Array.from(new Set(venues.map(v => v.city))), [venues]);
  const filtered = useMemo(() => venues.filter(v => v.name.toLowerCase().includes(q.toLowerCase())), [venues, q]);

  const loadRazorpay = async () => {
    if (window.Razorpay) return true;
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  };

  const confirmBooking = async () => {
    if (!user) { setAuthOpen(true); return; }
    if (!book) return;
    setBookingLoading(true);
    try {
      const coupons = [coupon1].filter(Boolean);
      const payload = { venue_id: book.venue_id, date, slot, num_players: numPlayers, coupons, use_wallet: useWallet };
      const orderResp = await api.post("/payments/booking/order", payload);
      let bookingData;
      if (orderResp.data.amount > 0 && orderResp.data.order_id) {
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error("Payment SDK failed to load");
        bookingData = await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: orderResp.data.key_id,
            amount: orderResp.data.amount,
            currency: orderResp.data.currency,
            order_id: orderResp.data.order_id,
            name: book.name,
            description: `Booking for ${book.name}`,
            prefill: { name: user.name, email: user.email },
            theme: { color: "#D4AF37", backdrop_color: "#070707" },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
            handler: async (resp) => {
              try {
                const { data } = await api.post("/payments/razorpay/verify", {
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                  purpose: "booking",
                  booking_payload: payload,
                });
                resolve(data.booking);
              } catch (err) {
                reject(err);
              }
            },
          });
          rzp.on("payment.failed", (e) => reject(new Error(e?.error?.description || "Payment failed")));
          rzp.open();
        });
      } else {
        const r = await api.post("/bookings", payload);
        bookingData = r.data;
      }
      setConfirmed(bookingData);
      toast.success(`Booked ${book.name} • ₹${bookingData.per_player}/player`);
      setBook(null);
      setCoupon1("");
      setNumPlayers(2);
      setUseWallet(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Booking failed");
    } finally {
      setBookingLoading(false);
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
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
            <Filter size={14} className="text-zinc-400"/>
            <select value={city} onChange={(e)=>setCity(e.target.value)} className="bg-transparent text-sm outline-none pr-2" data-testid="city-filter">
              <option value="all" className="bg-zinc-900">All cities</option>
              {cities.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
            <ArrowUpDown size={14} className="text-zinc-400"/>
            <select value={sort} onChange={(e)=>setSort(e.target.value)} className="bg-transparent text-sm outline-none pr-2" data-testid="venue-sort">
              {SORTS.map(s => <option key={s.v} value={s.v} className="bg-zinc-900">{s.l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {filtered.map((v,i) => (
          <motion.div key={v.venue_id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.05}}
            whileHover={{ y: -8 }}
            className="group glass rounded-3xl overflow-hidden hover-lift" data-testid={`venue-card-${v.venue_id}`}>
            <VenueImages v={v}/>
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
              <label className="text-[10px] tracking-[0.3em] text-zinc-400">COUPON (MAX 1) — FIRST10, LOYAL15, CR-XXXXXX, SCRATCH-XXXXXX</label>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <input value={coupon1} onChange={e=>setCoupon1(e.target.value)} placeholder="Coupon code" data-testid="coupon-1"
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none uppercase"/>
              </div>
              <label className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
                <input type="checkbox" checked={useWallet} onChange={(e)=>setUseWallet(e.target.checked)} className="h-4 w-4 rounded border-white/10 bg-black/40" />
                Use wallet balance if available
              </label>
            </div>
            <button onClick={confirmBooking} disabled={bookingLoading} data-testid="booking-confirm-button"
              className="w-full mt-6 py-3.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow disabled:opacity-50 disabled:cursor-not-allowed">
              {bookingLoading ? "Processing..." : `Confirm Booking — ₹${book.price_per_hour}`}
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
            <div className="mt-4">
              <div className="text-[10px] text-zinc-500">Booking ID</div>
              <div className="font-mono text-sm text-white mt-1">{confirmed.booking_id}</div>
            </div>
            <div className="mt-4">
              <div className="text-[10px] text-zinc-500">QR Code</div>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(confirmed.booking_id)}`} alt="QR" className="mx-auto mt-2" />
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

function VenueImages({ v }) {
  const imgs = (v.images && v.images.length ? v.images : [v.image]).filter(Boolean);
  const [i, setI] = useState(0);
  const prev = (e) => { e.stopPropagation(); setI((i - 1 + imgs.length) % imgs.length); };
  const next = (e) => { e.stopPropagation(); setI((i + 1) % imgs.length); };
  return (
    <div className="relative aspect-[16/11] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={i}
          src={fullUrl(imgs[i])}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700"
          alt={v.name}
        />
      </AnimatePresence>
      <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] tracking-widest text-[var(--pizo-gold)]">{v.category?.toUpperCase()}</div>
      {v.verified && <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 backdrop-blur text-[10px] text-emerald-200">✓ PIRATES VERIFIED</div>}
      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-xs flex items-center gap-1"><Star size={12} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/> {v.rating}</div>
      {imgs.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <ChevronLeft size={14}/>
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <ChevronRight size={14}/>
          </button>
          <div className="absolute bottom-2 right-2 flex gap-1">
            {imgs.map((_, k) => (
              <span key={k} className={`h-1 rounded-full transition-all ${k===i ? "w-5 bg-[var(--pizo-gold)]" : "w-1.5 bg-white/40"}`}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
