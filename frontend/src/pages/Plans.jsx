import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Anchor, Crown, Users, GraduationCap, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import AuthModal from "@/components/AuthModal";

const PLANS = [
  { id: "student", name: "Student Pass", price: 599, icon: <GraduationCap/>, tag: "POPULAR W/ CREW", color: "gold",
    features: ["Unlimited bookings", "All categories", "Student-only events", "Free 2 tournament entries"] },
  { id: "premium", name: "Premium Pass", price: 999, icon: <Crown/>, tag: "MOST FLEXIBLE", color: "coral", best: true,
    features: ["Everything in Student", "Priority slot booking", "Creator Club access", "Exclusive merch drops", "Monthly cashback rewards"] },
  { id: "family", name: "Family Pass", price: 1499, icon: <Users/>, tag: "UP TO 5 PIRATES", color: "gold",
    features: ["5 user accounts", "Shared booking calendar", "Family events", "Annual loyalty bonus"] },
];

export default function Plans() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [paying, setPaying] = useState(null);
  const [subbed, setSubbed] = useState(null);

  const subscribe = async (planId) => {
    if (!user) { setAuthOpen(true); return; }
    setPaying(planId);
    try {
      const upi = "pizo@upi";
      const { data } = await api.post("/subscriptions", { plan_id: planId, upi_id: upi });
      setSubbed(data);
      toast.success(`${data.plan_name} activated! Ref ${data.upi_ref}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Subscription failed");
    } finally {
      setPaying(null);
    }
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="plans-page">
      <div className="text-center">
        <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">PRICING</div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-3">Pick your <span className="gold-text">ship.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">No hidden fees, cancel anytime. One pass for every game — billed monthly, paid via UPI.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-14">
        {PLANS.map((p,i) => (
          <motion.div key={p.id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}
            whileHover={{ y: -10 }}
            className={`relative glass rounded-3xl p-7 overflow-hidden hover-lift ${p.best ? "ring-1 ring-[var(--pizo-coral)] md:-translate-y-4" : ""}`}
            data-testid={`plan-card-${p.id}`}>
            {p.best && <div className="absolute top-4 right-4 text-[10px] tracking-[0.25em] px-3 py-1 rounded-full bg-[var(--pizo-coral)] text-white">BEST VALUE</div>}
            <div className={`absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl ${p.color==="coral"?"bg-[var(--pizo-coral)]/30":"bg-[var(--pizo-gold)]/20"}`}/>
            <div className="relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${p.color==="coral"?"bg-[var(--pizo-coral)]/15 border border-[var(--pizo-coral)]/30 text-[var(--pizo-coral-soft)]":"bg-[var(--pizo-gold)]/15 border border-[var(--pizo-gold)]/30 text-[var(--pizo-gold-soft)]"}`}>{p.icon}</div>
              <div className="text-[10px] tracking-[0.3em] text-zinc-400 mt-5">{p.tag}</div>
              <div className="font-display text-2xl font-bold mt-1">{p.name}</div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-bebas text-6xl gold-text">₹{p.price}</span>
                <span className="text-zinc-400 text-sm">/month</span>
              </div>
              <ul className="mt-6 space-y-3 min-h-[160px]">
                {p.features.map((f,k)=>(
                  <li key={k} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check size={16} className="text-[var(--pizo-gold)] mt-0.5 shrink-0"/> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => subscribe(p.id)} disabled={paying===p.id}
                data-testid={`plan-subscribe-${p.id}`}
                className={`w-full mt-7 py-3.5 rounded-full font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60 flex items-center justify-center gap-2 ${p.best ? "bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white coral-glow" : "glass hover:bg-white/10 text-white"}`}>
                <Anchor size={14}/> {paying===p.id ? "Hoisting..." : "Start with " + p.name.split(" ")[0]}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {subbed && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
          className="mt-12 glass-strong rounded-3xl p-8 max-w-2xl mx-auto text-center" data-testid="subscription-success">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
            <Check size={22}/>
          </div>
          <h3 className="font-display text-2xl font-bold mt-4">Welcome to {subbed.plan_name}, captain.</h3>
          <p className="text-zinc-400 text-sm mt-2">Pay ₹{subbed.amount} to <span className="text-white">pizo@upi</span> with reference</p>
          <div className="mt-4 inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm font-mono"
            onClick={()=>{navigator.clipboard.writeText(subbed.upi_ref); toast.success("Copied!");}}>
            {subbed.upi_ref} <Copy size={14}/>
          </div>
          <p className="text-xs text-zinc-500 mt-4">Expires {new Date(subbed.expires_at).toLocaleDateString()}. Full Razorpay flow coming next iteration.</p>
        </motion.div>
      )}

      <div className="mt-20 grid md:grid-cols-3 gap-5">
        {[
          { t: "Pay via UPI", d: "Use any UPI app (GPay, PhonePe, Paytm) — instant activation, no card required." },
          { t: "Cancel Anytime", d: "Pause or cancel within the dashboard. Pro-rated refunds for unused days." },
          { t: "Loyalty Rewards", d: "3 months in a row = free month + Crew Captain badge." },
        ].map((b,i)=>(
          <div key={i} className="glass rounded-2xl p-6">
            <div className="font-display text-lg font-bold">{b.t}</div>
            <p className="text-zinc-400 text-sm mt-2">{b.d}</p>
          </div>
        ))}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
