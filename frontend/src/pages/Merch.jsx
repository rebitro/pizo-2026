import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Crown, ShoppingBag, CreditCard, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { startRazorpayCheckout } from "@/lib/razorpay";

export default function Merch() {
  const { user } = useAuth();
  const [data, setData] = useState({ is_premium: false, items: [] });
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get("/merch").then(r => setData(r.data)).catch(()=>{});
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

  const buyWithRazorpay = async (item) => {
    if (!user) return;
    setProcessing(item.id);
    try {
      const { payload } = await startRazorpayCheckout({
        amount: item.price,
        purpose: 'merch_purchase',
        purchase_payload: { item_id: item.id },
        name: user.name,
        email: user.email,
        description: `Purchase ${item.name}`,
      });
      if (payload?.order?.order_id) {
        toast.success(`Purchased ${item.name}`);
      } else {
        toast.success(`Payment complete for ${item.name}`);
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Payment failed';
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
        {data.is_premium ? (
          <div className="glass rounded-full px-5 py-2 text-xs flex items-center gap-2">
            <Crown size={12} className="text-[var(--pizo-gold)]"/> Premium: 10% off pre-applied
          </div>
        ) : (
          <div className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold coral-glow flex items-center gap-2">
            <Lock size={12}/> Get Pirate's Pass for discounts
          </div>
        )}
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
                <button 
                  onClick={async ()=>{
                    try {
                      await api.post('/merch/add', { item_id: m.id });
                      toast.success('Added to chest!');
                    } catch (e) { toast.error(e?.response?.data?.detail || 'Could not add'); }
                  }} 
                  data-testid={`merch-add-${m.id}`}
                  className="w-full py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={14}/> Add to Chest
                </button>
                <button
                  onClick={()=>buyWithRazorpay(m)}
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
    </main>
  );
}
