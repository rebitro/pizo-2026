import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("pizo_admin") || "");
  const [authed, setAuthed] = useState(false);
  const [overview, setOverview] = useState(null);

  // states for each entity
  const [venues, setVenues] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [merch, setMerch] = useState([]);
  const [plans, setPlans] = useState([]);
  const [events, setEvents] = useState([]);
  const [creators, setCreators] = useState([]);
  const [sponsorEvents, setSponsorEvents] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [refunds, setRefunds] = useState([]);

  // form states
  const [newMerch, setNewMerch] = useState({ name:"", price:"", image:"", category:"", description:"", images: [], sizes: [], colors: [] });
  const [editMerch, setEditMerch] = useState(null);
  const addMerchImageInput = useRef(null);
  const editMerchImageInput = useRef(null);
  const MERCH_SIZE_OPTIONS = ["XS","S","M","L","XL","XXL"];
  const MERCH_COLOR_OPTIONS = ["Black","White","Gold","Navy","Red","Grey"];

  const [newPlan, setNewPlan] = useState({ plan_id:"", plan_name:"", amount:"", benefits: [] });
  const [newPlanBenefit, setNewPlanBenefit] = useState("");
  const [editPlan, setEditPlan] = useState(null);
  const [editPlanBenefit, setEditPlanBenefit] = useState("");

  const [newEvent, setNewEvent] = useState({ title:"", description:"", date:"", location:"", category:"", image:"", images: [] });
  const [editEvent, setEditEvent] = useState(null);
  const addEventImageInput = useRef(null);
  const editEventImageInput = useRef(null);

  const [newVenue, setNewVenue] = useState({ name:"", city:"", category:"", price_per_hour:"", image:"" });
  const [editVenue, setEditVenue] = useState(null);

  const [newCreator, setNewCreator] = useState({ name:"", handle:"", category:"", avatar:"" });
  const [editCreator, setEditCreator] = useState(null);

  const [tab, setTab] = useState("venues");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundModalBooking, setRefundModalBooking] = useState(null);
  const [rejectModalBooking, setRejectModalBooking] = useState(null);
  const [adminRefundOverrideOpen, setAdminRefundOverrideOpen] = useState(false);
  const [adminRefundTargetUser, setAdminRefundTargetUser] = useState(null);
  const [overrideBookingId, setOverrideBookingId] = useState("");
  const [overrideAction, setOverrideAction] = useState('approve');
  const [overrideMode, setOverrideMode] = useState('wallet');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideUpi, setOverrideUpi] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [merchOrders, setMerchOrders] = useState([]);
  const [payoutRunResult, setPayoutRunResult] = useState(null);
  const [payoutRunning, setPayoutRunning] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [showRegistrationsFor, setShowRegistrationsFor] = useState(null);
  const [regFilter, setRegFilter] = useState('all');
  const [discounts, setDiscounts] = useState([]);
  const [discountFilter, setDiscountFilter] = useState('pending');
  const [userModal, setUserModal] = useState(null);

  const verifyOwnerKyc = async (owner_id) => {
    try {
      await api.post(`/admin/owners/${owner_id}/verify-kyc`, {}, { headers: { 'X-Admin-Token': token } });
      toast.success('Owner KYC verified'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Verification failed'); }
  };

  const unverifyOwnerKyc = async (owner_id) => {
    try {
      await api.post(`/admin/owners/${owner_id}/unverify-kyc`, {}, { headers: { 'X-Admin-Token': token } });
      toast.success('Owner KYC unverified'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
  };

  const suspendOwner = async (owner_id) => {
    try {
      await api.post(`/admin/owners/${owner_id}/suspend`, {}, { headers: { 'X-Admin-Token': token } });
      toast.success('Owner suspended'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Suspend failed'); }
  };

  const unsuspendOwner = async (owner_id) => {
    try {
      await api.post(`/admin/owners/${owner_id}/unsuspend`, {}, { headers: { 'X-Admin-Token': token } });
      toast.success('Owner unsuspended'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
  };

  const setOwnerCommission = async (owner_id) => {
    const pct = window.prompt('Enter commission percentage for owner', '9');
    if (!pct) return;
    const value = Number(pct);
    if (Number.isNaN(value)) return toast.error('Enter a valid number');
    try {
      await api.post(`/admin/owners/${owner_id}/commission`, { commission_pct: value }, { headers: { 'X-Admin-Token': token } });
      toast.success('Commission updated'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Update failed'); }
  };

  const setOwnerPayoutSchedule = async (owner_id) => {
    const schedule = window.prompt('Enter payout schedule for owner', 'Every Monday');
    if (!schedule) return;
    try {
      await api.post(`/admin/owners/${owner_id}/payout-schedule`, { payout_schedule: schedule }, { headers: { 'X-Admin-Token': token } });
      toast.success('Payout schedule updated'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Update failed'); }
  };

  const runOwnerPayouts = async () => {
    setPayoutRunning(true);
    setPayoutRunResult(null);
    try {
      const { data } = await api.post('/admin/owners/payouts/run', {}, { headers: { 'X-Admin-Token': token } });
      setPayoutRunResult(data);
      toast.success(`Processed ${data.processed || 0} owner payout(s)`);
      tryAuth(token);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Payout run failed');
    } finally {
      setPayoutRunning(false);
    }
  };

  const refreshEventRegistrations = async () => {
    try {
      const { data } = await api.get('/admin/event-registrations', { headers: { 'X-Admin-Token': token } });
      setEventRegistrations(Array.isArray(data) ? data : (data?.registrations || []));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load registrations');
    }
  };

  const processEventRegistration = async (reg, action, mode = 'wallet') => {
    try {
      await api.post(`/admin/event-registrations/${reg.reg_id}/process`, { action, mode }, { headers: { 'X-Admin-Token': token } });
      await refreshEventRegistrations();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Action failed');
    }
  };

  const retryEventRegistration = async (reg) => {
    try {
      await api.post(`/admin/event-registrations/${reg.reg_id}/retry`, {}, { headers: { 'X-Admin-Token': token } });
      await refreshEventRegistrations();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Retry failed');
    }
  };

  const tryAuth = useCallback(async (t) => {
    try {
      const { data } = await api.get("/admin/overview", { headers: { "X-Admin-Token": t } });
      setOverview(data); setAuthed(true); localStorage.setItem("pizo_admin", t);

      // fetch all entities
      setVenues((await api.get("/admin/venues",{headers:{"X-Admin-Token":t}})).data);
      setContacts((await api.get("/admin/contacts",{headers:{"X-Admin-Token":t}})).data);
      const usersResp = (await api.get("/admin/users",{headers:{"X-Admin-Token":t}})).data;
      setUsers(Array.isArray(usersResp) ? usersResp : (usersResp?.users || []));
      const ownersResp = (await api.get("/admin/owners",{headers:{"X-Admin-Token":t}})).data;
      setOwners(Array.isArray(ownersResp) ? ownersResp : (ownersResp?.owners || ownersResp || []));
      setMerch((await api.get("/admin/merch",{headers:{"X-Admin-Token":t}})).data);
      setPlans((await api.get("/admin/plans",{headers:{"X-Admin-Token":t}})).data);
      setEvents((await api.get("/admin/events",{headers:{"X-Admin-Token":t}})).data);
      setCreators((await api.get("/admin/creators",{headers:{"X-Admin-Token":t}})).data);
      setSponsorEvents((await api.get("/admin/sponsor-events",{headers:{"X-Admin-Token":t}})).data || []);
      setRefunds((await api.get("/admin/refunds",{headers:{"X-Admin-Token":t}})).data.refunds || []);
      setAdminMessages((await api.get("/admin/messages",{headers:{"X-Admin-Token":t}})).data || []);
      setMerchOrders((await api.get("/admin/merch/orders",{headers:{"X-Admin-Token":t}})).data || []);
      setDiscounts((await api.get("/admin/discounts",{headers:{"X-Admin-Token":t}})).data || []);
      const regResp = (await api.get("/admin/event-registrations", { headers: { "X-Admin-Token": t } })).data;
      setEventRegistrations(Array.isArray(regResp) ? regResp : (regResp?.registrations || []));

    } catch { toast.error("Invalid token"); setAuthed(false); }
  }, []);
  useEffect(() => { if (token) tryAuth(token); }, [token, tryAuth]);

  // Helper functions (Delete)
  const deleteUser = async (id) => { await api.delete(`/admin/users/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("User deleted"); tryAuth(token); };
  const deleteOwner = async (id) => { await api.delete(`/admin/owners/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Owner deleted"); tryAuth(token); };
  const deleteMerch = async (id) => { await api.delete(`/admin/merch/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Merch deleted"); tryAuth(token); };
  const deletePlan = async (id) => { await api.delete(`/admin/plans/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Plan deleted"); tryAuth(token); };
  const deleteEvent = async (id) => { await api.delete(`/admin/events/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Event deleted"); tryAuth(token); };
  const deleteCreator = async (id) => { await api.delete(`/admin/creators/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Creator deleted"); tryAuth(token); };

  const banUser = async (user_id, reason) => {
    try {
      await api.post(`/admin/users/${user_id}/ban`, { reason }, { headers: { "X-Admin-Token": token } });
      toast.success('User banned'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Ban failed'); }
  };

  const unbanUser = async (user_id) => {
    try {
      await api.post(`/admin/users/${user_id}/unban`, {}, { headers: { "X-Admin-Token": token } });
      toast.success('User unbanned'); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Unban failed'); }
  };

  const confirmBanUser = (user_id) => {
    if (window.confirm('Ban this user? This action can be reverted.')) banUser(user_id, 'Manual ban by admin');
  };

  const confirmUnbanUser = (user_id) => {
    if (window.confirm('Unban this user?')) unbanUser(user_id);
  };

  const openRefundOverride = (user) => {
    setAdminRefundTargetUser(user); setOverrideBookingId(''); setOverrideAction('approve'); setOverrideMode('wallet'); setOverrideAmount(''); setOverrideUpi(''); setOverrideNote(''); setAdminRefundOverrideOpen(true);
  };

  const submitRefundOverride = async () => {
    if (!overrideBookingId) return toast.error('Enter booking id');
    try {
      const payload = { action: overrideAction, mode: overrideMode, amount: overrideAmount ? Number(overrideAmount) : undefined, upi_id: overrideUpi || undefined, note: overrideNote };
      await api.post(`/admin/refunds/${overrideBookingId}/override`, payload, { headers: { 'X-Admin-Token': token } });
      toast.success('Override applied'); setAdminRefundOverrideOpen(false); tryAuth(token);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Override failed'); }
  };

  // Add/Edit functions
  const toggleMerchSize = (size, targetMerch, setTargetMerch) => {
    const current = targetMerch.sizes || [];
    const next = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    setTargetMerch({ ...targetMerch, sizes: next });
  };

  const toggleMerchColor = (color, targetMerch, setTargetMerch) => {
    const current = targetMerch.colors || [];
    const next = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    setTargetMerch({ ...targetMerch, colors: next });
  };

  const uploadMerchImages = async (files, targetMerch, setTargetMerch) => {
    if (!files || files.length === 0) return;
    const uploaded = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
        if (data?.url) uploaded.push(data.url);
      } catch (e) {
        toast.error("Image upload failed");
      }
    }
    if (uploaded.length === 0) return;
    const nextImages = [...(targetMerch.images || []), ...uploaded];
    setTargetMerch({
      ...targetMerch,
      image: targetMerch.image || uploaded[0],
      images: nextImages,
    });
  };

  const addMerch = async () => {
    await api.post("/admin/merch", newMerch, { headers: { "X-Admin-Token": token } });
    toast.success("Merch added");
    setNewMerch({ name:"", price:"", image:"", category:"", description:"", images: [], sizes: [], colors: [] });
    tryAuth(token);
  };

  const updateMerch = async () => {
    await api.put(`/admin/merch/${editMerch.id}`, editMerch, { headers: { "X-Admin-Token": token } });
    toast.success("Merch updated");
    setEditMerch(null);
    tryAuth(token);
  };

  const addPlan = async () => {
    // ensure benefits is an array
    const payload = { ...newPlan, benefits: Array.isArray(newPlan.benefits) ? newPlan.benefits : (newPlan.benefits ? String(newPlan.benefits).split(",").map(s=>s.trim()).filter(Boolean) : []) };
    await api.post("/admin/plans", payload, { headers: { "X-Admin-Token": token } });
    toast.success("Plan added");
    setNewPlan({ plan_name:"", amount:"", benefits: [] });
    setNewPlanBenefit("");
    tryAuth(token);
  };

  const updatePlan = async () => {
    const payload = { ...editPlan, benefits: Array.isArray(editPlan.benefits) ? editPlan.benefits : (editPlan.benefits ? String(editPlan.benefits).split(",").map(s=>s.trim()).filter(Boolean) : []) };
    await api.put(`/admin/plans/${editPlan.plan_id}`, payload, { headers: { "X-Admin-Token": token } });
    toast.success("Plan updated");
    setEditPlan(null);
    setEditPlanBenefit("");
    tryAuth(token);
  };

  const openEditPlan = (p) => {
    setEditPlan({ ...p, benefits: Array.isArray(p.benefits) ? p.benefits : (p.benefits ? String(p.benefits).split(",").map(s=>s.trim()).filter(Boolean) : []) });
    setEditPlanBenefit("");
  };

  const addBenefitToNewPlan = () => {
    const v = (newPlanBenefit || "").trim();
    if (!v) return;
    setNewPlan({ ...newPlan, benefits: [...(newPlan.benefits || []), v] });
    setNewPlanBenefit("");
  };

  const removeBenefitFromNewPlan = (i) => {
    setNewPlan({ ...newPlan, benefits: (newPlan.benefits || []).filter((_, idx) => idx !== i) });
  };

  const addBenefitToEditPlan = () => {
    const v = (editPlanBenefit || "").trim();
    if (!v) return;
    setEditPlan({ ...editPlan, benefits: [...(editPlan.benefits || []), v] });
    setEditPlanBenefit("");
  };

  const removeBenefitFromEditPlan = (i) => {
    setEditPlan({ ...editPlan, benefits: (editPlan.benefits || []).filter((_, idx) => idx !== i) });
  };

  const addEvent = async () => { await api.post("/admin/events", newEvent, { headers: { "X-Admin-Token": token } }); toast.success("Event added"); setNewEvent({ title:"", description:"", date:"", location:"", category:"", image:"" }); tryAuth(token); };
  const updateEvent = async () => { await api.put(`/admin/events/${editEvent.event_id}`, editEvent, { headers: { "X-Admin-Token": token } }); toast.success("Event updated"); setEditEvent(null); tryAuth(token); };

  const addVenue = async () => { await api.post("/admin/venues", newVenue, { headers: { "X-Admin-Token": token } }); toast.success("Venue added"); setNewVenue({ name:"", city:"", category:"", price_per_hour:"", image:"" }); tryAuth(token); };
  const updateVenue = async () => { await api.put(`/admin/venues/${editVenue.venue_id}`, editVenue, { headers: { "X-Admin-Token": token } }); toast.success("Venue updated"); setEditVenue(null); tryAuth(token); };

  const addCreator = async () => { await api.post("/admin/creators", newCreator, { headers: { "X-Admin-Token": token } }); toast.success("Creator added"); setNewCreator({ name:"", handle:"", category:"", avatar:"" }); tryAuth(token); };
  const updateCreator = async () => { await api.put(`/admin/creators/${editCreator.creator_id}`, editCreator, { headers: { "X-Admin-Token": token } }); toast.success("Creator updated"); setEditCreator(null); tryAuth(token); };

  // Verify/Unverify Venue
  const verifyVenue = async (id) => { await api.post(`/admin/venues/${id}/verify`, {}, { headers: { "X-Admin-Token": token } }); toast.success("Venue verified"); tryAuth(token); };
  const unverifyVenue = async (id) => { await api.post(`/admin/venues/${id}/unverify`, {}, { headers: { "X-Admin-Token": token } }); toast.success("Venue unverified"); tryAuth(token); };

  if (!authed) return (
    <main className="pt-32 pb-24 px-6 max-w-md mx-auto">
      <div className="glass-strong rounded-3xl p-8">
        <Lock className="text-[var(--pizo-gold)]" size={28}/>
        <h1 className="font-display text-3xl font-black mt-3">Admin Console</h1>
        <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Admin token"
          className="w-full mt-5 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm outline-none"/>
                <button onClick={()=>tryAuth(token)} className="w-full mt-3 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow">Unlock</button>
      </div>
    </main>
  );

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
      <h1 className="font-display text-4xl font-black"><span className="gold-text">Admin</span> Console</h1>

      {/* Overview cards */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        {overview && Object.entries(overview).map(([k,v])=>(
          <div key={k} className="glass rounded-2xl p-5">
            <div className="text-[10px] tracking-widest text-zinc-400">{k.toUpperCase()}</div>
            <div className="font-bebas text-4xl gold-text mt-1">{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-8">
        {[
            ["venues","Venues"],["contacts","Contacts"],["users","Users"],["owners","Owners"],
            ["merch","Merch"],["merchorders","Merch Orders"],["plans","Plans"],["events","Events"],["creators","Creators"],
            ["refunds","Refunds"],["discounts","Off-Peak Discounts"],["sponsors","Sponsor Events"],["messages","Messages"]
        ].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={`text-xs px-4 py-2 rounded-full ${tab===v?"bg-[var(--pizo-coral)] text-white":"glass"}`}>{l}</button>
        ))}
      </div>

      {/* Venues */}
      {tab==="venues" && (
        <div className="mt-6 space-y-6">
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-zinc-400">Event registrations</div>
                <div className="text-xs text-zinc-500">Review refund state, export rows, and process approvals or retries.</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={regFilter} onChange={e=>setRegFilter(e.target.value)} className="bg-black/20 rounded px-2 py-1 text-sm">
                  <option value="all">All</option>
                  <option value="pending">Pending refunds</option>
                  <option value="refunded">Refunded</option>
                  <option value="refund_failed">Failed refunds</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={() => {
                  const rows = eventRegistrations
                    .filter(r => !showRegistrationsFor || r.event_id === showRegistrationsFor)
                    .filter(r => regFilter === 'all' ? true : ((r.refund_status || r.status || '').toLowerCase() === regFilter));
                  if (!rows.length) { toast.error('No rows to export'); return; }
                  const hdr = ['reg_id','event_id','user_id','user_name','player_name','college','email','phone','amount','status','refund_status','refund_error','created_at'];
                  const csv = [hdr.join(',')].concat(rows.map(r => hdr.map(h => '"' + String(r[h] || '').replace(/"/g, '""') + '"').join(','))).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `event_regs_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
                }} className="btn-sm bg-white/5">Export CSV</button>
              </div>
            </div>

            {eventRegistrations.length === 0 ? (
              <div className="mt-4 text-xs text-zinc-400">No registrations yet.</div>
            ) : (
              <div className="mt-4 grid gap-2">
                {eventRegistrations
                  .filter(r => !showRegistrationsFor || r.event_id === showRegistrationsFor)
                  .filter(r => regFilter === 'all' ? true : ((r.refund_status || r.status || '').toLowerCase() === regFilter))
                  .map(r => {
                    const attempts = Number(r.refund_attempts || 0);
                    const maxRetries = 3;
                    const canRetry = (r.refund_status === 'refund_failed' || r.refund_status === 'pending') && attempts < maxRetries;
                    return (
                      <div key={r.reg_id} className="glass rounded-xl p-3 flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                        <div className="flex-1">
                          <div className="text-sm font-bold cursor-pointer hover:text-[var(--pizo-coral)]" onClick={() => setUserModal(r.user_id)}>{r.user_name || r.guest_name || 'Guest'}</div>
                          <div className="text-xs text-zinc-400 mt-1">Event: {events.find(ev => ev.event_id === r.event_id)?.title || r.event_id}</div>
                          <div className="text-xs text-zinc-400 mt-1">Email: {r.guest_email || r.email || 'N/A'} • Phone: {r.phone || r.guest_phone || 'N/A'}</div>
                          {r.player_name && <div className="text-xs text-zinc-300 mt-1">🎮 Player: {r.player_name}</div>}
                          {r.college && <div className="text-xs text-zinc-300 mt-1">🎓 College: {r.college}</div>}
                          {r.note && <div className="text-xs text-zinc-300 mt-2 p-2 bg-black/30 rounded">📝 {r.note}</div>}
                          {r.refund_error && <div className="text-xs mt-2 text-red-400">Error: {r.refund_error}</div>}
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2 whitespace-nowrap">
                          <div className="text-xs text-zinc-400">{new Date(r.created_at).toLocaleString?.() || r.created_at}</div>
                          <div className="text-xs text-[var(--pizo-gold)]">₹{r.amount || 0}</div>
                          {r.refund_status === 'pending' && <div className="text-xs text-amber-300">Pending refund</div>}
                          {r.refund_status === 'refund_failed' && <div className="text-xs text-red-300">Refund failed</div>}
                          {(r.refund_status === 'pending' || r.refund_status === 'refund_failed') && (
                            <div className="text-xs text-zinc-400">Attempts: {attempts}/{maxRetries}</div>
                          )}
                          {r.refund_status === 'refund_failed' && (
                            <div className="flex flex-wrap gap-2">
                              <button disabled={!canRetry} onClick={() => retryEventRegistration(r)} className={`btn-sm text-xs ${canRetry ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-zinc-500 cursor-not-allowed'}`}>Retry</button>
                              <button onClick={async () => { if (!window.confirm('Reject refund request?')) return; await processEventRegistration(r, 'reject'); toast.success('Refund rejected'); }} className="btn-sm text-xs bg-red-500/15 text-red-300">Reject</button>
                            </div>
                          )}
                          {r.refund_status === 'pending' && (
                            <div className="flex flex-wrap gap-2">
                              <button onClick={async () => { const mode = window.prompt('Refund mode (wallet/upi/razorpay)', 'wallet'); if (!mode) return; await processEventRegistration(r, 'approve', mode); toast.success('Refund approved'); }} className="btn-sm text-xs bg-emerald-500/15 text-emerald-300">Approve</button>
                              <button onClick={async () => { if (!window.confirm('Reject refund request?')) return; await processEventRegistration(r, 'reject'); toast.success('Refund rejected'); }} className="btn-sm text-xs bg-red-500/15 text-red-300">Reject</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="glass rounded-3xl p-5">
            <div className="text-sm text-zinc-400 mb-4">Venue management</div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Name</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="Venue name" value={newVenue.name} onChange={e=>setNewVenue({...newVenue,name:e.target.value})}/>
              </label>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">City</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="City" value={newVenue.city} onChange={e=>setNewVenue({...newVenue,city:e.target.value})}/>
              </label>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Category</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="Category" value={newVenue.category} onChange={e=>setNewVenue({...newVenue,category:e.target.value})}/>
              </label>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Price / hour</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="₹" value={newVenue.price_per_hour} onChange={e=>setNewVenue({...newVenue,price_per_hour:e.target.value})}/>
              </label>
            </div>
            <label className="block text-sm text-zinc-300 mt-4">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Image</div>
              <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="Image URL" value={newVenue.image} onChange={e=>setNewVenue({...newVenue,image:e.target.value})}/>
            </label>
            <button onClick={addVenue} className="btn-sm bg-green-500/15 text-green-300 mt-4">Add venue</button>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {venues.map(v => (
                <div key={v.venue_id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{v.name}</div>
                      <div className="text-xs text-zinc-400 mt-1">{v.city} • {v.category}</div>
                    </div>
                    <div className="text-sm">₹{v.price_per_hour}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {v.verified
                      ? <button onClick={() => unverifyVenue(v.venue_id)} className="btn-sm bg-yellow-500/15 text-yellow-300">Unverify</button>
                      : <button onClick={() => verifyVenue(v.venue_id)} className="btn-sm bg-green-500/15 text-green-300">Verify</button>}
                    <button onClick={() => setEditVenue(v)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                  </div>
                </div>
              ))}
            </div>

            {editVenue && (
              <div className="space-y-2 mt-4">
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editVenue.name} onChange={e=>setEditVenue({...editVenue,name:e.target.value})}/>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editVenue.city} onChange={e=>setEditVenue({...editVenue,city:e.target.value})}/>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editVenue.category} onChange={e=>setEditVenue({...editVenue,category:e.target.value})}/>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editVenue.price_per_hour} onChange={e=>setEditVenue({...editVenue,price_per_hour:e.target.value})}/>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editVenue.image} onChange={e=>setEditVenue({...editVenue,image:e.target.value})}/>
                <button onClick={updateVenue} className="btn-sm bg-green-500/15 text-green-300">Save</button>
              </div>
            )}
          </div>

          <AnimatePresence>
            {userModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4" onClick={() => setUserModal(null)}>
                <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} className="w-full max-w-lg glass rounded-3xl p-6">
                  <h3 className="font-display text-xl font-bold">Registrations for {userModal}</h3>
                  <div className="mt-4 space-y-2">
                    {eventRegistrations.filter(r => r.user_id === userModal).map(r => (
                      <div key={r.reg_id} className="glass rounded-xl p-3">
                        <div className="font-semibold">{events.find(ev => ev.event_id === r.event_id)?.title || r.event_id}</div>
                        <div className="text-xs text-zinc-400">{r.amount ? `Paid ₹${r.amount}` : 'Free'} • {r.status || r.refund_status || 'paid'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-right"><button onClick={() => setUserModal(null)} className="btn-sm">Close</button></div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Merch */}
      {tab==="merch" && (
        <div className="mt-6 space-y-4">
          {/* Add Merch Form */}
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Name</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="Item name" value={newMerch.name} onChange={e=>setNewMerch({...newMerch,name:e.target.value})}/>
              </label>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Price</div>
                <input type="number" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="₹" value={newMerch.price} onChange={e=>setNewMerch({...newMerch,price:e.target.value})}/>
              </label>
            </div>
            <label className="block text-sm text-zinc-300">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Category</div>
              <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" placeholder="T-shirt, cap, sticker..." value={newMerch.category} onChange={e=>setNewMerch({...newMerch,category:e.target.value})}/>
            </label>
            <label className="block text-sm text-zinc-300">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Description</div>
              <textarea className="w-full bg-black/30 border border-white/10 rounded-2xl px-3 py-3 text-sm min-h-[100px]" placeholder="Write a short description" value={newMerch.description} onChange={e=>setNewMerch({...newMerch,description:e.target.value})}/>
            </label>
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Photos</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(newMerch.images || []).map((url, index) => (
                  <div key={index} className="aspect-square rounded-2xl overflow-hidden border border-white/10 relative">
                    <img src={url} alt={`merch-${index}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => setNewMerch({
                        ...newMerch,
                        images: newMerch.images.filter((_, i) => i !== index),
                        image: index === 0 ? newMerch.images[1] || "" : newMerch.image,
                      })} className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px]">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => addMerchImageInput.current?.click()} className="aspect-square rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)] transition">
                  <span className="text-xs uppercase tracking-[0.3em]">Add photos</span>
                </button>
              </div>
              <div className="text-xs text-zinc-400">Photos are uploaded immediately and displayed in a gallery. The first image becomes the primary photo.</div>
              <input ref={addMerchImageInput} type="file" accept="image/*" multiple hidden onChange={e => { uploadMerchImages(e.target.files, newMerch, setNewMerch); e.target.value = ""; }} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sizes</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MERCH_SIZE_OPTIONS.map((size) => {
                    const selected = newMerch.sizes.includes(size);
                    return (
                      <label key={size} className={`cursor-pointer rounded-2xl border px-3 py-2 text-sm flex items-center gap-2 ${selected ? "border-[var(--pizo-gold)] bg-[var(--pizo-gold)]/10 text-[var(--pizo-gold)]" : "border-white/10 text-zinc-300"}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleMerchSize(size, newMerch, setNewMerch)} className="h-4 w-4 rounded border-white/10 bg-black/50 accent-[var(--pizo-gold)]" />
                        <span>{size}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Colors</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MERCH_COLOR_OPTIONS.map((color) => {
                    const selected = newMerch.colors.includes(color);
                    return (
                      <label key={color} className={`cursor-pointer rounded-2xl border px-3 py-2 text-sm flex items-center gap-2 ${selected ? "border-[var(--pizo-gold)] bg-[var(--pizo-gold)]/10 text-[var(--pizo-gold)]" : "border-white/10 text-zinc-300"}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleMerchColor(color, newMerch, setNewMerch)} className="h-4 w-4 rounded border-white/10 bg-black/50 accent-[var(--pizo-gold)]" />
                        <span>{color}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <button onClick={addMerch} className="btn-sm bg-green-500/15 text-green-300">Add Merch</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {merch.map(m=>(
              <div key={m.id} className="glass rounded-2xl p-5 flex justify-between">
                <div><b>{m.name}</b> <span className="text-xs text-zinc-400">₹{m.price}</span></div>
                <div className="flex gap-2">
                  <button onClick={()=>setEditMerch(m)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                  <button onClick={()=>deleteMerch(m.id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {editMerch && (
            <div className="space-y-4 mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm text-zinc-300">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Name</div>
                  <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editMerch.name} onChange={e=>setEditMerch({...editMerch,name:e.target.value})}/>
                </label>
                <label className="block text-sm text-zinc-300">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Price</div>
                  <input type="number" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editMerch.price} onChange={e=>setEditMerch({...editMerch,price:e.target.value})}/>
                </label>
              </div>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Category</div>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-3 text-sm" value={editMerch.category} onChange={e=>setEditMerch({...editMerch,category:e.target.value})}/>
              </label>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Description</div>
                <textarea className="w-full bg-black/30 border border-white/10 rounded-2xl px-3 py-3 text-sm min-h-[100px]" value={editMerch.description || ""} onChange={e=>setEditMerch({...editMerch,description:e.target.value})}/>
              </label>
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Photos</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(editMerch.images || []).map((url, index) => (
                    <div key={index} className="aspect-square rounded-2xl overflow-hidden border border-white/10 relative">
                      <img src={url} alt={`edit-merch-${index}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setEditMerch({
                          ...editMerch,
                          images: editMerch.images.filter((_, i) => i !== index),
                          image: index === 0 ? editMerch.images[1] || "" : editMerch.image,
                        })} className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px]">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => editMerchImageInput.current?.click()} className="aspect-square rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)] transition">
                    <span className="text-xs uppercase tracking-[0.3em]">Add photos</span>
                  </button>
                </div>
                <div className="text-xs text-zinc-400">Photos are uploaded immediately and displayed in a gallery. The first image becomes the primary photo.</div>
                <input ref={editMerchImageInput} type="file" accept="image/*" multiple hidden onChange={e => { uploadMerchImages(e.target.files, editMerch, setEditMerch); e.target.value = ""; }} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Sizes</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MERCH_SIZE_OPTIONS.map((size) => {
                      const selected = editMerch.sizes?.includes(size);
                      return (
                        <label key={size} className={`cursor-pointer rounded-2xl border px-3 py-2 text-sm flex items-center gap-2 ${selected ? "border-[var(--pizo-gold)] bg-[var(--pizo-gold)]/10 text-[var(--pizo-gold)]" : "border-white/10 text-zinc-300"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleMerchSize(size, editMerch, setEditMerch)} className="h-4 w-4 rounded border-white/10 bg-black/50 accent-[var(--pizo-gold)]" />
                          <span>{size}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Colors</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MERCH_COLOR_OPTIONS.map((color) => {
                      const selected = editMerch.colors?.includes(color);
                      return (
                        <label key={color} className={`cursor-pointer rounded-2xl border px-3 py-2 text-sm flex items-center gap-2 ${selected ? "border-[var(--pizo-gold)] bg-[var(--pizo-gold)]/10 text-[var(--pizo-gold)]" : "border-white/10 text-zinc-300"}`}>
                          <input type="checkbox" checked={selected} onChange={() => toggleMerchColor(color, editMerch, setEditMerch)} className="h-4 w-4 rounded border-white/10 bg-black/50 accent-[var(--pizo-gold)]" />
                          <span>{color}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button onClick={updateMerch} className="btn-sm bg-green-500/15 text-green-300">Save</button>
            </div>
          )}
        </div>
      )}

      {/* Users */}
      {tab==="users" && (
        <div className="mt-6 space-y-4">
          {users.length === 0 ? <div className="text-sm text-zinc-400">No users found.</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {users.map(u=> (
                <div key={u.user_id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{u.name || u.email}</div>
                      <div className="text-xs text-zinc-400 mt-1">{u.email} • {u.user_id}</div>
                    </div>
                    <div className="text-xs text-zinc-400">{u.role || 'user'}</div>
                  </div>
                  <div className="text-sm mt-3">Wallet: ₹{u.wallet_balance || 0}</div>
                  {u.banned && <div className="text-xs text-red-400 mt-1">BANNED • {u.banned_reason || ''}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!u.banned ? (
                      <button onClick={()=>confirmBanUser(u.user_id)} className="btn-sm bg-red-500/15 text-red-300">Ban</button>
                    ) : (
                      <button onClick={()=>confirmUnbanUser(u.user_id)} className="btn-sm bg-green-500/15 text-green-300">Unban</button>
                    )}
                    <button onClick={()=>openRefundOverride(u)} className="btn-sm bg-blue-500/15 text-blue-300">Refund Override</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Owners */}
      {tab==="owners" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-400">Run a manual owner payout cycle for the current schedule.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={runOwnerPayouts} disabled={payoutRunning} className="btn-sm bg-violet-500/15 text-violet-300">
                {payoutRunning ? 'Running payouts…' : 'Run Owner Payouts'}
              </button>
              {payoutRunResult && (
                <div className="text-xs text-zinc-400">Last run: {payoutRunResult.processed || 0} payout(s)</div>
              )}
            </div>
          </div>
          {owners.length === 0 ? <div className="text-sm text-zinc-400">No owners found.</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {owners.map(o=> (
                <div key={o.user_id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{o.name || o.email}</div>
                      <div className="text-xs text-zinc-400 mt-1">{o.email} • {o.user_id}</div>
                    </div>
                    <div className="text-xs text-zinc-400">{o.role || 'owner'}</div>
                  </div>
                  <div className="text-sm mt-3">KYC: {o.kyc_verified ? 'Verified' : 'Pending'}</div>
                  <div className="text-sm mt-1">Status: {o.suspended ? 'Suspended' : 'Active'}</div>
                  <div className="text-sm mt-1">Commission: {o.commission_pct ?? 9}%</div>
                  <div className="text-sm mt-1">Payout: {o.payout_schedule || 'Default weekly'}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.kyc_verified ? (
                      <button onClick={()=>unverifyOwnerKyc(o.user_id)} className="btn-sm bg-yellow-500/15 text-yellow-300">Unverify KYC</button>
                    ) : (
                      <button onClick={()=>verifyOwnerKyc(o.user_id)} className="btn-sm bg-green-500/15 text-green-300">Verify KYC</button>
                    )}
                    {o.suspended ? (
                      <button onClick={()=>unsuspendOwner(o.user_id)} className="btn-sm bg-green-500/15 text-green-300">Unsuspend</button>
                    ) : (
                      <button onClick={()=>suspendOwner(o.user_id)} className="btn-sm bg-red-500/15 text-red-300">Suspend</button>
                    )}
                    <button onClick={()=>setOwnerCommission(o.user_id)} className="btn-sm bg-blue-500/15 text-blue-300">Set Commission</button>
                    <button onClick={()=>setOwnerPayoutSchedule(o.user_id)} className="btn-sm bg-slate-500/15 text-slate-200">Set Payout</button>
                    <button onClick={()=>deleteOwner(o.user_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Merch Orders */}
      {tab==="merchorders" && (
        <div className="mt-6 space-y-4">
          {merchOrders.map(order => (
            <div key={order.order_id} className="glass rounded-2xl p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-bold">{order.order_id}</div>
                  <div className="text-xs text-zinc-400">{order.email} • {order.phone}</div>
                  <div className="text-sm mt-1">{order.items?.map(i => `${i.name} × ${i.quantity}`).join(", ")}</div>
                  {order.refund_status && order.refund_status !== 'none' && (
                    <div className="text-xs mt-2 text-amber-300">
                      Refund: {order.refund_status}
                      {order.refund_mode ? ` • ${order.refund_mode}` : ''}
                      {order.upi_id ? ` • UPI: ${order.upi_id}` : ''}
                      {order.refund_amount ? ` • Amount: ₹${order.refund_amount}` : ''}
                      {order.refund_requested_reason ? ` • Reason: ${order.refund_requested_reason}` : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">Status: <span className="capitalize">{order.status}</span></div>
                  <select value={order.status} onChange={async (e) => { try { const { data } = await api.put(`/admin/merch/orders/${order.order_id}`, { status: e.target.value }, { headers: { "X-Admin-Token": token } }); setMerchOrders(prev => prev.map(o => o.order_id === order.order_id ? data : o)); toast.success("Order updated"); } catch (err) { toast.error(err?.response?.data?.detail || "Update failed"); } }} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm">
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plans */}
      {tab==="plans" && (
        <div className="mt-6 space-y-4">
          {/* Add Plan Form */}
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <input placeholder="Plan ID (slug)" value={newPlan.plan_id} onChange={e=>setNewPlan({...newPlan,plan_id:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <input placeholder="Plan Name" value={newPlan.plan_name} onChange={e=>setNewPlan({...newPlan,plan_name:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <input placeholder="Amount" type="number" value={newPlan.amount} onChange={e=>setNewPlan({...newPlan,amount:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
              <div className="flex gap-2">
                <input placeholder="Add benefit and press Add" value={newPlanBenefit} onChange={e=>setNewPlanBenefit(e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter') { e.preventDefault(); addBenefitToNewPlan(); } }} className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                <button onClick={addBenefitToNewPlan} className="btn-sm bg-[var(--pizo-gold)] text-black">Add</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(newPlan.benefits || []).map((b, i) => (
                <div key={i} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm flex items-center gap-2">
                  <span>{b}</span>
                  <button onClick={()=>removeBenefitFromNewPlan(i)} className="text-xs text-red-400">✕</button>
                </div>
              ))}
            </div>
            <div>
              <button onClick={addPlan} className="btn-sm bg-green-500/15 text-green-300">Add Plan</button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {plans.map(p => (
              <div key={p.plan_id} className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold">{p.plan_name} <span className="text-xs text-zinc-400">₹{p.amount}</span></div>
                    <div className="text-sm text-zinc-400 mt-2">{p.description || ''}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(Array.isArray(p.benefits) ? p.benefits : (p.benefits ? String(p.benefits).split(',').map(s=>s.trim()) : [])).map((b, i) => (
                        <div key={i} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs">{b}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={()=>openEditPlan(p)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                    <button onClick={()=>deletePlan(p.plan_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {editPlan && (
            <div className="space-y-3 mt-4">
              <div className="grid gap-3 md:grid-cols-4">
                <input value={editPlan.plan_id} placeholder="Plan ID (slug)" onChange={e=>setEditPlan({...editPlan,plan_id:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                <input value={editPlan.plan_name} onChange={e=>setEditPlan({...editPlan,plan_name:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                <input value={editPlan.amount} type="number" onChange={e=>setEditPlan({...editPlan,amount:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                <div className="flex gap-2">
                  <input placeholder="Add benefit" value={editPlanBenefit} onChange={e=>setEditPlanBenefit(e.target.value)} onKeyDown={e=>{ if (e.key === 'Enter') { e.preventDefault(); addBenefitToEditPlan(); } }} className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2" />
                  <button onClick={addBenefitToEditPlan} className="btn-sm bg-[var(--pizo-gold)] text-black">Add</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(editPlan.benefits || []).map((b,i)=>(
                  <div key={i} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-sm flex items-center gap-2">
                    <span>{b}</span>
                    <button onClick={()=>removeBenefitFromEditPlan(i)} className="text-xs text-red-400">✕</button>
                  </div>
                ))}
              </div>
              <div>
                <button onClick={updatePlan} className="btn-sm bg-green-500/15 text-green-300">Save</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Events */}
      {tab==="events" && (
        <div className="mt-6 space-y-4">
          {/* Add Event Form */}
          <div className="space-y-2">
            <input placeholder="Title" value={newEvent.title} onChange={e=>setNewEvent({...newEvent,title:e.target.value})}/>
            <input placeholder="Description" value={newEvent.description} onChange={e=>setNewEvent({...newEvent,description:e.target.value})}/>
            <input placeholder="Date" value={newEvent.date} onChange={e=>setNewEvent({...newEvent,date:e.target.value})}/>
            <input placeholder="Location" value={newEvent.location} onChange={e=>setNewEvent({...newEvent,location:e.target.value})}/>
            <input placeholder="Category" value={newEvent.category} onChange={e=>setNewEvent({...newEvent,category:e.target.value})}/>
            <input placeholder="Image URL" value={newEvent.image} onChange={e=>setNewEvent({...newEvent,image:e.target.value})}/>
            <button onClick={addEvent} className="btn-sm bg-green-500/15 text-green-300">Add Event</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {events.map(ev => (
              <div key={ev.event_id} className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                  <img src={(ev.images && ev.images[0]) || ev.image || '/api/uploads/placeholder.png'} alt={ev.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">{ev.title} <span className="text-xs text-zinc-400">{ev.date}</span></div>
                  <div className="text-xs text-zinc-500">{ev.location}</div>
                  <div className="text-sm text-zinc-400 mt-2">{ev.description}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={()=>setEditEvent(ev)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                  <button onClick={()=>deleteEvent(ev.event_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
                  <button onClick={async ()=>{ const { data } = await api.get('/admin/event-registrations', { headers: { 'X-Admin-Token': token } }); setEventRegistrations(data); setShowRegistrationsFor(ev.event_id); }} className="btn-sm bg-violet-500/15 text-violet-300">Registrations</button>
                </div>
              </div>
            ))}
          </div>

          {/* Registrations panel */}
          <div className="space-y-3">
            <div className="text-sm text-zinc-400">Event registrations</div>
            {eventRegistrations.length === 0 ? (
              <div className="text-xs text-zinc-400">No registrations yet.</div>
            ) : (
              <div className="grid gap-2">
                {eventRegistrations.filter(r=> !showRegistrationsFor || r.event_id === showRegistrationsFor).map(r => (
                  <div key={r.reg_id} className="glass rounded-xl p-3 flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold">{r.user_name || r.guest_name || 'Guest'}</div>
                      <div className="text-xs text-zinc-400">Event: {r.event_id} • {r.guest_email || r.guest_phone || ''}</div>
                      {r.note && <div className="text-xs mt-2">{r.note}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs text-zinc-400">{new Date(r.created_at).toLocaleString?.() || r.created_at}</div>
                      {r.refund_status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={async ()=>{ const mode = window.prompt('Refund mode (wallet/upi)', 'wallet'); if (!mode) return; try { await api.post(`/admin/event-registrations/${r.reg_id}/process`, { action: 'approve', mode }, { headers: { 'X-Admin-Token': token } }); toast.success('Refund approved'); const { data } = await api.get('/admin/event-registrations', { headers: { 'X-Admin-Token': token } }); setEventRegistrations(data); } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); } }} className="btn-sm bg-emerald-500/15 text-emerald-300">Approve</button>
                          <button onClick={async ()=>{ if (!window.confirm('Reject refund request?')) return; try { await api.post(`/admin/event-registrations/${r.reg_id}/process`, { action: 'reject' }, { headers: { 'X-Admin-Token': token } }); toast.success('Refund rejected'); const { data } = await api.get('/admin/event-registrations', { headers: { 'X-Admin-Token': token } }); setEventRegistrations(data); } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); } }} className="btn-sm bg-red-500/15 text-red-300">Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editEvent && (
            <div className="space-y-4 mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={editEvent.title} onChange={e=>setEditEvent({...editEvent,title:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
                <input value={editEvent.date} onChange={e=>setEditEvent({...editEvent,date:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
                <input value={editEvent.location} onChange={e=>setEditEvent({...editEvent,location:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
                <input value={editEvent.category} onChange={e=>setEditEvent({...editEvent,category:e.target.value})} className="bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
              </div>
              <label className="block text-sm text-zinc-300">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Description</div>
                <textarea className="w-full bg-black/30 border border-white/10 rounded-2xl px-3 py-3 text-sm min-h-[80px]" value={editEvent.description || ""} onChange={e=>setEditEvent({...editEvent,description:e.target.value})}/>
              </label>
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Photos</div>
                <div className="grid grid-cols-3 gap-3">
                  {(editEvent.images || []).map((url, index) => (
                    <div key={index} className="aspect-square rounded-2xl overflow-hidden border border-white/10 relative">
                      <img src={url} alt={`edit-event-${index}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setEditEvent({
                          ...editEvent,
                          images: editEvent.images.filter((_, i) => i !== index),
                          image: index === 0 ? editEvent.images[1] || "" : editEvent.image,
                        })} className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px]">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => editEventImageInput.current?.click()} className="aspect-square rounded-2xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-[var(--pizo-gold)] hover:text-[var(--pizo-gold-soft)] transition">
                    <span className="text-xs uppercase tracking-[0.3em]">Add photos</span>
                  </button>
                </div>
                <input ref={editEventImageInput} type="file" accept="image/*" multiple hidden onChange={e => { uploadMerchImages(e.target.files, editEvent, setEditEvent); e.target.value = ""; }} />
              </div>
              <div>
                <button onClick={updateEvent} className="btn-sm bg-green-500/15 text-green-300">Save</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="sponsors" && (
        <div className="mt-6 space-y-4">
          {sponsorEvents.length === 0 ? <div className="text-sm text-zinc-400">No sponsor enquiries</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {sponsorEvents.map(s=> (
                <div key={s.created_at + s.phone} className="glass rounded-2xl p-4">
                  <div className="font-bold">{s.name} — {s.interest_type}</div>
                  <div className="text-xs text-zinc-400 mt-1">{s.phone} • {s.address}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==="contacts" && (
        <div className="mt-6 space-y-4">
          {contacts.length === 0 ? <div className="text-sm text-zinc-400">No contact messages yet.</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {contacts.map(c=> (
                <div key={c.contact_id} className="glass rounded-2xl p-4">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{c.email}</div>
                  <div className="text-sm mt-3">{c.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==="refunds" && (
        <div className="mt-6 space-y-4">
          {refunds.length === 0 ? <div className="text-sm text-zinc-400">No refund requests found.</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {refunds.map(r=> (
                <div key={r.booking_id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{r.venue_name || r.venue_id}</div>
                      <div className="text-xs text-zinc-400 mt-1">Booking: {r.booking_id}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{r.refund_status}</span>
                  </div>
                  <div className="text-sm mt-3">Amount: ₹{r.refund_amount || r.final_total}</div>
                  <div className="text-sm mt-1">Mode: {r.refund_mode || "upi"}</div>
                  {r.refund_upi_id || r.upi_id ? (
                    <div className="text-sm mt-1">UPI: {r.refund_upi_id || r.upi_id}</div>
                  ) : null}
                  {r.refund_requested_by && <div className="text-xs text-zinc-400 mt-1">Requested by: {r.refund_requested_by}</div>}
                  {r.refund_requested_reason && <div className="text-xs text-zinc-400 mt-1">Reason: {r.refund_requested_reason}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={()=>{ setRefundModalBooking(r); setRefundModalOpen(true); }} className="btn-sm bg-green-500/15 text-green-300">Approve</button>
                    <button onClick={()=>{ setRejectModalBooking(r); }} className="btn-sm bg-red-500/15 text-red-300">Reject</button>
                    <button onClick={()=>{ setOverrideBookingId(r.booking_id); setAdminRefundTargetUser({ email: r.email || r.user_email || r.refund_requested_by || r.refund_requested_by_email || r.requested_by }); setAdminRefundOverrideOpen(true); }} className="btn-sm bg-blue-500/15 text-blue-300">Override</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refund approve modal */}
      {refundModalOpen && refundModalBooking && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4" onClick={()=>setRefundModalOpen(false)}>
          <form onClick={e=>e.stopPropagation()} className="glass rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg">Approve Refund</h3>
            <div className="text-sm text-zinc-400 mt-1">Booking: {refundModalBooking.booking_id}</div>
            <div className="mt-3 grid gap-2">
              <label className="text-xs">Mode</label>
              <select defaultValue={refundModalBooking.refund_mode || 'upi'} id="admin-refund-mode" className="p-2 rounded bg-black/40">
                <option value="wallet">Wallet (instant)</option>
                <option value="upi">UPI (1-2 working days)</option>
              </select>
              <div className="flex gap-2 mt-3">
                <button onClick={async (e)=>{ e.preventDefault(); const mode = document.getElementById('admin-refund-mode').value; try { await api.post(`/admin/refunds/${refundModalBooking.booking_id}/process`, { action: 'approve', mode }, { headers: { 'X-Admin-Token': token } }); toast.success('Refund approved'); setRefundModalOpen(false); tryAuth(token); } catch (err) { toast.error(err?.response?.data?.detail || 'Action failed'); } }} className="py-2 px-4 rounded-full bg-[var(--pizo-coral)] text-white">Approve</button>
                <button type="button" onClick={()=>setRefundModalOpen(false)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Reject confirmation modal */}
      {rejectModalBooking && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4" onClick={()=>setRejectModalBooking(null)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold">Reject Refund</h3>
            <div className="text-sm text-zinc-400 mt-1">Booking: {rejectModalBooking.booking_id}</div>
            <div className="mt-3 text-sm">Are you sure you want to reject this refund request?</div>
            <div className="flex gap-2 mt-3">
              <button onClick={async ()=>{ try { await api.post(`/admin/refunds/${rejectModalBooking.booking_id}/process`, { action: 'reject' }, { headers: { 'X-Admin-Token': token } }); toast.success('Refund rejected'); setRejectModalBooking(null); tryAuth(token); } catch (err) { toast.error(err?.response?.data?.detail || 'Action failed'); } }} className="py-2 px-4 rounded-full bg-red-500/15 text-red-300">Reject</button>
              <button onClick={()=>setRejectModalBooking(null)} className="py-2 px-4 rounded-full bg-white/5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Refund Override Modal */}
      {adminRefundOverrideOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-[#0b0b0b] rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg">Refund Override</h3>
            <div className="text-sm text-zinc-400 mt-1">For user: {adminRefundTargetUser?.email} ({adminRefundTargetUser?.user_id})</div>
            <div className="mt-4 space-y-2">
              <input placeholder="Booking ID" value={overrideBookingId} onChange={e=>setOverrideBookingId(e.target.value)} />
              <div className="flex gap-2">
                <select value={overrideAction} onChange={e=>setOverrideAction(e.target.value)} className="flex-1">
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
                <select value={overrideMode} onChange={e=>setOverrideMode(e.target.value)} className="flex-1">
                  <option value="wallet">Wallet</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <input placeholder="Amount (optional)" value={overrideAmount} onChange={e=>setOverrideAmount(e.target.value)} />
              {overrideMode==='upi' && <input placeholder="UPI ID" value={overrideUpi} onChange={e=>setOverrideUpi(e.target.value)} />}
              <textarea placeholder="Note" value={overrideNote} onChange={e=>setOverrideNote(e.target.value)} className="w-full min-h-[80px] bg-black/30 border border-white/10 rounded-xl p-3 text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={submitRefundOverride} className="btn-sm bg-green-500/15 text-green-300">Submit</button>
              <button onClick={()=>setAdminRefundOverrideOpen(false)} className="btn-sm bg-red-500/15 text-red-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {tab==="messages" && (
        <div className="mt-6 space-y-4">
          {adminMessages.length === 0 ? <div className="text-sm text-zinc-400">No messages</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {adminMessages.map(m=> (
                <div key={m.message_id} className="glass rounded-2xl p-4">
                  <div className="font-bold">{m.subject}</div>
                  <div className="text-xs text-zinc-400 mt-1">From: {m.from_user}</div>
                  <div className="text-sm mt-2">{m.message}</div>
                  {m.replies && m.replies.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="text-zinc-400">Replies:</div>
                      {m.replies.map((r,i)=> <div key={i} className="mt-1">{r.reply}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab==="discounts" && (
        <div className="mt-6 space-y-6">
          <div className="glass rounded-3xl p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-zinc-400">Off-Peak Discounts</div>
                <div className="text-xs text-zinc-500">Review, approve, or reject owner-submitted discounts.</div>
              </div>
              <div className="flex items-center gap-2">
                <select value={discountFilter} onChange={e=>setDiscountFilter(e.target.value)} className="bg-black/20 rounded px-2 py-1 text-sm">
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {discounts.length === 0 ? (
              <div className="mt-4 text-xs text-zinc-400">No discounts yet.</div>
            ) : (
              <div className="mt-4 grid gap-2">
                {discounts
                  .filter(d => discountFilter === 'all' ? true : d.approval_status === discountFilter)
                  .map(d => (
                    <div key={d.discount_id} className="glass rounded-xl p-3 flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-bold">{d.venue_name} <span className="text-xs text-zinc-400">({d.venue_city})</span></div>
                        <div className="text-xs text-zinc-400 mt-1">Discount: {d.discount_pct}% off • {d.slot_start} - {d.slot_end}</div>
                        <div className="text-xs text-zinc-400 mt-1">Valid: {d.valid_from} to {d.valid_until}</div>
                        <div className="text-xs text-zinc-400 mt-1">Owner: {d.owner_id}</div>
                        {d.recurring_type === 'weekly' && <div className="text-xs text-zinc-300 mt-1">📅 Weekly on days: {d.recurring_days?.join(', ') || 'All'}</div>}
                        {d.description && <div className="text-xs text-zinc-300 mt-2 p-2 bg-black/30 rounded">{d.description}</div>}
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2 whitespace-nowrap">
                        <div className={`text-xs px-2 py-1 rounded ${d.approval_status === 'pending' ? 'bg-amber-500/15 text-amber-300' : d.approval_status === 'approved' ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                          {d.approval_status.toUpperCase()}
                        </div>
                        {d.approval_status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={async () => {
                              try {
                                await api.post(`/admin/discounts/${d.discount_id}/approve`, {}, { headers: { 'X-Admin-Token': token } });
                                toast.success('Discount approved');
                                tryAuth(token);
                              } catch (e) { toast.error(e?.response?.data?.detail || 'Approval failed'); }
                            }} className="btn-sm text-xs bg-green-500/15 text-green-300">Approve</button>
                            <button onClick={async () => {
                              const reason = window.prompt('Rejection reason:');
                              if (!reason) return;
                              try {
                                await api.post(`/admin/discounts/${d.discount_id}/reject`, { reason }, { headers: { 'X-Admin-Token': token } });
                                toast.success('Discount rejected');
                                tryAuth(token);
                              } catch (e) { toast.error(e?.response?.data?.detail || 'Rejection failed'); }
                            }} className="btn-sm text-xs bg-red-500/15 text-red-300">Reject</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Creators */}
      {tab==="creators" && (
        <div className="mt-6 space-y-4">
          {/* Add Creator Form */}
          <div className="space-y-2">
            <input placeholder="Name" value={newCreator.name} onChange={e=>setNewCreator({...newCreator,name:e.target.value})}/>
            <input placeholder="Handle" value={newCreator.handle} onChange={e=>setNewCreator({...newCreator,handle:e.target.value})}/>
            <input placeholder="Category" value={newCreator.category} onChange={e=>setNewCreator({...newCreator,category:e.target.value})}/>
            <input placeholder="Avatar URL" value={newCreator.avatar} onChange={e=>setNewCreator({...newCreator,avatar:e.target.value})}/>
            <button onClick={addCreator} className="btn-sm bg-green-500/15 text-green-300">Add Creator</button>
          </div>

          {creators.map(cr=>(
            <div key={cr.creator_id} className="glass rounded-2xl p-5 flex justify-between">
              <div>
                <b>{cr.name}</b> <span className="text-xs text-zinc-400">{cr.handle}</span>
                <div className="text-xs text-zinc-500">Category: {cr.category}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setEditCreator(cr)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                <button onClick={()=>deleteCreator(cr.creator_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
              </div>
            </div>
          ))}

          {editCreator && (
            <div className="space-y-2 mt-4">
              <input value={editCreator.name} onChange={e=>setEditCreator({...editCreator,name:e.target.value})}/>
              <input value={editCreator.handle} onChange={e=>setEditCreator({...editCreator,handle:e.target.value})}/>
              <input value={editCreator.category} onChange={e=>setEditCreator({...editCreator,category:e.target.value})}/>
              <input value={editCreator.avatar} onChange={e=>setEditCreator({...editCreator,avatar:e.target.value})}/>
              <button onClick={updateCreator} className="btn-sm bg-green-500/15 text-green-300">Save</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

          