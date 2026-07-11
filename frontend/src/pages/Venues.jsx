import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Search, MapPin, Star, Calendar, X, ArrowUpDown, ChevronLeft, ChevronRight, Heart } from "lucide-react";
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
  const [discounts, setDiscounts] = useState({});  // Map of venue_id -> discounts[]
  const [cat, setCat] = useState("all");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState("newest");
  const [q, setQ] = useState("");
  const [showDiscountedOnly, setShowDiscountedOnly] = useState(false);
  const [book, setBook] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [date, setDate] = useState(new Date(Date.now()+86400000).toISOString().slice(0,10));
  const [slot, setSlot] = useState(SLOTS[4]);
  const [numPlayers, setNumPlayers] = useState(2);
  const [coupon1, setCoupon1] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [wishlist, setWishlist] = useState(new Set());

  useEffect(() => {
    if (!book) return;
    api.get(`/venues/${book.venue_id}/availability`, { params: { date }})
      .then(r => {
        const slots = (r.data.slots || []).map(s => s.slot || s);
        setBookedSlots(r.data.slots.filter(s=>!s.available).map(s=>s.slot));
        // if current slot not in new slots, pick first
        if (slots.length && !slots.includes(slot)) setSlot(slots[0]);
      })
      .catch(()=>setBookedSlots([]));
  }, [book, date]);

  // Poll availability while booking modal is open so owner toggles reflect quickly
  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    const fetchAvail = () => {
      api.get(`/venues/${book.venue_id}/availability`, { params: { date }})
        .then(r => {
          if (cancelled) return;
          const slots = (r.data.slots || []).map(s => s.slot || s);
          setBookedSlots(r.data.slots.filter(s=>!s.available).map(s=>s.slot));
          if (slots.length && !slots.includes(slot)) setSlot(slots[0]);
        })
        .catch(()=>{ if (!cancelled) setBookedSlots([]); });
    };
    // initial fetch already done by other effect; start polling
    const iv = setInterval(fetchAvail, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [book, date, slot]);

  useEffect(() => {
    if (!book || !user) {
      setQuote(null);
      return;
    }
    const timeout = setTimeout(() => {
      setQuoteLoading(true);
      api.post('/bookings/quote', {
        venue_id: book.venue_id,
        date,
        slot,
        num_players: numPlayers,
        coupons: [coupon1].filter(Boolean),
        use_wallet: useWallet,
      })
        .then(({ data }) => setQuote(data))
        .catch(() => setQuote(null))
        .finally(() => setQuoteLoading(false));
    }, 220);
    return () => clearTimeout(timeout);
  }, [book?.venue_id, date, slot, numPlayers, coupon1, useWallet, user]);

  const load = async () => {
    const params = { sort };
    if (cat !== "all") params.category = cat;
    if (city !== "all") params.city = city;
    const { data } = await api.get("/venues", { params });
    setVenues(data);
  };

  function fireConfetti() {
    try {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const W = canvas.width = window.innerWidth;
      const H = canvas.height = window.innerHeight;
      const particles = [];
      for (let i = 0; i < 80; i++) {
        particles.push({ x: W/2, y: H/3, vx: (Math.random()-0.5)*12, vy: Math.random()*-12-4, r: Math.random()*6+2, c: `hsl(${Math.random()*360},70%,60%)`, life: 80 });
      }
      let t = 0;
      function frame() {
        t++;
        ctx.clearRect(0,0,W,H);
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.4;
          p.life -= 1;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
          ctx.fill();
        });
        if (t < 110) requestAnimationFrame(frame);
        else { ctx.clearRect(0,0,W,H); document.body.removeChild(canvas); }
      }
      requestAnimationFrame(frame);
    } catch (e) {}
  }
  const openReview = async (venue) => {
    if (!user) {
      toast.error("Please sign in to leave a review");
      return;
    }
    setReviewLoading(true);
    setReviewTarget({
      target_type: "venue",
      target_id: venue.venue_id,
      name: venue.name,
      reviews: [],
      average_rating: Number(venue.rating || 0),
      review_count: Number(venue.review_count || 0),
    });
    setReviewRating(5);
    setReviewComment("");
    try {
      const { data } = await api.get(`/reviews/venue/${venue.venue_id}`);
      setReviewTarget((prev) => prev && prev.target_id === venue.venue_id ? {
        ...prev,
        reviews: data.reviews || [],
        average_rating: data.average_rating || 0,
        review_count: data.review_count || 0,
      } : prev);
    } catch (err) {
      setReviewTarget((prev) => prev && prev.target_id === venue.venue_id ? { ...prev, reviews: [] } : prev);
    } finally {
      setReviewLoading(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewTarget || !user) return;
    setReviewSubmitting(true);
    try {
      await api.post("/reviews", {
        target_type: reviewTarget.target_type,
        target_id: reviewTarget.target_id,
        rating: reviewRating,
        comment: reviewComment,
      });
      const { data } = await api.get(`/reviews/${reviewTarget.target_type}/${reviewTarget.target_id}`);
      setReviewTarget((prev) => prev ? {
        ...prev,
        reviews: data.reviews || [],
        average_rating: data.average_rating || 0,
        review_count: data.review_count || 0,
      } : prev);
      toast.success(`Thanks for reviewing ${reviewTarget.name}`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Review failed");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const toggleWishlist = async (venue) => {
    if (!user) { setAuthOpen(true); return; }
    try {
      if (wishlist.has(venue.venue_id)) {
        await api.delete(`/wishlist/venue/${venue.venue_id}`);
        setWishlist(prev => {
          const s = new Set(prev);
          s.delete(venue.venue_id);
          return s;
        });
        toast.success(`${venue.name} removed from wishlist`);
      } else {
        await api.post(`/wishlist/venue/${venue.venue_id}`);
        setWishlist(prev => {
          const s = new Set(prev);
          s.add(venue.venue_id);
          return s;
        });
        toast.success(`${venue.name} added to wishlist`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Wishlist update failed');
    }
  };
  useEffect(() => { load(); }, [cat, city, sort]);

  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search);
      const r = qp.get('ref') || qp.get('referral');
      if (r) {
        setReferralCode(r);
        try { localStorage.setItem('pizo_referral', r); } catch (e) {}
      } else {
        const stored = localStorage.getItem('pizo_referral');
        if (stored) setReferralCode(stored);
      }
    } catch (e) {}
  }, []);

  // load wishlist for signed in users
  useEffect(() => {
    if (!user) {
      setWishlist(new Set());
      return;
    }
    api.get('/wishlist').then(r => {
      const vids = (r.data.wishlist || []).map(v => v.venue_id);
      setWishlist(new Set(vids));
    }).catch(() => setWishlist(new Set()));
  }, [user]);

  // Load discounts for all venues
  useEffect(() => {
    const loadDiscounts = async () => {
      const discMap = {};
      for (const v of venues) {
        try {
          const { data } = await api.get(`/venues/${v.venue_id}/active-discounts`);
          if (data && data.length > 0) {
            discMap[v.venue_id] = data;
          }
        } catch (e) {
          // No active discounts
        }
      }
      setDiscounts(discMap);
    };
    if (venues.length > 0) loadDiscounts();
  }, [venues]);

  const cities = useMemo(() => Array.from(new Set(venues.map(v => v.city))), [venues]);
  const activeDealCount = useMemo(() => Object.values(discounts).reduce((sum, arr) => sum + (arr?.length || 0), 0), [discounts]);
  const filtered = useMemo(() => {
    let result = venues.filter(v => v.name.toLowerCase().includes(q.toLowerCase()));
    if (showDiscountedOnly) {
      result = result.filter(v => discounts[v.venue_id] && discounts[v.venue_id].length > 0);
    }
    return result;
  }, [venues, q, showDiscountedOnly, discounts]);

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
    const payload = { venue_id: book.venue_id, date, slot, num_players: numPlayers, coupons, use_wallet: useWallet, referral_code: referralCode };
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
      // If booking used a referral or the booking record marks referred_by, show celebration
      try {
        const usedReferral = (bookingData && (bookingData.referral_code || bookingData.referred_by)) || referralCode;
        if (usedReferral) {
          fireConfetti();
          toast.success("You earned 5 coins from referral!");
        }
      } catch (e) {}
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

      {activeDealCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8 relative overflow-hidden rounded-[32px] border border-orange-400/30 bg-gradient-to-r from-[#ff5e3a]/90 via-[#ff8a3d]/90 to-[#f7b731]/90 p-5 shadow-[0_20px_80px_rgba(255,94,58,0.24)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.35),_transparent_40%)]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="text-[10px] tracking-[0.35em] text-white/80">LIMITED-TIME OFFERS</div>
              <h2 className="font-display text-2xl md:text-3xl font-black mt-2 text-white">Hot deals are live right now.</h2>
              <p className="text-sm text-white/85 mt-2">Book off-peak slots and save big. These offers are moving fast — tap below to see only the discounted venues.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowDiscountedOnly(true)} className="rounded-full bg-black/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/30">
                View hot deals
              </button>
              <button onClick={() => setShowDiscountedOnly((v) => !v)} className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                {showDiscountedOnly ? "Show all venues" : "Filter by deals"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

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
          <button onClick={()=>setShowDiscountedOnly(!showDiscountedOnly)} 
            className={`text-xs px-4 py-2 rounded-full transition ${showDiscountedOnly ? "bg-[var(--pizo-coral)] text-white coral-glow" : "glass hover:bg-white/10 text-zinc-300"}`}>
            🔥 Hot Deals Only
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
        {filtered.map((v,i) => {
          const venuDiscounts = discounts[v.venue_id] || [];
          const maxDiscount = venuDiscounts.length > 0 ? Math.max(...venuDiscounts.map(d => d.discount_pct || 0)) : 0;
          return (
          <motion.div key={v.venue_id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.05}}
            whileHover={{ y: -8, scale: 1.01 }}
            className={`group glass rounded-3xl overflow-hidden hover-lift relative ${maxDiscount > 0 ? "ring-1 ring-orange-400/30 shadow-[0_0_35px_rgba(255,94,58,0.16)]" : ""}`} data-testid={`venue-card-${v.venue_id}`}>
            {maxDiscount > 0 && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-gradient-to-r from-[var(--pizo-coral)] via-orange-500 to-amber-400 px-3 py-1.5 rounded-full text-[11px] font-black text-white shadow-lg shadow-orange-500/20">
                <span>🔥</span>
                <span>{maxDiscount}% OFF</span>
              </div>
            )}
            <VenueImages v={v}/>
            <div className="p-5">
              <div className="font-display text-xl font-bold">{v.name}</div>
              <div className="text-xs text-zinc-400 flex items-center gap-1 mt-1"><MapPin size={12}/> {v.city} • {v.address}</div>
              <p className="text-xs text-zinc-400 mt-3">{v.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {v.amenities?.slice(0,3).map((a,k)=>(<span key={k} className="px-2 py-1 rounded-full bg-white/5 text-[10px]">{a}</span>))}
              </div>
              {maxDiscount > 0 && (
                <div className="mt-4 rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500/10 to-amber-500/10 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-orange-300">Hot Deal</div>
                  <div className="text-sm font-semibold text-white">Save up to {maxDiscount}% on off-peak slots</div>
                </div>
              )}
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <span className="font-bebas text-3xl gold-text">₹{v.price_per_hour}</span>
                  <span className="text-xs text-zinc-400 ml-1">/ hr</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleWishlist(v)} aria-label="wishlist" className={`p-2 rounded-full ${wishlist.has(v.venue_id) ? 'bg-[var(--pizo-coral)] text-white' : 'bg-white/5 text-zinc-300'}`}>
                    <Heart size={16} />
                  </button>
                  <button onClick={()=>setBook(v)} className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white text-sm font-bold coral-glow transition" data-testid={`venue-book-${v.venue_id}`}>
                  Book
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Star size={14} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/>
                  <span>{Number(v.rating || 0).toFixed(1)}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400">{v.review_count ? `${v.review_count} reviews` : "Be first to review"}</span>
                </div>
                <button onClick={() => openReview(v)} className="text-xs font-semibold text-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)]">
                  Leave review
                </button>
              </div>
            </div>
          </motion.div>
          );
        })}
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
                {(book && book.slots && book.slots.length ? book.slots : SLOTS).map(s => {
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
                <div className="font-bebas text-3xl gold-text mt-1">₹{Math.round(quote?.per_player ?? Math.round(book.price_per_hour / Math.max(1, numPlayers)))}</div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] tracking-[0.3em] text-zinc-400">LIVE PRICE</div>
                  <div className="font-bebas text-4xl gold-text mt-1">₹{quote?.final_total ?? book.price_per_hour}</div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <div>Base ₹{quote?.base_price ?? book.price_per_hour}</div>
                  {quoteLoading ? <div className="mt-1 text-[11px] text-zinc-500">Checking best price...</div> : (
                    <>
                      {quote?.discount_pct > 0 ? <div className="mt-1 text-emerald-300">Save {quote.discount_pct}%</div> : <div className="mt-1">No extra discount</div>}
                      {quote?.applied_coupons?.length > 0 && <div className="mt-1 text-[11px] text-zinc-300">{quote.applied_coupons.join(', ')}</div>}
                    </>) }
                </div>
              </div>
              {quote?.savings > 0 && <div className="mt-2 text-sm text-emerald-300">You save ₹{quote.savings} with the current offer.</div>}
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
              {bookingLoading ? "Processing..." : `Confirm Booking — ₹${quote?.final_total ?? book.price_per_hour}`}
            </button>
          </motion.div>
        </div>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setReviewTarget(null)}>
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e)=>e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-6">
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">WRITE REVIEW</div>
            <h3 className="font-display text-2xl font-bold mt-2">{reviewTarget.name}</h3>
            <p className="text-sm text-zinc-400 mt-2">Share how your experience was so other players can trust this venue.</p>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Star size={14} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/>
                <span>{Number(reviewTarget.average_rating || 0).toFixed(1)}</span>
                <span className="text-zinc-500">•</span>
                <span className="text-xs text-zinc-400">{reviewTarget.review_count ? `${reviewTarget.review_count} reviews` : "Be first to review"}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {[1,2,3,4,5].map((star) => (
                <button key={star} type="button" onClick={() => setReviewRating(star)} className="text-2xl">
                  <Star className={star <= reviewRating ? "text-[var(--pizo-gold)] fill-[var(--pizo-gold)]" : "text-zinc-600"} size={24} />
                </button>
              ))}
            </div>
            <textarea value={reviewComment} onChange={(e)=>setReviewComment(e.target.value)} rows={4} placeholder="What stood out?" className="w-full mt-4 bg-black/40 border border-white/10 rounded-2xl px-3 py-3 text-sm outline-none" />
            <div className="mt-5 flex gap-2">
              <button onClick={submitReview} disabled={reviewSubmitting} className="flex-1 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold disabled:opacity-50">
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </button>
              <button onClick={()=>setReviewTarget(null)} className="px-4 py-3 rounded-full bg-white/5 text-sm">
                Cancel
              </button>
            </div>
            <div className="mt-6 max-h-56 overflow-y-auto pr-1">
              <div className="text-[10px] tracking-[0.3em] text-zinc-500">RECENT REVIEWS</div>
              {reviewLoading ? (
                <div className="text-sm text-zinc-400 py-3">Loading reviews...</div>
              ) : (reviewTarget.reviews || []).length > 0 ? (
                <div className="mt-3 space-y-3">
                  {(reviewTarget.reviews || []).map((item) => (
                    <div key={item.review_id || `${item.user_id}-${item.created_at}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-sm text-white">{item.user_name || "Guest"}</div>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map((star) => (
                            <Star key={star} size={12} className={star <= (item.rating || 0) ? "text-[var(--pizo-gold)] fill-[var(--pizo-gold)]" : "text-zinc-600"} />
                          ))}
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Just now"}</div>
                      <div className="text-sm text-zinc-300 mt-2">{item.comment || "No comment added."}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-400 py-3">No reviews yet. Be the first to share your experience.</div>
              )}
            </div>
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
