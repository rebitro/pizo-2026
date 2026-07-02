import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function MyOrders() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", shipping_address: "", email: "" });
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [refundMode, setRefundMode] = useState("wallet");
  const [upiId, setUpiId] = useState("");

  const loadOrders = async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/me/merch/orders');
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    }
  };

  useEffect(()=>{ if (!user) return; loadOrders(); }, [user]);

  const startEdit = (order) => {
    setEditingOrderId(order.order_id);
    setEditForm({
      name: order.name || user?.name || "",
      phone: order.phone || "",
      shipping_address: order.shipping_address || "",
      email: order.email || user?.email || "",
    });
  };

  const saveEdit = async (orderId) => {
    try {
      await api.put(`/me/merch/orders/${orderId}`, editForm);
      toast.success("Order updated");
      setEditingOrderId(null);
      await loadOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not update order");
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      const payload = { refund_mode: refundMode, upi_id: refundMode === "upi" ? upiId : "" };
      await api.post(`/me/merch/orders/${orderId}/cancel`, payload);
      toast.success(refundMode === "upi" ? "Refund requested. The amount will be added to your wallet in 1-2 working days." : "Refunded to your wallet");
      setCancelOrderId(null);
      await loadOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not cancel order");
    }
  };
  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-400">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return (
    <main className="pt-32 pb-24 px-6 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl font-black">My Orders</h1>
      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <div className="text-sm text-zinc-400">No orders yet. <Link to="/merch" className="text-[var(--pizo-gold-soft)] underline">Browse merch</Link>.</div>
        ) : (
          orders.map(o => (
            <div key={o.order_id} className="glass rounded-2xl p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="font-bold">{o.items?.[0]?.name || o.item_name || 'Merch order'}</div>
                <div className="text-xs text-zinc-400">Order: {o.order_id} • {new Date(o.created_at).toLocaleString()}</div>
                <div className="text-sm mt-1">Payment: {o.payment_method || o.payment_type || 'COD'} • ₹{o.subtotal || o.amount}</div>
                <div className="text-sm text-zinc-400">Recipient: {o.name || '—'}</div>
                <div className="text-sm text-zinc-400">Address: {o.shipping_address || '—'}</div>
                {o.refund_status && o.refund_status !== 'none' && (
                  <div className="text-xs mt-2 text-amber-300">Refund: {o.refund_status} {o.refund_mode ? `• ${o.refund_mode}` : ''}</div>
                )}
                {editingOrderId === o.order_id ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input value={editForm.name} onChange={(e)=>setEditForm({...editForm, name:e.target.value})} placeholder="Name" className="bg-black/30 border border-white/10 rounded-xl p-2 text-sm" />
                    <input value={editForm.phone} onChange={(e)=>setEditForm({...editForm, phone:e.target.value})} placeholder="Phone" className="bg-black/30 border border-white/10 rounded-xl p-2 text-sm" />
                    <input value={editForm.email} onChange={(e)=>setEditForm({...editForm, email:e.target.value})} placeholder="Email" className="bg-black/30 border border-white/10 rounded-xl p-2 text-sm" />
                    <textarea value={editForm.shipping_address} onChange={(e)=>setEditForm({...editForm, shipping_address:e.target.value})} placeholder="Address" className="bg-black/30 border border-white/10 rounded-xl p-2 text-sm md:col-span-2" />
                    <div className="md:col-span-2 flex gap-2">
                      <button onClick={()=>saveEdit(o.order_id)} className="px-3 py-2 rounded-full bg-[var(--pizo-coral)] text-white text-sm">Save</button>
                      <button onClick={()=>setEditingOrderId(null)} className="px-3 py-2 rounded-full bg-white/10 text-sm">Cancel</button>
                    </div>
                  </div>
                ) : null}
                {cancelOrderId === o.order_id ? (
                  <div className="mt-3 rounded-2xl border border-white/10 p-3 space-y-2">
                    <select value={refundMode} onChange={(e)=>setRefundMode(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm">
                      <option value="wallet">Wallet refund</option>
                      <option value="upi">UPI refund</option>
                    </select>
                    {refundMode === 'upi' && <input value={upiId} onChange={(e)=>setUpiId(e.target.value)} placeholder="UPI ID" className="w-full bg-black/30 border border-white/10 rounded-xl p-2 text-sm" />}
                    <div className="flex gap-2">
                      <button onClick={()=>cancelOrder(o.order_id)} className="px-3 py-2 rounded-full bg-[var(--pizo-gold)] text-black text-sm">Submit</button>
                      <button onClick={()=>setCancelOrderId(null)} className="px-3 py-2 rounded-full bg-white/10 text-sm">Close</button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 items-start md:items-end">
                <div className="text-sm text-zinc-400 capitalize">{o.status || 'pending'}</div>
                <div className="flex gap-2">
                  <button onClick={()=>startEdit(o)} className="px-3 py-2 rounded-full bg-white/10 text-sm">Edit</button>
                  <button onClick={()=>{ setCancelOrderId(o.order_id); setRefundMode('wallet'); setUpiId(''); }} className="px-3 py-2 rounded-full bg-white/10 text-sm">Cancel / Refund</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
