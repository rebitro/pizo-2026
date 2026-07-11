import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startRazorpayCheckout } from "@/lib/razorpay";

export default function CartPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadCart();
  }, [user]);

  const loadCart = async () => {
    try {
      const { data } = await api.get("/me/merch/cart");
      setItems(data.items || []);
      if (!recipientName) setRecipientName(user?.name || "");
      if (!email) setEmail(user?.email || "");
    } catch {
      setItems([]);
    }
  };

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0), [items]);

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!recipientName || !shippingAddress || !phone || !email) {
      toast.error("Please add recipient name, shipping address, phone and email");
      return;
    }
    if (!items.length) {
      toast.error("Your cart is empty");
      return;
    }
    try {
      setPlacing(true);
      if (paymentMethod !== "cod") {
        try {
          await startRazorpayCheckout({
            amount: subtotal,
            purpose: "merch_purchase",
            purchase_payload: {
              items: items.map((item) => ({
                item_id: item.item_id,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
              })),
              shipping_address: shippingAddress,
              phone,
              email,
              payment_method: paymentMethod,
            },
            name: user.name,
            email,
            description: "Merch purchase from cart",
          });
        } catch (err) {
          if (err?.message?.includes('not configured') || err?.message?.includes('unavailable')) {
            await api.post("/merch/checkout", {
              items: items.map((item) => ({ item_id: item.item_id, size: item.size, color: item.color, quantity: item.quantity })),
              name: recipientName,
              shipping_address: shippingAddress,
              phone,
              email,
              payment_method: "cod",
            });
          } else {
            throw err;
          }
        }
      } else {
        await api.post("/merch/checkout", {
          items: items.map((item) => ({ item_id: item.item_id, size: item.size, color: item.color, quantity: item.quantity })),
          name: recipientName,
          shipping_address: shippingAddress,
          phone,
          email,
          payment_method: paymentMethod,
        });
      }
      toast.success("Order placed successfully");
      setItems([]);
      navigate("/my-orders");
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Checkout failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto text-zinc-400">Loading cart…</main>;
  if (!user) return <main className="pt-32 pb-24 px-6 max-w-4xl mx-auto text-center">Please sign in to view your cart.</main>;

  return (
    <main className="pt-32 pb-24 px-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]"><ShoppingBag size={12}/> YOUR CART</div>
          <h1 className="font-display text-3xl font-black mt-2">Ready to order</h1>
          {items.length === 0 ? (
            <div className="mt-6 text-sm text-zinc-400">Your cart is empty. Head to the merch page to add items.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <div key={`${item.item_id}-${item.size}-${item.color}`} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
                  {item.image ? <img src={item.image} alt={item.name} className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-white/5" />}
                  <div className="flex-1">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-zinc-400">{item.size} • {item.color} • Qty {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-semibold">₹{(item.price || 0) * (item.quantity || 1)}</div>
                    <button type="button" onClick={async () => { try { await api.delete(`/me/merch/cart?item_id=${encodeURIComponent(item.item_id)}&size=${encodeURIComponent(item.size || "")}&color=${encodeURIComponent(item.color || "")}`); await loadCart(); toast.success("Item removed from cart"); } catch { toast.error("Could not remove item"); } }} className="h-8 w-8 rounded-full bg-white/10 text-sm">−</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]"><CreditCard size={12}/> CHECKOUT</div>
          <form onSubmit={placeOrder} className="mt-4 space-y-3">
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
            <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Shipping address" className="w-full min-h-[90px] bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm" required />
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm">
              <option value="cod">COD</option>
              <option value="wallet">Wallet</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
            <div className="rounded-2xl border border-white/10 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between"><span>Items</span><span>{items.length}</span></div>
              <div className="flex items-center justify-between font-semibold"><span>Total</span><span>₹{subtotal}</span></div>
            </div>
            <button type="submit" disabled={placing || !items.length} className="w-full py-3 rounded-full bg-[var(--pizo-coral)] text-white font-semibold disabled:opacity-60">{placing ? "Processing..." : "Place order"}</button>
          </form>
          <div className="mt-4 text-sm text-zinc-400">
            <Link to="/merch" className="text-[var(--pizo-gold-soft)] underline">Continue shopping</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
