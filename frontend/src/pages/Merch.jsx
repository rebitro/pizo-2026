import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Crown, ShoppingBag, CreditCard, DollarSign, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startRazorpayCheckout } from "@/lib/razorpay";

export default function Merch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ is_premium: false, items: [] });
  const [processing, setProcessing] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [readyBuy, setReadyBuy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/merch").then(r => setData(r.data)).catch(()=>{});
    api.get("/me/merch/cart").then(r => setCartCount(r.data?.item_count || 0)).catch(()=>{});
  }, [user]);

  if (!user) return (
    <main className="pt-32 pb-24 px-6 max-w-3xl mx-auto text-center" data-testid="merch-page">
      <Lock size={28} className="mx-auto text-[var(--pizo-gold)]"/>
      <h1 className="font-display text-4xl font-black mt-4">Sign in to see the loot.</h1>
    </main>
  );

  const buyWithWallet = async (item) => {
    if (!user) return;
    setProcessing(item.id);
    try {
      await api.post('/merch/purchase', { item_id: item.id, use_wallet: true });
      toast.success(`Purchased ${item.name} using wallet`);
      setProcessing(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Wallet purchase failed');
      setProcessing(null);
    }
  };

  const startQuickBuy = (item) => {
    setSelectedItem(item);
    setSelectedSize(item.sizes?.[0] || "");
    setSelectedColor(item.colors?.[0] || "");
    setQuantity(1);
    setRecipientName(user?.name || "");
    setShippingAddress("");
    setPhone("");
    setEmail(user?.email || "");
    setPaymentMethod("cod");
    setReadyBuy(true);
  };

  const placeQuickOrder = async (e) => {
    e.preventDefault();
    if (!selectedItem || !user) return;
    if (!recipientName || !shippingAddress || !phone || !email) {
      toast.error("Please fill your name, address, phone and email");
      return;
    }
    try {
      setProcessing(selectedItem.id);
      const checkoutPayload = {
        items: [{ item_id: selectedItem.id, size: selectedSize, color: selectedColor, quantity }],
        name: recipientName,
        shipping_address: shippingAddress,
        phone,
        email,
        payment_method: paymentMethod,
      };
      if (paymentMethod !== "cod") {
        try {
          await startRazorpayCheckout({
            amount: selectedItem.price * quantity,
            purpose: 'merch_purchase',
            purchase_payload: {
              ...checkoutPayload,
              item_id: selectedItem.id,
              size: selectedSize,
              color: selectedColor,
              quantity,
            },
            name: user.name,
            email,
            description: `Purchase ${selectedItem.name}`,
          });
        } catch (err) {
          if (err?.message?.includes('not configured') || err?.message?.includes('unavailable')) {
            await api.post('/merch/checkout', { ...checkoutPayload, payment_method: 'cod' });
          } else {
            throw err;
          }
        }
      } else {
        await api.post('/merch/checkout', checkoutPayload);
      }
      toast.success('Order placed successfully');
      setReadyBuy(false);
      navigate('/my-orders');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Checkout failed';
      if (msg !== 'Payment cancelled') toast.error(msg);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="merch-page">
      
      {/* 🔥 Banner image at top */}
      <Link to="/plans" className="block mb-8">
        <img 
          src="/images/merch-discount-banner.jpg" 
          alt="Get up to 20% off on all merch by taking Pirate's Pass"
          className="w-full rounded-xl shadow-lg cursor-pointer hover:opacity-90 transition"
        />
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">EXCLUSIVE MERCH</div>
          <h1 className="font-display text-5xl md:text-7xl font-black mt-2">
            The crew's <span className="gold-text">loot.</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {data.is_premium ? (
            <div className="glass rounded-full px-5 py-2 text-xs flex items-center gap-2">
              <Crown size={12} className="text-[var(--pizo-gold)]"/> Premium: 10% off pre-applied
            </div>
          ) : (
            <div className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold coral-glow flex items-center gap-2">
              <Lock size={12}/> Get Pirate's Pass for discounts
            </div>
          )}
          <Link to="/my-orders" className="px-4 py-2 rounded-full bg-white/10 text-sm">Orders</Link>
          <Link to="/cart" className="px-4 py-2 rounded-full bg-white/10 text-sm">Cart: {cartCount}</Link>
        </div>
      </div>

      {/* 🔥 Merch grid always visible */}
      <div className="grid md:grid-cols-3 lg:grid-cols-3 gap-5 mt-10">
        {data.items.map(m => (
          <motion.div key={m.id} whileHover={{ y:-6 }} className="glass rounded-3xl overflow-hidden">
            <div className="relative aspect-square overflow-hidden bg-white/5">
              <img src={m.image} alt={m.name} className="w-full h-full object-cover"/>
              {data.is_premium && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[var(--pizo-coral)] text-white text-[10px] font-bold">
                  -10% PREMIUM
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="font-display text-lg font-bold">{m.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bebas text-3xl gold-text">₹{m.price}</span>
                {m.original_price && (
                  <span className="text-zinc-500 text-xs line-through">₹{m.original_price}</span>
                )}
              </div>
              <div className="grid gap-3">
                <Link to={`/merch/${m.id}`} className="w-full py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2">
                  <Eye size={14}/> View details
                </Link>
                <button 
                  onClick={async ()=>{
                    try {
                      await api.post('/merch/cart', { item_id: m.id, size: m.sizes?.[0], color: m.colors?.[0], quantity: 1 });
                      const { data } = await api.get('/me/merch/cart');
                      setCartCount(data?.item_count || 0);
                      toast.success('Added to cart!');
                    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not add'); }
                  }} 
                  data-testid={`merch-add-${m.id}`}
                  className="w-full py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={14}/> Add to Cart
                </button>
                <button
                  onClick={()=>startQuickBuy(m)}
                  disabled={processing === m.id}
                  data-testid={`merch-buy-now-${m.id}`}
                  className="w-full py-2.5 rounded-full bg-[var(--pizo-coral)] text-white hover:bg-[var(--pizo-coral-soft)] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CreditCard size={14}/> {processing===m.id ? 'Processing...' : 'Buy Now'}
                </button>
                <button
                  onClick={()=>buyWithWallet(m)}
                  disabled={processing === m.id}
                  data-testid={`merch-wallet-${m.id}`}
                  className="w-full py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <DollarSign size={14}/> Wallet Purchase
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {readyBuy && selectedItem && (
        <div className="mt-8 glass rounded-3xl p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CHECKOUT</div>
              <h2 className="font-display text-2xl font-black">{selectedItem.name}</h2>
            </div>
            <button onClick={() => setReadyBuy(false)} className="text-sm text-zinc-400">Close</button>
          </div>
          <form onSubmit={placeQuickOrder} className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">Size</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedItem.sizes || []).map((size) => (
                    <button key={size} type="button" onClick={() => setSelectedSize(size)} className={`px-3 py-2 rounded-full text-sm ${selectedSize === size ? 'bg-[var(--pizo-coral)] text-white' : 'bg-white/5 text-zinc-300'}`}>{size}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Color</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedItem.colors || []).map((color) => (
                    <button key={color} type="button" onClick={() => setSelectedColor(color)} className={`px-3 py-2 rounded-full text-sm ${selectedColor === color ? 'bg-[var(--pizo-gold)] text-black' : 'bg-white/5 text-zinc-300'}`}>{color}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Quantity</div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">−</button>
                  <div className="min-w-[40px] text-center text-lg font-bold">{quantity}</div>
                  <button type="button" onClick={() => setQuantity(q => q + 1)} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">+</button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
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
                <div className="flex items-center justify-between"><span>Variant</span><span>{selectedSize || '—'} / {selectedColor || '—'}</span></div>
                <div className="flex items-center justify-between"><span>Qty</span><span>{quantity}</span></div>
                <div className="flex items-center justify-between font-semibold"><span>Total</span><span>₹{selectedItem.price * quantity}</span></div>
              </div>
              <button type="submit" className="w-full py-3 rounded-full bg-[var(--pizo-coral)] text-white font-semibold flex items-center justify-center gap-2"><ArrowRight size={16}/> Place order</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
