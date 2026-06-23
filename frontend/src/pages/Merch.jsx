import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Crown, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Merch() {
  const { user } = useAuth();
  const [data, setData] = useState({ is_premium: false, items: [] });

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

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="merch-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">EXCLUSIVE MERCH</div>
          <h1 className="font-display text-5xl md:text-7xl font-black mt-2">The crew's <span className="gold-text">loot.</span></h1>
        </div>
        {data.is_premium ? (
          <div className="glass rounded-full px-5 py-2 text-xs flex items-center gap-2"><Crown size={12} className="text-[var(--pizo-gold)]"/> Premium: 10% off pre-applied</div>
        ) : (
          <Link to="/plans" className="px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] text-white text-sm font-bold coral-glow flex items-center gap-2"><Lock size={12}/> Unlock with Premium</Link>
        )}
      </div>

      <div className={`grid md:grid-cols-3 lg:grid-cols-3 gap-5 mt-10 ${data.is_premium ? "" : "opacity-70"}`}>
        {data.items.map(m => (
          <motion.div key={m.id} whileHover={{ y:-6 }} className="glass rounded-3xl overflow-hidden">
            <div className="relative aspect-square overflow-hidden bg-white/5">
              <img src={m.image} alt={m.name} className="w-full h-full object-cover"/>
              {data.is_premium && <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[var(--pizo-coral)] text-white text-[10px] font-bold">-10% PREMIUM</div>}
              {!data.is_premium && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur"><Lock className="text-white" size={28}/></div>}
            </div>
            <div className="p-5">
              <div className="font-display text-lg font-bold">{m.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-bebas text-3xl gold-text">₹{m.price}</span>
                {m.original_price && <span className="text-zinc-500 text-xs line-through">₹{m.original_price}</span>}
              </div>
              <button disabled={!data.is_premium} onClick={()=>toast.success("Added to chest!")} data-testid={`merch-buy-${m.id}`}
                className="w-full mt-4 py-2.5 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm font-bold flex items-center justify-center gap-2">
                <ShoppingBag size={14}/> {data.is_premium ? "Add to Chest" : "Premium only"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
