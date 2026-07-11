import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Flame, Sparkles, Trophy, ArrowUp, ArrowDown, Award, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEFAULT_CREATOR_AVATAR = "/images/pizo-pirate-logo.jpg";

export default function CreatorClub() {
  const { user } = useAuth();
  const [creators, setCreators] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => { api.get("/creators").then(r => setCreators(r.data)).catch(()=>{}); }, []);

  const safeCreators = Array.isArray(creators) ? creators : [];
  const filtered = filter === "all" ? safeCreators : safeCreators.filter(c => c.category === filter);
  const podium = filtered.slice(0,3);
  const rest = filtered.slice(3);

  const monthly = {
    face: filtered.find(c => c.category === "face") || filtered[2] || null,
    model: filtered.find(c => c.category === "model") || filtered[3] || null,
  };

  const openReview = async (creator) => {
    if (!user) {
      toast.error("Please sign in to leave a review");
      return;
    }
    setReviewLoading(true);
    setReviewTarget({
      target_type: "creator",
      target_id: creator.creator_id,
      name: creator.name,
      reviews: [],
      average_rating: Number(creator.rating || 0),
      review_count: Number(creator.review_count || 0),
    });
    setReviewRating(5);
    setReviewComment("");
    try {
      const { data } = await api.get(`/reviews/creator/${creator.creator_id}`);
      setReviewTarget((prev) => prev && prev.target_id === creator.creator_id ? {
        ...prev,
        reviews: data.reviews || [],
        average_rating: data.average_rating || 0,
        review_count: data.review_count || 0,
      } : prev);
    } catch (err) {
      setReviewTarget((prev) => prev && prev.target_id === creator.creator_id ? { ...prev, reviews: [] } : prev);
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
      const { data: creatorsData } = await api.get("/creators");
      setCreators(creatorsData);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Review failed");
    } finally {
      setReviewSubmitting(false);
    }
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
          m.person ? (
            <motion.div key={i} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}}
              className="relative glass rounded-3xl p-7 overflow-hidden" data-testid={`reward-${m.key}`}>
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[var(--pizo-gold)]/20 blur-3xl"/>
              <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{m.icon} {m.label}</div>
              <div className="mt-5 flex items-center gap-5">
                <div className="relative">
                  <img src={m.person.avatar || DEFAULT_CREATOR_AVATAR} className="w-24 h-24 rounded-full ring-2 ring-[var(--pizo-gold)] object-cover" alt={m.person.name || "PIZO Creator"}/>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[var(--pizo-coral)] flex items-center justify-center text-xs font-bold">#{m.person.rank || 0}</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-bold">{m.person.name || "Creator"}</div>
                  <div className="text-xs text-zinc-400">{m.person.handle || "@pizo_creator"}</div>
                  <div className="flex gap-2 mt-2">
                    {m.person.badges?.map((b,k)=>(<span key={k} className="px-2 py-1 rounded-full bg-white/5 text-[10px]">{b}</span>))}
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                <Pill l="Cash" v="₹10K"/><Pill l="Free Sub" v="3 mo"/><Pill l="Merch" v="Drop"/>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <Star size={14} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/>
                  <span>{Number(m.person.rating || 0).toFixed(1)}</span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400">{m.person.review_count ? `${m.person.review_count} reviews` : "Be first to review"}</span>
                </div>
                <button onClick={() => openReview(m.person)} className="text-xs font-semibold text-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)]">
                  Leave review
                </button>
              </div>
            </motion.div>
          ) : null
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
          <motion.div key={c.creator_id || `${c.name}-${i}`} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}
            className={`relative glass rounded-3xl p-6 overflow-hidden ${i===0? "md:order-2 md:-translate-y-6 ring-1 ring-[var(--pizo-gold)]/40":""}`}>
            <div className={`absolute top-4 right-4 font-bebas text-5xl ${i===0?"text-[var(--pizo-gold)]":"text-zinc-700"}`}>#{c.rank}</div>
            <img src={c.avatar || DEFAULT_CREATOR_AVATAR} className="w-20 h-20 rounded-full ring-2 ring-white/10 object-cover" alt={c.name || "Creator"}/>
            <div className="font-display text-xl font-bold mt-4">{c.name || "Creator"}</div>
            <div className="text-xs text-zinc-400">{c.handle || "@pizo_creator"}</div>
            <p className="text-xs text-zinc-300 mt-3">{c.bio || "Fresh crew member"}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Pill l="ENG" v={c.engagement ?? 0}/><Pill l="CON" v={c.consistency ?? 0}/><Pill l="QUA" v={c.quality ?? 0}/>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-[10px] tracking-[0.3em] text-zinc-400">POINTS</div>
              <div className="font-bebas text-3xl gold-text">{c.points ?? 0}</div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <Star size={14} className="text-[var(--pizo-gold)] fill-[var(--pizo-gold)]"/>
                <span>{Number(c.rating || 0).toFixed(1)}</span>
                <span className="text-zinc-500">•</span>
                <span className="text-xs text-zinc-400">{c.review_count ? `${c.review_count} reviews` : "Be first to review"}</span>
              </div>
              <button onClick={() => openReview(c)} className="text-xs font-semibold text-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)]">
                Leave review
              </button>
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
          <motion.div key={c.creator_id || `${c.name}-${i}`} initial={{opacity:0,x:-20}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*0.05}}
            className="grid grid-cols-[60px_1fr_80px_80px_80px_100px] gap-3 px-6 py-4 items-center border-b border-white/5 hover:bg-white/[0.03] transition" data-testid={`leaderboard-row-${i}`}>
            <div className="font-bebas text-2xl text-zinc-400">#{c.rank}</div>
            <div className="flex items-center gap-3">
              <img src={c.avatar} className="w-10 h-10 rounded-full object-cover" alt={c.name}/>
              <div>
                <div className="font-semibold text-sm">{c.name || "Creator"}</div>
                <div className="text-xs text-zinc-500">{c.handle || "@pizo_creator"}</div>
              </div>
            </div>
            <div className="text-sm text-zinc-300">{c.engagement ?? 0}</div>
            <div className="text-sm text-zinc-300">{c.consistency ?? 0}</div>
            <div className="text-sm text-zinc-300">{c.quality ?? 0}</div>
            <div className="font-bebas text-2xl gold-text text-right">{c.points ?? 0}</div>
          </motion.div>
        ))}
      </div>

      {reviewTarget && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReviewTarget(null)}>
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md glass-strong rounded-3xl p-6">
            <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">WRITE REVIEW</div>
            <h3 className="font-display text-2xl font-bold mt-2">{reviewTarget.name}</h3>
            <p className="text-sm text-zinc-400 mt-2">Let others know what makes this creator stand out.</p>
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
            <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={4} placeholder="Share a quick note" className="w-full mt-4 bg-black/40 border border-white/10 rounded-2xl px-3 py-3 text-sm outline-none" />
            <div className="mt-5 flex gap-2">
              <button onClick={submitReview} disabled={reviewSubmitting} className="flex-1 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold disabled:opacity-50">
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </button>
              <button onClick={() => setReviewTarget(null)} className="px-4 py-3 rounded-full bg-white/5 text-sm">
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
      const r = await api.post('/creators/join', form);
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
