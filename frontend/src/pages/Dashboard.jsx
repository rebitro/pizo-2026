import React, { useEffect, useState, useRef } from "react";
import { Navigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Trophy, Star, Anchor, Crown, Award, Gift, Sparkles, Copy, Video, Eye, Plus, Trash2, Instagram, Youtube, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { startRazorpayCheckout } from "@/lib/razorpay";
import { api } from "@/lib/api";

export default function Dashboard() {
  const { user, loading, checkAuth, setUser } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [eventRegs, setEventRegs] = useState([]);
  const [subs, setSubs] = useState([]);
  const [scratches, setScratches] = useState([]);
  const [revealed, setRevealed] = useState(null);
  const [creator, setCreator] = useState(null);
  const [chest, setChest] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef(null);

  const loadAll = () => {
    api.get("/bookings/me").then(r=>setBookings(r.data)).catch(()=>{});
    api.get("/subscriptions/me").then(r=>setSubs(r.data)).catch(()=>{});
    api.get("/scratch/me").then(r=>setScratches(r.data)).catch(()=>{});
    api.get("/creators/me").then(r => setCreator(r.data.joined ? r.data : null)).catch(()=>setCreator(null));
    api.get("/auth/me").then(r=>{ /* refresh user */ }).catch(()=>{});
    api.get('/me/event-registrations').then(r=>setEventRegs(r.data)).catch(()=>setEventRegs([]));
    api.get('/wishlist').then(r=>setWishlist(r.data.wishlist || [])).catch(()=>setWishlist([]));
  };
  useEffect(() => { if (user) loadAll(); }, [user]);
  useEffect(() => {
    if (!user) return;
    api.get('/me/chest').then(r=>setChest(r.data.items || [])).catch(()=>setChest([]));
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "owner") return <Navigate to="/owner" replace />;

  const activeSub = subs.find(s => s.status === "active");
  const count = bookings.length;
  const nextMilestone = Math.ceil((count+1)/5)*5;
  const toGo = nextMilestone - count;
  const progressPct = ((count % 5) / 5) * 100;

  const uploadProfileImage = async (file) => {
    if (!file) return;
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upload = await api.post("/uploads/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { url } = upload.data;
      const updated = await api.put("/auth/me", { picture: url });
      setUser(updated.data);
      toast.success("Profile image updated!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploadingPic(false);
    }
  };

  const triggerProfileUpload = () => {
    fileInputRef.current?.click();
  };

  const reveal = async (code) => {
    try {
      const { data } = await api.post(`/scratch/${code}/reveal`);
      setRevealed(data); loadAll();
    } catch { toast.error("Could not reveal"); }
  };

  const badges = [
    { name: "First Mate", earned: count > 0 },
    { name: "Streak x3", earned: count >= 3 },
    { name: "Crew Captain", earned: count >= 10 },
    { name: "Subscriber", earned: !!activeSub },
  ];

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="user-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.picture ? (
              <img src={user.picture} className="w-16 h-16 rounded-full ring-2 ring-[var(--pizo-gold)] object-cover" alt={user.name}/>
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--pizo-coral)]/20 ring-2 ring-[var(--pizo-gold)] flex items-center justify-center font-bebas text-2xl gold-text">{user.name?.[0] || "P"}</div>
            )}
            <button type="button" onClick={triggerProfileUpload}
              className="absolute -bottom-2 right-0 h-8 w-8 rounded-full bg-[var(--pizo-coral)] text-black flex items-center justify-center border border-white/10 shadow-lg hover:bg-[var(--pizo-gold)] transition"
              disabled={uploadingPic} data-testid="profile-upload-button">
              {uploadingPic ? "..." : "+"}
            </button>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CAPTAIN'S DECK</div>
            <h1 className="font-display text-3xl md:text-4xl font-black">Ahoy, {user.name?.split(" ")[0]}</h1>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadProfileImage(file);
              e.target.value = "";
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">Wallet</div>
          <div className="font-bebas text-2xl gold-text">₹{(user?.wallet_balance || 0)}</div>
          <AddCoinsButton user={user} checkAuth={checkAuth} loadAll={loadAll} />
        </div>
        <div className="ml-4 glass rounded-full px-4 py-2 flex items-center gap-3">
          <div className="text-sm">Refer & Earn</div>
          <div className="px-3 py-1 rounded-full bg-[var(--pizo-gold)]/10 border border-[var(--pizo-gold)]/30 text-[var(--pizo-gold-soft)] text-xs font-mono">{user?.referral_code}</div>
          <button onClick={() => { const link = `${window.location.origin}${window.location.pathname}?ref=${user?.referral_code}`; navigator.clipboard.writeText(link); toast.success('Referral link copied'); }} className="btn-sm glass">Share</button>
        </div>
        {!activeSub ? (
          <Link to="/plans" className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white font-bold text-sm coral-glow" data-testid="dashboard-upgrade-button">Activate a Pass</Link>
        ) : activeSub.plan_id !== "premium" && (
          <Link to="/plans" className="px-5 py-2.5 rounded-full glass hover:bg-white/10 text-white font-bold text-sm flex items-center gap-1" data-testid="dashboard-upgrade-premium">
            <Crown size={14}/> Upgrade to Premium
          </Link>
        )}
      </div>
      <div className="mt-6 glass rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]">MY WISHLIST</div>
            <div className="font-display text-xl mt-1">Saved venues</div>
          </div>
          <div className="text-sm text-zinc-400">{wishlist.length} saved</div>
        </div>
        <div className="mt-4">
          {wishlist.length === 0 ? <div className="text-sm text-zinc-400">No saved venues yet.</div> : (
            <div className="space-y-2">
              {wishlist.map(v => (
                <div key={v.venue_id} className="flex items-center justify-between glass-strong rounded-2xl p-3">
                  <div>
                    <div className="font-semibold">{v.name}</div>
                    <div className="text-xs text-zinc-400">{v.city} • ₹{v.price_per_hour}/hr</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={async ()=>{ try { await api.delete(`/wishlist/venue/${v.venue_id}`); toast.success('Removed'); loadAll(); } catch { toast.error('Remove failed'); } }} className="btn-sm glass">Remove</button>
                    <a href={`/venues/${v.venue_id}`} className="btn-sm px-4 py-2 rounded-full bg-[var(--pizo-coral)] text-white">View</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress to next scratch */}
      <div className="mt-8 glass rounded-3xl p-6" data-testid="scratch-progress">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]">SCRATCH PROGRESS</div>
            <div className="font-display text-xl mt-1">{toGo === 5 ? "🎉 Scratch unlocked!" : `${toGo} more booking${toGo>1?"s":""} → unlock scratch card`}</div>
          </div>
          <div className="font-bebas text-4xl gold-text">{count}/{nextMilestone}</div>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.8 }}
            className="h-full bg-gradient-to-r from-[var(--pizo-gold)] to-[var(--pizo-coral)] rounded-full"/>
        </div>
      </div>
      <div className="mt-6 glass rounded-3xl p-6">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Gift size={12}/> MY CHEST</div>
        <div className="mt-3">
          {chest.length === 0 ? <div className="text-sm text-zinc-400">No items in your chest yet.</div> : (
            <div className="space-y-2">
              {chest.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image ? <img src={item.image} alt={item.name} className="w-12 h-12 rounded object-cover" /> : <div className="w-12 h-12 rounded bg-white/5"/>}
                  <div>
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs text-zinc-400">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Link to="/merch" className="text-sm text-[var(--pizo-gold-soft)] underline">Open merch</Link>
          <Link to="/my-orders" className="text-sm text-[var(--pizo-gold-soft)] underline">My Orders</Link>
        </div>
      </div>

      {scratches.length > 0 && (
        <div className="mt-6 glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Gift size={12}/> YOUR SCRATCH CARDS</div>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {scratches.map(s => (
              <motion.div key={s.code} whileHover={{ scale: 1.03 }}
                onClick={()=>!s.revealed && !s.used && reveal(s.code)}
                className={`relative rounded-2xl p-5 aspect-[16/10] cursor-pointer flex flex-col items-center justify-center overflow-hidden ${s.used ? "opacity-40" : ""}`}
                style={{ background: s.revealed || s.used ? "linear-gradient(135deg, #D4AF37, #b8860b)" : "linear-gradient(135deg, #2a2a2a, #1a1a1a)" }}
                data-testid={`scratch-card-${s.code}`}>
                {!s.revealed && !s.used ? (
                  <>
                    <Sparkles className="text-[var(--pizo-gold)] animate-pulse" size={32}/>
                    <div className="text-xs tracking-widest text-zinc-400 mt-2">TAP TO SCRATCH</div>
                  </>
                ) : (
                  <>
                    <div className="font-bebas text-5xl text-black">{s.discount_pct}%</div>
                    <div className="text-xs font-bold text-black/80 mt-1">OFF NEXT BOOKING</div>
                    <div className="absolute bottom-2 text-[9px] font-mono text-black/60">{s.code}</div>
                    {s.used && <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-bold">USED</div>}
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        <StatCard label="BOOKINGS" value={count} icon={<Calendar/>}/>
        <StatCard label="ACTIVE PLAN" value={activeSub?.plan_name || "None"} icon={<Crown/>}/>
        <StatCard label="POINTS" value={count * 50} icon={<Star/>}/>
      </div>

      <div className="mt-6 glass rounded-3xl p-6">
        <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]">MY EVENT REGISTRATIONS</div>
        <div className="mt-4 space-y-3">
          {eventRegs.length === 0 ? <div className="text-sm text-zinc-400">No event registrations yet.</div> : (
            eventRegs.map(r => (
              <div key={r.reg_id} className="flex items-center justify-between glass-strong rounded-2xl p-4">
                <div>
                  <div className="font-display text-lg font-bold">{r.event_id}</div>
                  <div className="text-xs text-zinc-400">{r.user_name || r.guest_name} • {r.email || r.guest_email || ''}</div>
                  {r.amount && <div className="text-xs mt-2">Paid: ₹{r.amount} • Status: {r.status || r.refund_status || 'paid'}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {r.status !== 'cancelled' && r.refund_status !== 'pending' && (
                    <button onClick={async ()=>{ if (!window.confirm('Cancel registration?')) return; try { const { data } = await api.post(`/event-registrations/${r.reg_id}/cancel`); toast.success('Cancellation requested'); loadAll(); } catch (e) { toast.error(e?.response?.data?.detail || 'Cancel failed'); } }} className="btn-sm bg-amber-500/10 text-amber-300">Cancel</button>
                  )}
                  <div className="text-xs text-zinc-400">{new Date(r.created_at).toLocaleString?.() || r.created_at}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-6">
        <div className="md:col-span-2 glass rounded-3xl p-7">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]"><Calendar size={12}/> RECENT BOOKINGS</div>
          <div className="mt-5 space-y-3">
            {bookings.length === 0 && <div className="text-sm text-zinc-400">No bookings yet. <Link to="/venues" className="text-[var(--pizo-gold-soft)] underline">Find a venue</Link>.</div>}
            {bookings.slice(0,6).map(b => (
                <div key={b.booking_id} className="flex items-center justify-between glass-strong rounded-2xl p-4">
                <div>
                  <div className="font-display text-lg font-bold">{b.venue_name}</div>
                  <div className="text-xs text-zinc-400 flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={11}/>{b.date}</span>
                    <span>{b.slot}</span>
                    {b.num_players > 1 && <span>• {b.num_players}p ₹{b.per_player}/ea</span>}
                  </div>
                </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">{b.status}</span>
                    {b.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <RefundButton booking={b} onDone={loadAll} />
                        <RescheduleButton booking={b} onDone={loadAll} />
                      </div>
                    )}
                  </div>
              </div>
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

      {/* Creator Section (only if joined) */}
      {creator && <CreatorSection creator={creator} reload={loadAll}/>}

      <AnimatePresence>
      {revealed && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={()=>setRevealed(null)}>
          <motion.div initial={{scale:0.5, rotate:-10}} animate={{scale:1, rotate:0}} transition={{ type:"spring" }}
            className="glass-strong rounded-3xl p-8 max-w-sm text-center">
            <Sparkles className="mx-auto text-[var(--pizo-gold)]" size={40}/>
            <div className="font-bebas text-7xl gold-text mt-3">{revealed.discount_pct}% OFF</div>
            <div className="text-sm text-zinc-300 mt-2">Apply <span className="font-mono">{revealed.code}</span> on your next booking</div>
            <button onClick={()=>{navigator.clipboard.writeText(revealed.code); toast.success("Copied!");}} className="mt-5 px-5 py-2 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold flex items-center gap-2 mx-auto">
              <Copy size={14}/> Copy Code
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
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

function CreatorSection({ creator, reload }) {
  const [form, setForm] = useState({ url: "", title: "", platform: "instagram", thumbnail: "", views: 0 });
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const videos = creator.video_links || [];
  const totalViews = videos.reduce((s, v) => s + (Number(v.views) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.url) { toast.error("Paste your reel/video URL"); return; }
    setPosting(true);
    try {
      const r = await api.post("/creators/video2", { ...form, views: Number(form.views) || 0 });
      toast.success(`Posted! +${r.data.points_earned} engagement points`);
      setForm({ url:"", title:"", platform:"instagram", thumbnail:"", views:0 });
      setShowForm(false);
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Post failed");
    } finally { setPosting(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this video?")) return;
    try { await api.delete(`/creators/video/${id}`); toast.success("Removed"); reload(); }
    catch { toast.error("Could not remove"); }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      className="mt-10 relative overflow-hidden glass-strong rounded-3xl p-7 border border-[var(--pizo-gold)]/30"
      data-testid="dashboard-creator-section">
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-[var(--pizo-gold)]/15 blur-3xl rounded-full"/>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[var(--pizo-coral)]/10 blur-3xl rounded-full"/>

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--pizo-gold)]/20 border border-[var(--pizo-gold)]/40 flex items-center justify-center text-[var(--pizo-gold-soft)]">
            <Trophy size={18}/>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold-soft)]">CREATOR CLUB MEMBER</div>
            <div className="font-display text-2xl font-black">Your Creator Deck</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-[var(--pizo-gold)]/10 border border-[var(--pizo-gold)]/30 text-[var(--pizo-gold-soft)] text-xs font-mono">{creator.referral_code}</span>
          <button onClick={()=>{ navigator.clipboard.writeText(creator.referral_code); toast.success("Code copied!"); }}
            className="p-2 rounded-full glass hover:bg-white/10" title="Copy referral code">
            <Copy size={14}/>
          </button>
        </div>
      </div>

      {/* Analytics */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Mini l="RANK" v={creator.rank ? `#${creator.rank}` : "—"} icon={<TrendingUp size={14}/>}/>
        <Mini l="POINTS" v={creator.points || 0} icon={<Star size={14}/>}/>
        <Mini l="VIDEOS" v={videos.length} icon={<Video size={14}/>}/>
        <Mini l="TOTAL VIEWS" v={totalViews.toLocaleString()} icon={<Eye size={14}/>}/>
      </div>

      {/* Score breakdown */}
      <div className="relative mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="glass rounded-xl p-3">
          <div className="text-[9px] tracking-widest text-zinc-500">ENGAGEMENT</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, creator.engagement || 0)}%` }} transition={{ duration: 1 }}
                className="h-full bg-[var(--pizo-coral)]"/>
            </div>
            <span className="font-bebas text-lg gold-text w-8 text-right">{creator.engagement || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="text-[9px] tracking-widest text-zinc-500">CONSISTENCY</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, creator.consistency || 0)}%` }} transition={{ duration: 1, delay: 0.2 }}
                className="h-full bg-[var(--pizo-gold)]"/>
            </div>
            <span className="font-bebas text-lg gold-text w-8 text-right">{creator.consistency || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="text-[9px] tracking-widest text-zinc-500">QUALITY</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, creator.quality || 0)}%` }} transition={{ duration: 1, delay: 0.4 }}
                className="h-full bg-emerald-400"/>
            </div>
            <span className="font-bebas text-lg gold-text w-8 text-right">{creator.quality || 0}</span>
          </div>
        </div>
      </div>

      {/* Videos */}
      <div className="relative mt-6 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] text-zinc-400">YOUR REELS & VIDEOS</div>
        <button onClick={()=>setShowForm(!showForm)} data-testid="creator-post-video-btn"
          className="px-4 py-2 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white text-xs font-bold coral-glow flex items-center gap-1">
          <Plus size={14}/> {showForm ? "Cancel" : "Post Video"}
        </button>
      </div>

      <AnimatePresence>
      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          onSubmit={submit} className="mt-4 glass rounded-2xl p-5 overflow-hidden" data-testid="creator-video-form">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] tracking-widest text-zinc-400">VIDEO URL (Instagram Reel / YouTube)</label>
              <input value={form.url} onChange={(e)=>setForm({...form, url:e.target.value})} placeholder="https://..."
                className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-zinc-400">TITLE</label>
              <input value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} placeholder="Sick turf goal"
                className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-zinc-400">PLATFORM</label>
              <select value={form.platform} onChange={(e)=>setForm({...form, platform:e.target.value})}
                className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                <option value="instagram" className="bg-zinc-900">Instagram</option>
                <option value="youtube" className="bg-zinc-900">YouTube</option>
                <option value="other" className="bg-zinc-900">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-zinc-400">VIEWS</label>
              <input type="number" min="0" value={form.views} onChange={(e)=>setForm({...form, views:e.target.value})}
                className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
            </div>
            <div>
              <label className="text-[10px] tracking-widest text-zinc-400">THUMBNAIL URL (optional)</label>
              <input value={form.thumbnail} onChange={(e)=>setForm({...form, thumbnail:e.target.value})} placeholder="https://..."
                className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"/>
            </div>
          </div>
          <button type="submit" disabled={posting} data-testid="creator-video-submit"
            className="w-full md:w-auto mt-4 px-6 py-2.5 rounded-full bg-[var(--pizo-gold)]/20 border border-[var(--pizo-gold)]/40 text-[var(--pizo-gold-soft)] text-xs font-bold disabled:opacity-60">
            {posting ? "Posting..." : "Post Video • Earn Points"}
          </button>
          <p className="text-[10px] text-zinc-500 mt-2">+2 engagement points for every 1,000 views.</p>
        </motion.form>
      )}
      </AnimatePresence>

      {videos.length === 0 ? (
        <div className="mt-4 text-sm text-zinc-500 text-center py-8 border border-dashed border-white/10 rounded-2xl">
          <Video className="mx-auto text-zinc-700" size={28}/>
          <div className="mt-2">No videos yet. Drop your first reel to climb the leaderboard.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          {videos.slice().reverse().map((v, i) => (
            <motion.div key={v.video_id || i} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
              whileHover={{ y: -4 }}
              className="relative group glass-strong rounded-2xl overflow-hidden">
              <a href={v.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center overflow-hidden">
                  {v.thumbnail ? (
                    <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt={v.title}/>
                  ) : (
                    <div className="text-zinc-600">
                      {v.platform === "youtube" ? <Youtube size={42}/> : v.platform === "instagram" ? <Instagram size={42}/> : <Video size={42}/>}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/70 backdrop-blur text-[9px] tracking-widest text-[var(--pizo-gold)] uppercase">{v.platform}</div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white">
                    <span className="font-bold truncate pr-2">{v.title}</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60"><Eye size={10}/>{(v.views || 0).toLocaleString()}</span>
                  </div>
                </div>
              </a>
              {v.video_id && (
                <button onClick={()=>remove(v.video_id)} title="Remove"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Trash2 size={12}/>
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function RefundButton({ booking, onDone }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('wallet');
  const [reason, setReason] = useState('');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'upi' && (!upiId || !upiId.trim())) {
        toast.error('Enter UPI id for UPI refunds');
        setLoading(false);
        return;
      }
      await api.post(`/bookings/${booking.booking_id}/refund`, { mode, reason, upi_id: upiId });
      toast.success(mode === 'wallet' ? 'Refund credited to wallet' : 'Refund requested (UPI)');
      onDone && onDone();
      setOpen(false);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Refund failed'); }
    finally { setLoading(false); }
  };
  return (
    <div>
      <button onClick={() => setOpen(true)} className="py-1 px-2 rounded-full bg-red-500/10 text-red-200 text-xs">Refund</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold mb-2">Request Refund</h3>
            <div className="mb-2 text-xs text-zinc-400">Booking: {booking.booking_id} • {booking.venue_name}</div>
            <div className="grid gap-2">
              <label className="text-xs">Mode</label>
              <select value={mode} onChange={e=>setMode(e.target.value)} className="p-2 rounded bg-black/40">
                <option value="wallet">Wallet (instant)</option>
                <option value="upi">UPI (1-2 working days)</option>
              </select>
              {mode === 'upi' && (
                <>
                  <label className="text-xs">UPI ID</label>
                  <input value={upiId} onChange={e=>setUpiId(e.target.value)} placeholder="captain@bank"
                    className="p-2 rounded bg-black/40" />
                </>
              )}
              <label className="text-xs">Reason (optional)</label>
              <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason" className="p-2 rounded bg-black/40" />
              <div className="flex gap-2 mt-3">
                <button disabled={loading} className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">{loading? 'Submitting...':'Submit'}</button>
                <button type="button" onClick={()=>setOpen(false)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function RescheduleButton({ booking, onDone }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!date || !slot) { toast.error('Please provide date and slot'); setLoading(false); return; }
      // basic date format check YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error('Date must be YYYY-MM-DD'); setLoading(false); return; }
      const resp = await api.post(`/bookings/${booking.booking_id}/reschedule`, { date, slot });
      toast.success('Rescheduled');
      onDone && onDone();
      setOpen(false);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Reschedule failed';
      if (err?.response?.status === 409) toast.error(detail || 'Requested slot already booked');
      else if (err?.response?.status === 403) toast.error(detail || 'Reschedule not allowed');
      else toast.error(detail);
    }
    finally { setLoading(false); }
  };
  return (
    <div>
      <button onClick={()=>setOpen(true)} className="py-1 px-2 rounded-full bg-white/5 text-xs">Reschedule</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold mb-2">Reschedule Booking</h3>
            <div className="grid gap-2">
              <label className="text-xs">New Date</label>
              <input value={date} onChange={e=>setDate(e.target.value)} placeholder="YYYY-MM-DD" className="p-2 rounded bg-black/40" />
              <label className="text-xs">New Slot</label>
              <input value={slot} onChange={e=>setSlot(e.target.value)} placeholder="e.g. 18:00-19:00" className="p-2 rounded bg-black/40" />
              <div className="flex gap-2 mt-3">
                <button disabled={loading} className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">{loading? 'Submitting...':'Submit'}</button>
                <button type="button" onClick={()=>setOpen(false)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AddCoinsButton({ user, checkAuth, loadAll }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(0);
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const a = Number(amt);
    if (!a || a <= 0) return;
    setLoading(true);
    try {
      await startRazorpayCheckout({ amount: a, purpose: 'wallet_topup', name: user.name, email: user.email, description: 'Wallet top-up' });
      toast.success('Wallet topped up');
      await checkAuth(); loadAll(); setOpen(false);
    } catch (e) { const msg = e?.response?.data?.detail || e?.message || 'Top-up failed'; if (msg !== 'Payment cancelled') toast.error(msg); }
    finally { setLoading(false); }
  };
  return (
    <>
      <button onClick={()=>setOpen(true)} className="ml-3 px-4 py-2 rounded-full bg-[var(--pizo-coral)] text-white text-sm">Add Coins</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setOpen(false)}>
          <form onSubmit={submit} className="glass rounded-2xl p-6 w-full max-w-sm" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold">Top-up Wallet</h3>
            <input type="number" min="1" value={amt} onChange={e=>setAmt(e.target.value)} className="mt-3 p-2 rounded bg-black/40" placeholder="Amount (INR)" />
            <div className="flex gap-2 mt-3">
              <button disabled={loading} className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">{loading? 'Processing...':'Pay'}</button>
              <button type="button" onClick={()=>setOpen(false)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Mini({ l, v, icon }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-[9px] tracking-widest text-zinc-500 flex items-center gap-1">{icon} {l}</div>
      <div className="font-bebas text-2xl gold-text mt-1">{v}</div>
    </div>
  );
}
