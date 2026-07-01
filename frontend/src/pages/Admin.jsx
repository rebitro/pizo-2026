import React, { useEffect, useState } from "react";
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
  const [newMerch, setNewMerch] = useState({ name:"", price:"", image:"", category:"" });
  const [editMerch, setEditMerch] = useState(null);

  const [newPlan, setNewPlan] = useState({ plan_name:"", amount:"", benefits:"" });
  const [editPlan, setEditPlan] = useState(null);

  const [newEvent, setNewEvent] = useState({ title:"", description:"", date:"", location:"", category:"", image:"" });
  const [editEvent, setEditEvent] = useState(null);

  const [newVenue, setNewVenue] = useState({ name:"", city:"", category:"", price_per_hour:"", image:"" });
  const [editVenue, setEditVenue] = useState(null);

  const [newCreator, setNewCreator] = useState({ name:"", handle:"", category:"", avatar:"" });
  const [editCreator, setEditCreator] = useState(null);

  const [tab, setTab] = useState("venues");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundModalBooking, setRefundModalBooking] = useState(null);
  const [rejectModalBooking, setRejectModalBooking] = useState(null);

  const tryAuth = async (t) => {
    try {
      const { data } = await api.get("/admin/overview", { headers: { "X-Admin-Token": t } });
      setOverview(data); setAuthed(true); localStorage.setItem("pizo_admin", t);

      // fetch all entities
      setVenues((await api.get("/admin/venues",{headers:{"X-Admin-Token":t}})).data);
      setContacts((await api.get("/admin/contacts",{headers:{"X-Admin-Token":t}})).data);
      setUsers((await api.get("/admin/users",{headers:{"X-Admin-Token":t}})).data);
      setOwners((await api.get("/admin/owners",{headers:{"X-Admin-Token":t}})).data);
      setMerch((await api.get("/admin/merch",{headers:{"X-Admin-Token":t}})).data);
      setPlans((await api.get("/admin/plans",{headers:{"X-Admin-Token":t}})).data);
      setEvents((await api.get("/admin/events",{headers:{"X-Admin-Token":t}})).data);
      setCreators((await api.get("/admin/creators",{headers:{"X-Admin-Token":t}})).data);
      setSponsorEvents((await api.get("/admin/sponsor-events",{headers:{"X-Admin-Token":t}})).data || []);
      setRefunds((await api.get("/admin/refunds",{headers:{"X-Admin-Token":t}})).data.refunds || []);
      setAdminMessages((await api.get("/admin/messages",{headers:{"X-Admin-Token":t}})).data || []);

    } catch { toast.error("Invalid token"); setAuthed(false); }
  };
  useEffect(() => { if (token) tryAuth(token); }, []);

  // Helper functions (Delete)
  const deleteUser = async (id) => { await api.delete(`/admin/users/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("User deleted"); tryAuth(token); };
  const deleteOwner = async (id) => { await api.delete(`/admin/owners/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Owner deleted"); tryAuth(token); };
  const deleteMerch = async (id) => { await api.delete(`/admin/merch/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Merch deleted"); tryAuth(token); };
  const deletePlan = async (id) => { await api.delete(`/admin/plans/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Plan deleted"); tryAuth(token); };
  const deleteEvent = async (id) => { await api.delete(`/admin/events/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Event deleted"); tryAuth(token); };
  const deleteCreator = async (id) => { await api.delete(`/admin/creators/${id}`, { headers: { "X-Admin-Token": token } }); toast.success("Creator deleted"); tryAuth(token); };

  // Add/Edit functions
  const addMerch = async () => { await api.post("/admin/merch", newMerch, { headers: { "X-Admin-Token": token } }); toast.success("Merch added"); setNewMerch({ name:"", price:"", image:"", category:"" }); tryAuth(token); };
  const updateMerch = async () => { await api.put(`/admin/merch/${editMerch.id}`, editMerch, { headers: { "X-Admin-Token": token } }); toast.success("Merch updated"); setEditMerch(null); tryAuth(token); };

  const addPlan = async () => { await api.post("/admin/plans", newPlan, { headers: { "X-Admin-Token": token } }); toast.success("Plan added"); setNewPlan({ plan_name:"", amount:"", benefits:"" }); tryAuth(token); };
  const updatePlan = async () => { await api.put(`/admin/plans/${editPlan.plan_id}`, editPlan, { headers: { "X-Admin-Token": token } }); toast.success("Plan updated"); setEditPlan(null); tryAuth(token); };

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
            ["merch","Merch"],["plans","Plans"],["events","Events"],["creators","Creators"],
            ["refunds","Refunds"],["sponsors","Sponsor Events"],["messages","Messages"]
        ].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} className={`text-xs px-4 py-2 rounded-full ${tab===v?"bg-[var(--pizo-coral)] text-white":"glass"}`}>{l}</button>
        ))}
      </div>

      {/* Venues */}
      {tab==="venues" && (
        <div className="mt-6 space-y-4">
          {/* Add Venue Form */}
          <div className="space-y-2">
            <input placeholder="Name" value={newVenue.name} onChange={e=>setNewVenue({...newVenue,name:e.target.value})}/>
            <input placeholder="City" value={newVenue.city} onChange={e=>setNewVenue({...newVenue,city:e.target.value})}/>
            <input placeholder="Category" value={newVenue.category} onChange={e=>setNewVenue({...newVenue,category:e.target.value})}/>
            <input placeholder="Price/hr" value={newVenue.price_per_hour} onChange={e=>setNewVenue({...newVenue,price_per_hour:e.target.value})}/>
            <input placeholder="Image URL" value={newVenue.image} onChange={e=>setNewVenue({...newVenue,image:e.target.value})}/>
            <button onClick={addVenue} className="btn-sm bg-green-500/15 text-green-300">Add Venue</button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {venues.map(v=>(
              <div key={v.venue_id} className="glass rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="font-display text-lg font-bold">{v.name} {v.verified && <span className="text-emerald-300 text-xs ml-2">✓ VERIFIED</span>}</div>
                  <div className="text-xs text-zinc-400">{v.city} • {v.category} • ₹{v.price_per_hour}/hr</div>
                </div>
                <div className="flex gap-2">
                  {v.verified 
                    ? <button onClick={()=>unverifyVenue(v.venue_id)} className="btn-sm bg-yellow-500/15 text-yellow-300">Unverify</button>
                    : <button onClick={()=>verifyVenue(v.venue_id)} className="btn-sm bg-green-500/15 text-green-300">Verify</button>}
                  <button onClick={()=>setEditVenue(v)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit Venue Form */}
          {editVenue && (
            <div className="space-y-2 mt-4">
              <input value={editVenue.name} onChange={e=>setEditVenue({...editVenue,name:e.target.value})}/>
              <input value={editVenue.city} onChange={e=>setEditVenue({...editVenue,city:e.target.value})}/>
              <input value={editVenue.category} onChange={e=>setEditVenue({...editVenue,category:e.target.value})}/>
              <input value={editVenue.price_per_hour} onChange={e=>setEditVenue({...editVenue,price_per_hour:e.target.value})}/>
              <input value={editVenue.image} onChange={e=>setEditVenue({...editVenue,image:e.target.value})}/>
              <button onClick={updateVenue} className="btn-sm bg-green-500/15 text-green-300">Save</button>
            </div>
          )}
        </div>
      )}

      {/* Merch */}
      {tab==="merch" && (
        <div className="mt-6 space-y-4">
          {/* Add Merch Form */}
          <div className="space-y-2">
            <input placeholder="Name" value={newMerch.name} onChange={e=>setNewMerch({...newMerch,name:e.target.value})}/>
            <input placeholder="Price" value={newMerch.price} onChange={e=>setNewMerch({...newMerch,price:e.target.value})}/>
            <input placeholder="Image URL" value={newMerch.image} onChange={e=>setNewMerch({...newMerch,image:e.target.value})}/>
            <input placeholder="Category" value={newMerch.category} onChange={e=>setNewMerch({...newMerch,category:e.target.value})}/>
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
            <div className="space-y-2 mt-4">
              <input value={editMerch.name} onChange={e=>setEditMerch({...editMerch,name:e.target.value})}/>
              <input value={editMerch.price} onChange={e=>setEditMerch({...editMerch,price:e.target.value})}/>
              <input value={editMerch.image} onChange={e=>setEditMerch({...editMerch,image:e.target.value})}/>
              <input value={editMerch.category} onChange={e=>setEditMerch({...editMerch,category:e.target.value})}/>
              <button onClick={updateMerch} className="btn-sm bg-green-500/15 text-green-300">Save</button>
            </div>
          )}
        </div>
      )}

      {/* Plans */}
      {tab==="plans" && (
        <div className="mt-6 space-y-4">
          {/* Add Plan Form */}
          <div className="space-y-2">
            <input placeholder="Plan Name" value={newPlan.plan_name} onChange={e=>setNewPlan({...newPlan,plan_name:e.target.value})}/>
            <input placeholder="Amount" value={newPlan.amount} onChange={e=>setNewPlan({...newPlan,amount:e.target.value})}/>
            <input placeholder="Benefits (comma separated)" value={newPlan.benefits} onChange={e=>setNewPlan({...newPlan,benefits:e.target.value})}/>
            <button onClick={addPlan} className="btn-sm bg-green-500/15 text-green-300">Add Plan</button>
          </div>

          {plans.map(p=>(
            <div key={p.plan_id} className="glass rounded-2xl p-5 flex justify-between">
              <div><b>{p.plan_name}</b> <span className="text-xs text-zinc-400">₹{p.amount}</span></div>
              <div className="flex gap-2">
                <button onClick={()=>setEditPlan(p)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                <button onClick={()=>deletePlan(p.plan_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
              </div>
            </div>
          ))}

                    {editPlan && (
            <div className="space-y-2 mt-4">
              <input value={editPlan.plan_name} onChange={e=>setEditPlan({...editPlan,plan_name:e.target.value})}/>
              <input value={editPlan.amount} onChange={e=>setEditPlan({...editPlan,amount:e.target.value})}/>
              <input value={editPlan.benefits} onChange={e=>setEditPlan({...editPlan,benefits:e.target.value})}/>
              <button onClick={updatePlan} className="btn-sm bg-green-500/15 text-green-300">Save</button>
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

          {events.map(ev=>(
            <div key={ev.event_id} className="glass rounded-2xl p-5 flex justify-between">
              <div>
                <b>{ev.title}</b> <span className="text-xs text-zinc-400">{ev.date}</span>
                <div className="text-xs text-zinc-500">{ev.location}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setEditEvent(ev)} className="btn-sm bg-blue-500/15 text-blue-300">Edit</button>
                <button onClick={()=>deleteEvent(ev.event_id)} className="btn-sm bg-red-500/15 text-red-300">Delete</button>
              </div>
            </div>
          ))}

          {editEvent && (
            <div className="space-y-2 mt-4">
              <input value={editEvent.title} onChange={e=>setEditEvent({...editEvent,title:e.target.value})}/>
              <input value={editEvent.description} onChange={e=>setEditEvent({...editEvent,description:e.target.value})}/>
              <input value={editEvent.date} onChange={e=>setEditEvent({...editEvent,date:e.target.value})}/>
              <input value={editEvent.location} onChange={e=>setEditEvent({...editEvent,location:e.target.value})}/>
              <input value={editEvent.category} onChange={e=>setEditEvent({...editEvent,category:e.target.value})}/>
              <input value={editEvent.image} onChange={e=>setEditEvent({...editEvent,image:e.target.value})}/>
              <button onClick={updateEvent} className="btn-sm bg-green-500/15 text-green-300">Save</button>
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
                  {r.refund_requested_by && <div className="text-xs text-zinc-400 mt-1">Requested by: {r.refund_requested_by}</div>}
                  {r.refund_requested_reason && <div className="text-xs text-zinc-400 mt-1">Reason: {r.refund_requested_reason}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={()=>{ setRefundModalBooking(r); setRefundModalOpen(true); }} className="btn-sm bg-green-500/15 text-green-300">Approve</button>
                    <button onClick={()=>{ setRejectModalBooking(r); }} className="btn-sm bg-red-500/15 text-red-300">Reject</button>
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

          