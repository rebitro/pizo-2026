import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Ticket, Play, Video, Youtube, Instagram, Plus, X, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Events() {
  const { user, checkAuth } = useAuth();
  const [events, setEvents] = useState([]);
  const [videos, setVideos] = useState([]);
  const [idx, setIdx] = useState(0);
  const [posting, setPosting] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [form, setForm] = useState({ event_id: "", title: "", url: "", platform: "youtube", thumbnail: "", description: "" });

  const canPost = user && (user.role === "owner" || user.role === "admin");
  const adminToken = localStorage.getItem("pizo_admin") || "";

  useEffect(() => { api.get("/events").then(r => setEvents(r.data)).catch(()=>{}); }, []);
  useEffect(() => { loadVideos(); }, []);
  const loadVideos = () => api.get("/event-videos").then(r => setVideos(r.data)).catch(()=>{});

  const next = () => setIdx((idx + 1) % Math.max(1, events.length));
  const prev = () => setIdx((idx - 1 + events.length) % Math.max(1, events.length));
  const current = events[idx];

  const register = async (eventId) => {
    if (!user) { toast.error("Sign in to register"); return; }
    try { await api.post(`/events/${eventId}/register`); toast.success("Registered! See you there 🏴‍☠️"); }
    catch { toast.error("Registration failed"); }
  };

  // Guest registration (non-authenticated) via modal
  const [regOpen, setRegOpen] = useState(false);
  const [regEvent, setRegEvent] = useState(null);
  const [regForm, setRegForm] = useState({ name: "", email: "", phone: "", note: "" });

  // Paid event registration form (before payment)
  const [paidRegOpen, setPaidRegOpen] = useState(false);
  const [paidRegEvent, setPaidRegEvent] = useState(null);
  const [paidRegForm, setPaidRegForm] = useState({ name: "", player_name: "", college: "", email: "", phone: "", note: "" });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState(null);

  const openDetails = (ev) => { setDetailsEvent(ev); setDetailsOpen(true); };

  const openPaidRegister = (ev) => {
    setPaidRegEvent(ev);
    setPaidRegForm({ name: user?.name || "", player_name: "", college: "", email: user?.email || "", phone: user?.phone || "", note: "" });
    setPaidRegOpen(true);
  };

  const submitPaidRegister = async () => {
    if (!paidRegEvent || !paidRegForm.name || !paidRegForm.player_name || !paidRegForm.college) {
      toast.error("Please fill all required fields");
      return;
    }
    // Close the form and proceed to payment with the registration details
    setPaidRegOpen(false);
    await createAndPay(paidRegEvent, paidRegEvent.price || 199, paidRegForm);
  };

  const openGuestRegister = (ev) => {
    setRegEvent(ev);
    setRegForm({ name: user?.name || "", email: user?.email || "", phone: "", note: "" });
    setRegOpen(true);
  };

  const submitGuestRegister = async () => {
    if (!regEvent) return;
    try {
      await api.post(`/events/${regEvent.event_id}/register-guest`, regForm);
      toast.success("Registration received. Admin will contact you.");
      setRegOpen(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "Registration failed"); }
  };

  const ensureRzp = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
    s.onload = () => resolve(); document.body.appendChild(s);
  });

  const createAndPay = async (ev, amount, regDetails = null) => {
    if (!user) { toast.error('Sign in to pay'); return; }
    try {
      const payload = { 
        amount, 
        purpose: 'event_registration', 
        purchase_payload: { 
          event_id: ev.event_id, 
          name: regDetails?.name || user.name, 
          email: regDetails?.email || user.email, 
          phone: regDetails?.phone || user.phone, 
          player_name: regDetails?.player_name || "",
          college: regDetails?.college || "",
          note: regDetails?.note || "",
          amount 
        } 
      };
      const { data } = await api.post('/payments/razorpay/order', payload);
      if (!data || !data.order_id) return toast.error('Payment failed to start');
      await ensureRzp();
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: ev.title,
        description: ev.description,
        handler: async function (resp) {
          try {
            await api.post('/payments/razorpay/verify', {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              purpose: 'event_registration',
              purchase_payload: { 
                event_id: ev.event_id, 
                name: regDetails?.name || user.name, 
                email: regDetails?.email || user.email, 
                phone: regDetails?.phone || user.phone, 
                player_name: regDetails?.player_name || "",
                college: regDetails?.college || "",
                note: regDetails?.note || "",
                amount 
              }
            });
            toast.success('Payment successful — registration confirmed');
            setDetailsOpen(false);
            // Refresh wallet balance immediately
            await checkAuth();
          } catch (e) { toast.error(e?.response?.data?.detail || 'Payment verify failed'); }
        },
        prefill: { name: regDetails?.name || user.name, email: regDetails?.email || user.email },
        theme: { color: '#f97316' },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Payment error'); }
  };

  const submitVideo = async (e) => {
    e.preventDefault();
    if (!form.url || !form.title) { toast.error("Title and URL are required"); return; }
    setPosting(true);
    try {
      await api.post("/event-videos", form, { headers: adminToken ? { "X-Admin-Token": adminToken } : {}});
      toast.success("Video added to the logbook!");
      setForm({ event_id: "", title: "", url: "", platform: "youtube", thumbnail: "", description: "" });
      setPostOpen(false);
      loadVideos();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not post");
    } finally { setPosting(false); }
  };

  const removeVideo = async (vid) => {
    if (!window.confirm("Remove this video?")) return;
    try {
      await api.delete(`/event-videos/${vid}`, { headers: adminToken ? { "X-Admin-Token": adminToken } : {}});
      toast.success("Removed");
      loadVideos();
    } catch (e) { toast.error(e?.response?.data?.detail || "Could not remove"); }
  };

  const isUpcoming = (d) => new Date(d) >= new Date();

  const platformIcon = (p) => p === "youtube" ? <Youtube size={14}/> : p === "instagram" ? <Instagram size={14}/> : <Video size={14}/>;

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="events-page">
      <div className="text-center mb-12">
        <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">THE LOGBOOK</div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-3">Pirates raid <span className="gold-text">the calendar.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">College tournaments, BGMI cups, turf showdowns, creator meetups — flip through the highlights.</p>
      </div>

      {current && (
        <div className="relative rounded-[2rem] overflow-hidden glass" data-testid="events-carousel">
          <AnimatePresence mode="wait">
            <motion.div key={current.event_id}
              initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6 }}
              className="relative aspect-[16/9] md:aspect-[21/9]">
              <img src={current.image} className="absolute inset-0 w-full h-full object-cover" alt={current.title}/>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"/>
              <div className="absolute inset-0 flex items-end md:items-center p-8 md:p-14">
                <div className="max-w-xl">
                  <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{current.category.toUpperCase()}</div>
                  <h2 className="font-display text-3xl md:text-5xl font-black mt-3">{current.title}</h2>
                  <p className="text-zinc-300 mt-4">{current.description}</p>
                  <div className="flex flex-wrap gap-4 mt-5 text-sm text-zinc-300">
                    <div className="flex items-center gap-1"><Calendar size={14}/> {current.date}</div>
                    <div className="flex items-center gap-1"><MapPin size={14}/> {current.location}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {current.highlights?.map((h,i)=>(
                      <span key={i} className="px-3 py-1.5 rounded-full glass text-xs">{h}</span>
                    ))}
                  </div>
                  {isUpcoming(current.date) && (
                    <div className="flex gap-3 mt-6">
                      <button onClick={()=>register(current.event_id)} data-testid={`event-register-${current.event_id}`}
                        className="px-6 py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow flex items-center gap-2">
                        <Ticket size={14}/> Register (Signed-in)
                      </button>
                      <button onClick={()=>openGuestRegister(current)} className="px-6 py-3 rounded-full border border-white/10 text-sm text-zinc-200">Register (Guest)</button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-strong flex items-center justify-center text-white hover:bg-white/10" data-testid="event-prev">
            <ChevronLeft size={18}/>
          </button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-strong flex items-center justify-center text-white hover:bg-white/10" data-testid="event-next">
            <ChevronRight size={18}/>
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {events.map((_,i)=>(
              <button key={i} onClick={()=>setIdx(i)} className={`h-1.5 rounded-full transition-all ${i===idx? "w-8 bg-[var(--pizo-gold)]":"w-3 bg-white/30"}`} data-testid={`carousel-dot-${i}`}/>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {events.map((e,i) => (
          <motion.button key={e.event_id} onClick={()=>openDetails(e)} whileHover={{ y: -6 }}
            className="relative rounded-3xl overflow-hidden aspect-[4/5] text-left group" data-testid={`event-tile-${i}`}>
            <img src={e.image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={e.title}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"/>
            <div className="absolute bottom-0 p-5">
              <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{e.category.toUpperCase()}</div>
              <div className="font-display text-lg font-bold mt-1">{e.title}</div>
              <div className="text-xs text-zinc-400 mt-1">{e.date}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Event Details Modal */}
      <AnimatePresence>
      {detailsOpen && detailsEvent && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setDetailsOpen(false)}>
          <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 10 }} onClick={e=>e.stopPropagation()} className="w-full max-w-4xl glass-strong rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <img src={detailsEvent.image} className="w-full h-80 object-cover rounded-2xl" alt={detailsEvent.title}/>
            </div>
            <div>
              <div className="text-[10px] tracking-widest text-zinc-400">EVENT</div>
              <h3 className="font-display text-2xl font-bold mt-1">{detailsEvent.title}</h3>
              <div className="text-xs text-zinc-400 mt-2">{detailsEvent.date} • {detailsEvent.location}</div>
              <p className="text-zinc-300 mt-4">{detailsEvent.description}</p>
              <div className="mt-6 flex gap-3">
                <button onClick={()=>{ if (!user) { toast.error('Sign in to register'); return; } openPaidRegister(detailsEvent); }} className="px-5 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold">Register & Pay ₹{detailsEvent.price || 199}</button>
                <button onClick={()=>{ if (!user) { openGuestRegister(detailsEvent); return; } openGuestRegister(detailsEvent); }} className="px-5 py-3 rounded-full border border-white/10 text-zinc-200">Register (Guest)</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Event Videos Section */}
      <section className="mt-20" data-testid="event-videos-section">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CAPTAIN'S REELS</div>
            <h2 className="font-display text-3xl md:text-5xl font-black mt-2">Highlights from the seas.</h2>
            <p className="text-zinc-400 text-sm mt-2 max-w-xl">Video drops from PIZO event coverage — posted by owners and the crew.</p>
          </div>
          {canPost && (
            <button onClick={()=>setPostOpen(true)} data-testid="post-event-video-btn"
              className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold text-sm coral-glow flex items-center gap-2">
              <Plus size={14}/> Post Video
            </button>
          )}
        </div>

        {videos.length === 0 ? (
          <div className="mt-8 text-center py-12 border border-dashed border-white/10 rounded-3xl">
            <Video className="mx-auto text-zinc-700" size={36}/>
            <div className="text-zinc-500 text-sm mt-3">No videos yet. The logbook's empty — be the first to post!</div>
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((v, i) => (
              <motion.div key={v.video_id}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 120 }}
                whileHover={{ y: -8 }}
                className="group relative glass rounded-3xl overflow-hidden hover-lift">
                <a href={v.url} target="_blank" rel="noreferrer" className="block">
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
                    {v.thumbnail ? (
                      <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={v.title}/>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        {platformIcon(v.platform)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"/>
                    {/* Play button overlay */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.6 }} whileHover={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-[var(--pizo-coral)]/90 backdrop-blur flex items-center justify-center coral-glow group-hover:scale-110 transition">
                        <Play size={24} className="text-white ml-1" fill="white"/>
                      </div>
                    </motion.div>
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur flex items-center gap-1.5 text-[10px] tracking-widest text-[var(--pizo-gold)] uppercase">
                      {platformIcon(v.platform)} {v.platform}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="font-display text-lg font-bold leading-tight line-clamp-2">{v.title}</div>
                    {v.description && <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{v.description}</p>}
                    <div className="mt-4 flex items-center justify-between text-[10px] text-zinc-500">
                      <span>By {v.posted_by_name}</span>
                      <span>{new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </a>
                {canPost && (v.posted_by === user?.user_id || user?.role === "admin" || adminToken) && (
                  <button onClick={()=>removeVideo(v.video_id)} title="Remove"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Trash2 size={14}/>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Guest Register Modal */}
      <AnimatePresence>
      {regOpen && regEvent && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setRegOpen(false)}>
          <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 10 }} onClick={e=>e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-widest text-zinc-400">REGISTER</div>
                <h3 className="font-display text-2xl font-bold mt-1">Register for {regEvent.title}</h3>
              </div>
              <button onClick={()=>setRegOpen(false)} className="text-zinc-400">✕</button>
            </div>
            <div className="mt-4 space-y-3">
              <input value={regForm.name} onChange={e=>setRegForm({...regForm,name:e.target.value})} placeholder="Full name" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <input value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})} placeholder="Email" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <input value={regForm.phone} onChange={e=>setRegForm({...regForm,phone:e.target.value})} placeholder="Phone" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <textarea value={regForm.note} onChange={e=>setRegForm({...regForm,note:e.target.value})} placeholder="Note (optional)" className="w-full bg-black/30 border border-white/10 rounded-2xl px-3 py-2 min-h-[80px]" />
              <div className="flex justify-end">
                <button onClick={submitGuestRegister} className="btn-sm bg-[var(--pizo-coral)] text-white">Submit Registration</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Paid Event Registration Form Modal */}
      <AnimatePresence>
      {paidRegOpen && paidRegEvent && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setPaidRegOpen(false)}>
          <motion.div initial={{ scale: 0.98, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.98, y: 10 }} onClick={e=>e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-widest text-[var(--pizo-gold)]">EVENT REGISTRATION</div>
                <h3 className="font-display text-2xl font-bold mt-1">{paidRegEvent.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">₹{paidRegEvent.price || 199}</p>
              </div>
              <button onClick={()=>setPaidRegOpen(false)} className="text-zinc-400">✕</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">FULL NAME *</label>
                <input value={paidRegForm.name} onChange={e=>setPaidRegForm({...paidRegForm,name:e.target.value})} placeholder="Your full name" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">PLAYER NAME / NICKNAME *</label>
                <input value={paidRegForm.player_name} onChange={e=>setPaidRegForm({...paidRegForm,player_name:e.target.value})} placeholder="e.g., ProGamer123" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">COLLEGE / SCHOOL *</label>
                <input value={paidRegForm.college} onChange={e=>setPaidRegForm({...paidRegForm,college:e.target.value})} placeholder="Your college name" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">EMAIL</label>
                <input value={paidRegForm.email} onChange={e=>setPaidRegForm({...paidRegForm,email:e.target.value})} placeholder="Email" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">PHONE</label>
                <input value={paidRegForm.phone} onChange={e=>setPaidRegForm({...paidRegForm,phone:e.target.value})} placeholder="Phone number" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs tracking-widest text-zinc-400 mb-1 block">NOTES (optional)</label>
                <textarea value={paidRegForm.note} onChange={e=>setPaidRegForm({...paidRegForm,note:e.target.value})} placeholder="Any additional info..." className="w-full bg-black/30 border border-white/10 rounded-2xl px-3 py-2 min-h-[70px]" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={()=>setPaidRegOpen(false)} className="flex-1 px-4 py-2 rounded-full border border-white/10 text-zinc-200 text-sm font-bold">Cancel</button>
                <button onClick={submitPaidRegister} className="flex-1 px-4 py-2 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold">Continue to Payment</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Post Video Modal */}
      <AnimatePresence>
      {postOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={()=>setPostOpen(false)}>
          <motion.form
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onSubmit={submitVideo} onClick={(e)=>e.stopPropagation()}
            className="w-full max-w-lg glass-strong rounded-3xl p-7 relative" data-testid="event-video-modal">
            <button type="button" onClick={()=>setPostOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-white/5"><X size={16}/></button>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-coral-soft)]">EVENT REEL</div>
            <h3 className="font-display text-2xl font-bold mt-1">Post a video</h3>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] tracking-widest text-zinc-400">TITLE</label>
                <input value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} placeholder="BGMI Cup — Finals highlight"
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] tracking-widest text-zinc-400">URL</label>
                <input value={form.url} onChange={(e)=>setForm({...form, url:e.target.value})} placeholder="https://youtube.com/watch?v=..."
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div>
                <label className="text-[10px] tracking-widest text-zinc-400">PLATFORM</label>
                <select value={form.platform} onChange={(e)=>setForm({...form, platform:e.target.value})}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                  <option value="youtube" className="bg-zinc-900">YouTube</option>
                  <option value="instagram" className="bg-zinc-900">Instagram</option>
                  <option value="other" className="bg-zinc-900">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest text-zinc-400">LINK TO EVENT (optional)</label>
                <select value={form.event_id} onChange={(e)=>setForm({...form, event_id:e.target.value})}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                  <option value="" className="bg-zinc-900">General</option>
                  {events.map(e=><option key={e.event_id} value={e.event_id} className="bg-zinc-900">{e.title}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] tracking-widest text-zinc-400">THUMBNAIL URL (optional)</label>
                <input value={form.thumbnail} onChange={(e)=>setForm({...form, thumbnail:e.target.value})} placeholder="https://i.ytimg.com/vi/..."
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] tracking-widest text-zinc-400">DESCRIPTION</label>
                <textarea value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} rows={3}
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
              </div>
            </div>
            <button type="submit" disabled={posting} data-testid="event-video-submit"
              className="w-full mt-6 py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow disabled:opacity-60">
              {posting ? "Hoisting..." : "Post Video"}
            </button>
            <p className="text-[10px] text-zinc-500 mt-3 text-center">Only verified owners and admin can post.</p>
          </motion.form>
        </motion.div>
      )}
      </AnimatePresence>
    </main>
  );
}
