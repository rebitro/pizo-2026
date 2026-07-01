import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function MyOrders() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState([]);
  useEffect(()=>{ if (!user) return; api.get('/me/merch/orders').then(r=>setOrders(r.data.orders||[])).catch(()=>setOrders([])); }, [user]);
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
            <div key={o.order_id} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-bold">{o.item_name}</div>
                <div className="text-xs text-zinc-400">Order: {o.order_id} • {new Date(o.created_at).toLocaleString()}</div>
                <div className="text-sm mt-1">Payment: {o.payment_type} • ₹{o.amount}</div>
              </div>
              <div className="text-sm text-zinc-400">{o.status?.toUpperCase() || 'PAID'}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
