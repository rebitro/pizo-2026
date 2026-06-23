import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, MapPin, Trophy, ShieldCheck, Crown, Anchor, Leaf, Users, Gift } from "lucide-react";
import { SectionHeader } from "@/pages/Home";

const FEATURES = [
  { icon: <Sparkles/>, title: "Subscription Pass", price: "₹999/month", desc: "Unlimited slots across every PIZO partner category — turfs, gaming lounges, billiards, pickleball.", color: "coral" },
  { icon: <Zap/>, title: "Easy Booking", price: "0s confirmation", desc: "Pick a venue, pick a slot, you're locked in. No phone calls, no waits.", color: "gold" },
  { icon: <MapPin/>, title: "Variety Hub", price: "4 categories", desc: "Sports + gaming + billiards + pickleball — switch sports without switching apps.", color: "coral" },
  { icon: <Trophy/>, title: "Community & Rewards", price: "Badges • Tournaments", desc: "Earn points for play & content. Climb the leaderboard. Win merch & cash prizes.", color: "gold" },
  { icon: <ShieldCheck/>, title: "Verified & Safe Venues", price: "Eco-rated partners", desc: "Every venue is vetted; eco-friendly partners earn the Green Sail badge.", color: "coral" },
  { icon: <Users/>, title: "Bring The Crew", price: "Family & Squad passes", desc: "One pass for up to 5 — splitting time and split-second decisions.", color: "gold" },
];

export default function Features() {
  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="features-page">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-[10px] tracking-[0.35em] text-zinc-300">
          <Anchor size={12} className="text-[var(--pizo-gold)]"/> THE PIZO ADVANTAGE
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-6">Six reasons the crew <span className="gold-text">never stops sailing.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">Designed for youth who want to play more, pay less, and belong to something bigger than a single sport.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-16">
        {FEATURES.map((f,i) => (
          <motion.div key={i} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.07}}
            whileHover={{ y: -8 }}
            className="relative overflow-hidden glass rounded-3xl p-7 hover-lift" data-testid={`feature-card-${i}`}>
            <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl ${f.color==="coral"?"bg-[var(--pizo-coral)]/30":"bg-[var(--pizo-gold)]/20"}`}/>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${f.color==="coral"?"bg-[var(--pizo-coral)]/15 border border-[var(--pizo-coral)]/30 text-[var(--pizo-coral-soft)]":"bg-[var(--pizo-gold)]/15 border border-[var(--pizo-gold)]/30 text-[var(--pizo-gold-soft)]"}`}>{f.icon}</div>
            <div className="font-display text-2xl font-bold mt-5">{f.title}</div>
            <div className="text-[11px] tracking-[0.3em] text-zinc-400 mt-1">{f.price}</div>
            <p className="text-zinc-300 mt-3 text-sm leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-20 grid md:grid-cols-3 gap-5">
        {[
          { i: <Leaf className="text-emerald-300"/>, l: "Green Sail Partners", v: "62 venues" },
          { i: <Gift className="text-[var(--pizo-gold-soft)]"/>, l: "Monthly rewards pool", v: "₹2L+" },
          { i: <Crown className="text-[var(--pizo-coral-soft)]"/>, l: "Top creators rewarded", v: "20 / mo" },
        ].map((s,i)=>(
          <div key={i} className="glass rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">{s.i}</div>
            <div>
              <div className="text-[10px] tracking-[0.3em] text-zinc-400">{s.l}</div>
              <div className="font-bebas text-3xl gold-text">{s.v}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
