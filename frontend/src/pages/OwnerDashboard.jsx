import React, { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { Building, IndianRupee, Users, Calendar, Plus, X, Lock, Check, Anchor, Award, Upload, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { startRazorpayCheckout } from "@/lib/razorpay";
import CaptainsCard from "@/components/CaptainsCard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const fullUrl = (u) => (u && u.startsWith("/api/") ? `${BACKEND_URL}${u}` : u);

const CATS = ["turf","gaming","billiards","pickleball","other"];
const ONBOARD_FEE = 149;

export default function OwnerDashboard() {
  const { user, loading, checkAuth } = useAuth();
  const [data, setData] = useState({ venues: [], bookings: [], revenue: 0, footfall: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardPaying, setOnboardPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name:"", category:"turf", city:"", address:"", price_per_hour:1000, description:"", amenities:"Floodlights,Parking" });
  const [images, setImages] = useState([]); // [{url, uploading?}]
  const fileRef = useRef(null);
  const [cardVenue, setCardVenue] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [badges, setBadges] = useState([]);
  const [sponsorForm, setSponsorForm] = useState({ name: "", phone: "", address: "", interest_type: "turf", other_interest: "" });
  const [editVenue, setEditVenue] = useState(null);
  const [ownerMessages, setOwnerMessages] = useState([]);
  const [messageForm, setMessageForm] = useState({ subject: "", message: "" });
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", password: "" });
  const [createdStaff, setCreatedStaff] = useState(null);
  const [deletingStaffId, setDeletingStaffId] = useState(null);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [slotPayload, setSlotPayload] = useState({ date: '', slot: '', venue: null });

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
  useEffect(() => { if (user) { fetchNotifications(); fetchBadges(); fetchOwnerMessages(); fetchStaff(); } }, [user]);

  const fetchNotifications = async () => {
    try {
      const r = await api.get("/owner/notifications");
      setNotifications(r.data || []);
    } catch (e) { console.error("notif fetch", e); }
  };

  const fetchStaff = async () => {
    try {
      const r = await api.get("/owner/staff");
      setStaffList(r.data || []);
    } catch (e) { console.error("staff fetch", e); }
  };

  const createStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name.trim()) {
      toast.error("Enter staff name");
      return;
    }
    try {
      const { data } = await api.post("/owner/staff", {
        name: staffForm.name.trim(),
        password: staffForm.password || undefined,
      });
      setCreatedStaff(data);
      setStaffForm({ name: "", password: "" });
      fetchStaff();
      toast.success("Staff account created");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Create staff failed");
    }
  };

  const deleteStaff = async (staff_id) => {
    if (!staff_id) { toast.error('Invalid staff id'); return; }
    try {
      const r = await api.delete(`/owner/staff/${staff_id}`);
      if (r?.data?.ok) {
        toast.success("Staff access removed");
        fetchStaff();
      } else {
        toast.error('Could not remove staff');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Could not remove staff");
    } finally { setDeletingStaffId(null); }
  };

  const generatePassword = () => {
    const random = Math.random().toString(36).slice(-8);
    setStaffForm((prev) => ({ ...prev, password: random }));
  };

  const fetchBadges = async () => {
    try {
      const r = await api.get("/owner/badges");
      setBadges(r.data?.badges || []);
    } catch (e) { console.error("badges", e); }
  };

  const fetchOwnerMessages = async () => {
    try {
      const r = await api.get('/owner/messages');
      setOwnerMessages(r.data || []);
    } catch (e) { console.error('owner messages', e); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      await api.post('/owner/messages', messageForm);
      toast.success('Message sent to admin');
      setMessageForm({ subject: '', message: '' });
      fetchOwnerMessages();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Send failed'); }
  };

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
      await startRazorpayCheckout({
        amount: ONBOARD_FEE,
        purpose: "owner_onboard",
        name: user.name, email: user.email,
        theme: "#FF5E3A",
        description: "Owner Onboarding (one-time)",
      });
      toast.success("Onboarded! You're a verified PIZO owner.");
      await checkAuth();
      setOnboardOpen(false);
      setAddOpen(true);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setOnboardPaying(false);
    }
  };

  const handleUpload = async (files) => {
    const f = Array.from(files || []);
    if (f.length === 0) return;
    const available = 3 - images.length;
    if (available <= 0) { toast.error("Max 3 images per venue"); return; }
    const toUpload = f.slice(0, available);
    for (const file of toUpload) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" }});
        setImages((prev) => [...prev, { url: data.url }]);
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Upload failed");
      }
    }
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    if (images.length === 0) { toast.error("Add at least 1 image (up to 3)"); return; }
    setSubmitting(true);
    try {
      const imgUrls = images.map(i => i.url);
      await api.post("/venues", {
        ...form,
        category: form.category === "other" ? (form.other_category || "other") : form.category,
        image: imgUrls[0],
        images: imgUrls,
        price_per_hour: Number(form.price_per_hour),
        amenities: form.amenities.split(",").map(s=>s.trim()).filter(Boolean),
      });
      toast.success("Venue added — live on the marketplace!");
      setAddOpen(false);
      setImages([]);
      setForm({ name:"", category:"turf", city:"", address:"", price_per_hour:1000, description:"", amenities:"Floodlights,Parking" });
      load();
    } catch (e) {
      if (e?.response?.status === 402) { setAddOpen(false); setOnboardOpen(true); return; }
      toast.error(e?.response?.data?.detail || "Failed to add venue");
    } finally { setSubmitting(false); }
  };

  const closeOnboard = () => { setOnboardOpen(false); };
  const closeAdd = () => { setAddOpen(false); };

  const deleteVenue = async (v) => {
    if (!window.confirm(`Delete "${v.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/venues/${v.venue_id}`);
      toast.success("Venue removed");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Delete failed"); }
  };

  // sponsor events
  const submitSponsor = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...sponsorForm, interest_type: sponsorForm.interest_type === 'other' ? sponsorForm.other_interest || 'other' : sponsorForm.interest_type };
      await api.post('/owner/sponsor-events', payload);
      toast.success('Sponsor request sent');
      setSponsorForm({ name: '', phone: '', address: '', interest_type: 'turf', other_interest: '' });
      fetchNotifications();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
  };

  const openEdit = (v) => setEditVenue({ ...v });

  const saveEdit = async () => {
    try {
      const body = { name: editVenue.name, price_per_hour: Number(editVenue.price_per_hour), amenities: editVenue.amenities };
      await api.put(`/owner/venues/${editVenue.venue_id}`, body);
      toast.success('Venue updated'); setEditVenue(null); load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Update failed'); }
  };

  const toggleSlotFor = (v) => {
    setSlotPayload({ date: '', slot: '', venue: v });
    setSlotFormOpen(true);
  };
  const submitSlotToggle = async (e) => {
    e.preventDefault();
    const v = slotPayload.venue;
    if (!v) return setSlotFormOpen(false);
    try {
      const r = await api.post(`/owner/venues/${v.venue_id}/slots/toggle`, { date: slotPayload.date, slot: slotPayload.slot });
      toast.success(`Slot ${r.data?.action || 'toggled'}`);
      setSlotFormOpen(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Toggle failed'); }
  };

  // chart data
  const getBookingDate = (b) => {
    const d = b.created_at || b.createdAt || b.date;
    if (!d) return null;
    try { const dt = new Date(d); if (!isNaN(dt)) return dt.toISOString().slice(0,10); } catch {};
    // fallback if already YYYY-MM-DD
    return (typeof d === 'string' && d.length>=10) ? d.slice(0,10) : null;
  };

  const last7 = Array.from({ length: 7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0,10);
    const count = data.bookings.filter(b => getBookingDate(b) === key).length;
    return { day: d.toLocaleDateString("en-US",{weekday:"short"}), bookings: count };
  });

  const categories = Array.from(new Set(data.venues.map(v=>v.category || 'uncategorized')));
  const revByCat = categories.map(cat => {
    const venueIds = data.venues.filter(v=> (v.category||'uncategorized')===cat).map(v=>v.venue_id);
    const revenue = data.bookings.filter(b=>venueIds.includes(b.venue_id)).reduce((sum,b)=>sum + (Number(b.final_total)||0), 0);
    return { name: cat, revenue };
  });

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

      

      {/* Edit venue modal */}
      {editVenue && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4" onClick={()=>setEditVenue(null)}>
          <div className="w-full max-w-lg glass rounded-2xl p-6" onClick={(e)=>e.stopPropagation()}>
            <h3 className="font-bold text-xl">Edit Venue</h3>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Input label="Name" value={editVenue.name} onChange={v=>setEditVenue({...editVenue,name:v})} />
              <Input label="Price/hr" type="number" value={editVenue.price_per_hour} onChange={v=>setEditVenue({...editVenue,price_per_hour:v})} />
              <div className="col-span-2"><Input label="Amenities (comma)" value={Array.isArray(editVenue.amenities)?editVenue.amenities.join(', '):editVenue.amenities} onChange={v=>setEditVenue({...editVenue,amenities: v.split(',').map(s=>s.trim())})} /></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={saveEdit} className="py-2 px-4 rounded-full bg-[var(--pizo-gold)]">Save</button>
              <button onClick={()=>setEditVenue(null)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {slotFormOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4" onClick={()=>setSlotFormOpen(false)}>
          <form onSubmit={submitSlotToggle} className="w-full max-w-md glass rounded-2xl p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-lg">Toggle Slot for {slotPayload.venue?.name}</h3>
            <div className="mt-3 grid gap-2">
              <label className="text-xs">Date (YYYY-MM-DD)</label>
              <input value={slotPayload.date} onChange={e=>setSlotPayload(prev=>({...prev,date:e.target.value}))} className="p-2 rounded bg-black/40" />
              <label className="text-xs">Slot label</label>
              <input value={slotPayload.slot} onChange={e=>setSlotPayload(prev=>({...prev,slot:e.target.value}))} className="p-2 rounded bg-black/40" />
              <div className="flex gap-2 mt-3">
                <button className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">Toggle</button>
                <button type="button" onClick={()=>setSlotFormOpen(false)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

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
      {badges.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {badges.map((b, i) => (
            <div key={i} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400">{b.badge}</div>
                <div className="font-bold mt-1">{b.venue_name || b.venue_id} — {b.value}</div>
              </div>
              <div className="text-[var(--pizo-gold-soft)]"><Award/></div>
            </div>
          ))}
        </div>
      )}
      {data.payout_schedule && (
        <div className="mt-4 glass rounded-2xl px-5 py-3 text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2">
          <span>💸 {data.commission_pct || 9}% PIZO commission • Net payout: <b className="text-[var(--pizo-gold-soft)]">₹{(data.net_payout||0).toLocaleString()}</b></span>
          <span className="text-zinc-500">⏱ {data.payout_schedule}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-6">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-zinc-400">STAFF ACCESS</div>
              <div className="font-bold text-lg mt-2">Create staff login credentials</div>
            </div>
            <div className="text-sm text-[var(--pizo-gold-soft)]">Staff login is available through the main auth flow.</div>
          </div>

          <form onSubmit={createStaff} className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-zinc-400">Staff name</label>
              <input
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full mt-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
                placeholder="e.g. Reception, Venue Manager"
                required
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Password (optional)</label>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 pr-28 text-sm text-white"
                  placeholder="Leave blank to generate automatically"
                />
                <button type="button" onClick={generatePassword}
                  className="absolute right-2 top-2.5 rounded-full bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">
                  Generate
                </button>
              </div>
            </div>
            <button type="submit" className="w-full py-3 rounded-full bg-[var(--pizo-gold)] text-black font-semibold">Create Staff</button>
          </form>

          {createdStaff && (
            <div className="mt-5 rounded-3xl border border-[var(--pizo-gold)]/20 bg-white/5 p-4 text-sm">
              <div className="font-semibold text-white">New staff account created</div>
              <div className="mt-3 grid gap-2 text-zinc-300 text-xs">
                <div><span className="text-zinc-400">ID:</span> <span className="text-white">{createdStaff.staff_id}</span></div>
                <div><span className="text-zinc-400">Password:</span> <span className="text-white">{createdStaff.password}</span></div>
                <div><span className="text-zinc-400">Scan token:</span> <span className="text-white">{createdStaff.scan_token}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(createdStaff.password)} className="rounded-full bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10">Copy password</button>
                <button type="button" onClick={() => navigator.clipboard.writeText(createdStaff.staff_id)} className="rounded-full bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10">Copy ID</button>
              </div>
            </div>
          )}

          {staffList.length > 0 && (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Active staff</div>
              <div className="space-y-3">
                {staffList.map((staff) => (
                  <div key={staff.staff_id} className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{staff.name || staff.staff_id}</div>
                        <div className="text-zinc-500 text-[11px]">{staff.staff_id}</div>
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">Staff</span>
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-400">Scan token: {staff.scan_token}</div>
                    <button type="button" onClick={() => deleteStaff(staff.staff_id)} disabled={deletingStaffId===staff.staff_id}
                      className={`mt-3 rounded-full px-3 py-2 text-xs ${deletingStaffId===staff.staff_id ? 'bg-white/5 text-zinc-400' : 'bg-red-500/10 text-red-200 hover:bg-red-500/15'}`}>
                      {deletingStaffId===staff.staff_id ? 'Removing...' : 'Remove access'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
                  <div className="mt-3 flex gap-2">
                    <button onClick={()=>setCardVenue(v)} data-testid={`captains-card-${v.venue_id}`}
                      className="flex-1 py-2 rounded-full bg-[var(--pizo-gold)]/15 border border-[var(--pizo-gold)]/40 text-[var(--pizo-gold-soft)] text-xs font-bold flex items-center justify-center gap-1">
                      <Award size={12}/> Captain's Card
                    </button>
                    <button onClick={()=>openEdit(v)} className="py-2 px-3 rounded-full bg-white/5 text-sm">Edit</button>
                    <button onClick={()=>toggleSlotFor(v)} className="py-2 px-3 rounded-full bg-white/5 text-sm">Toggle Slot</button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeAdd}>
          <motion.form onSubmit={submit} initial={{ scale:0.95, y:20 }} animate={{ scale:1, y:0 }}
            onClick={(e)=>e.stopPropagation()} className="w-full max-w-xl glass-strong rounded-3xl p-7 relative max-h-[90vh] overflow-y-auto" data-testid="add-venue-modal">
            <button type="button" onClick={closeAdd} className="absolute top-4 right-4 p-2 rounded-full bg-white/5 z-10"><X size={16}/></button>
            <h3 className="font-display text-2xl font-bold">Add a Venue</h3>
            <p className="text-xs text-zinc-400 mt-1">Upload up to 3 photos of your venue — first one becomes the cover.</p>

            {/* Image uploader */}
            <div className="mt-5">
              <label className="text-[10px] tracking-widest text-zinc-400">PHOTOS (UP TO 3)</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                    <img src={fullUrl(img.url)} className="w-full h-full object-cover" alt={`upload-${i}`}/>
                    {i === 0 && <span className="absolute top-1 left-1 px-2 py-0.5 rounded-full bg-[var(--pizo-gold)] text-black text-[9px] font-bold">COVER</span>}
                    <button type="button" onClick={()=>removeImage(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center">
                      <X size={12}/>
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button type="button" onClick={()=>fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-[var(--pizo-gold)] flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-[var(--pizo-gold-soft)] transition"
                    data-testid="venue-image-upload-btn">
                    <ImagePlus size={20}/>
                    <span className="text-[10px] tracking-widest">ADD PHOTO</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e)=>{ handleUpload(e.target.files); e.target.value = ""; }} data-testid="venue-image-input"/>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <Input label="Name" value={form.name} onChange={v=>setForm({...form,name:v})}/>
              <div>
                <label className="text-[10px] tracking-widest text-zinc-400">CATEGORY</label>
                <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                  {CATS.map(c=><option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                </select>
                {form.category === 'other' && (
                  <Input label="Other category" value={form.other_category || ''} onChange={v=>setForm({...form,other_category:v})} />
                )}
              </div>
              <Input label="City" value={form.city} onChange={v=>setForm({...form,city:v})}/>
              <Input label="Price/hr" type="number" value={form.price_per_hour} onChange={v=>setForm({...form,price_per_hour:v})}/>
              <div className="col-span-2"><Input label="Address" value={form.address} onChange={v=>setForm({...form,address:v})}/></div>
              <div className="col-span-2"><Input label="Amenities (comma)" value={form.amenities} onChange={v=>setForm({...form,amenities:v})}/></div>
              <div className="col-span-2"><Input label="Description" value={form.description} onChange={v=>setForm({...form,description:v})}/></div>
            </div>
            <button type="submit" disabled={submitting} className="w-full mt-6 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow disabled:opacity-60" data-testid="add-venue-submit">
              {submitting ? "Hoisting..." : "Add to Fleet"}
            </button>
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

            <div className="mt-5 glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-widest text-zinc-400">ONE-TIME FEE</div>
                  <div className="font-bebas text-5xl gold-text">₹{ONBOARD_FEE}</div>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <div>Powered by <span className="text-white">Razorpay</span></div>
                  <div className="mt-1">UPI • Card • Netbanking</div>
                </div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> List unlimited venues with up to 3 photos each</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Venues go live instantly on the marketplace</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Footfall & revenue analytics</li>
              <li className="flex items-start gap-2"><Check size={14} className="text-[var(--pizo-gold)] mt-0.5"/> Pirates Verified badge after first 10 bookings</li>
            </ul>
            <button onClick={payOnboard} disabled={onboardPaying} data-testid="onboard-pay-button"
              className="w-full mt-6 py-3.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow disabled:opacity-60 flex items-center justify-center gap-2">
              <Anchor size={14}/> {onboardPaying ? "Opening Razorpay..." : `Pay ₹${ONBOARD_FEE} & Activate`}
            </button>
            <p className="text-[10px] text-zinc-500 mt-3 text-center">Secure checkout via Razorpay. Test mode active.</p>
          </motion.div>
        </div>
      )}
      {cardVenue && <CaptainsCard venue={cardVenue} onClose={()=>setCardVenue(null)}/>}
      {/* Sponsor events + Notifications + Messages (moved to bottom) */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="glass rounded-3xl p-6">
          <div className="text-[10px] tracking-[0.3em] text-zinc-400 mb-4">SPONSOR EVENTS</div>
          <form onSubmit={submitSponsor} className="space-y-3">
            <Input label="Name" value={sponsorForm.name} onChange={v=>setSponsorForm({...sponsorForm,name:v})} />
            <Input label="Phone" value={sponsorForm.phone} onChange={v=>setSponsorForm({...sponsorForm,phone:v})} />
            <Input label="Address" value={sponsorForm.address} onChange={v=>setSponsorForm({...sponsorForm,address:v})} />
            <div>
              <label className="text-[10px] tracking-widest text-zinc-400">INTEREST TYPE</label>
              <select value={sponsorForm.interest_type} onChange={e=>setSponsorForm({...sponsorForm,interest_type:e.target.value})} className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm">
                {CATS.map(c=> <option key={c} value={c}>{c}</option>)}
              </select>
              {sponsorForm.interest_type === 'other' && (
                <Input label="Other interest" value={sponsorForm.other_interest} onChange={v=>setSponsorForm({...sponsorForm,other_interest:v})} />
              )}
            </div>
            <button type="submit" className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">Send Request</button>
          </form>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] tracking-[0.3em] text-zinc-400">NOTIFICATIONS</div>
            <button onClick={fetchNotifications} className="text-xs text-zinc-400">Refresh</button>
          </div>
          {notifications.length === 0 ? <div className="text-sm text-zinc-400">No notifications</div> : (
            <ul className="space-y-2">
              {notifications.map((n, i) => (
                <li key={i} className="p-3 rounded-xl bg-black/30 text-sm">
                  <div className="text-zinc-300">{n.type || n.title || 'Notification'}</div>
                  <div className="text-xs text-zinc-400 mt-1">{n.message || n.detail || JSON.stringify(n)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="glass rounded-3xl p-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] tracking-[0.3em] text-zinc-400">MESSAGES</div>
          <button onClick={fetchOwnerMessages} className="text-xs text-zinc-400">Refresh</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <form onSubmit={sendMessage} className="space-y-3">
            <Input label="Subject" value={messageForm.subject} onChange={v=>setMessageForm({...messageForm,subject:v})} />
            <div><label className="text-[10px] tracking-widest text-zinc-400">MESSAGE</label>
              <textarea value={messageForm.message} onChange={e=>setMessageForm({...messageForm,message:e.target.value})} className="w-full mt-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm" rows={4}/>
            </div>
            <button type="submit" className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">Send to Admin</button>
          </form>
          <div>
            {ownerMessages.length === 0 ? <div className="text-sm text-zinc-400">No messages</div> : (
              <ul className="space-y-3">
                {ownerMessages.map((m,i)=> (
                  <li key={m.message_id || i} className="p-3 rounded-xl bg-black/30">
                    <div className="font-bold">{m.subject}</div>
                    <div className="text-xs text-zinc-400 mt-1">{m.message}</div>
                    {m.replies && m.replies.length > 0 && (
                      <div className="mt-2 text-sm">
                        <div className="text-zinc-400">Replies:</div>
                        {m.replies.map((r, j)=> <div key={j} className="mt-1 text-xs text-zinc-300">{r.reply}</div>)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
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
