import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Anchor, Compass, ArrowRight, Sparkles, Trophy, ShieldCheck, Zap, MapPin, Crown } from "lucide-react";
import { api, LOGO_URL } from "@/lib/api";

const stat = (n, l) => ({ n, l });

export default function Home() {
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api.get("/venues").then(r => setVenues(r.data.slice(0,3))).catch(()=>{});
    api.get("/events").then(r => setEvents(r.data.slice(0,3))).catch(()=>{});
  }, []);

  return (
    <main className="relative overflow-hidden" data-testid="home-page">
      {/* HERO */}
      <section className="relative pt-32 md:pt-40 pb-24 px-6">
        <div className="absolute inset-0 -z-10">
          <img src="https://images.unsplash.com/photo-1511512578047-dfb367046420?crop=entropy&cs=srgb&fm=jpg&q=85" className="w-full h-full object-cover opacity-30" alt=""/>
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-[#050505]"/>
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
          <div>
            <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.7}}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs tracking-[0.3em] text-zinc-300">
              <Anchor size={12} className="text-[var(--pizo-gold)]"/> AHOY • SUBSCRIPTION PASS LIVE
            </motion.div>

            <motion.h1
              initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.8,delay:0.1}}
              className="font-display text-5xl sm:text-6xl lg:text-8xl font-black mt-6 leading-[0.95]">
              Play More.<br/>
              <span className="gold-text">Pay Less.</span>
            </motion.h1>

            <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.4}}
              className="mt-6 text-zinc-300 text-base sm:text-lg max-w-xl leading-relaxed">
              One membership. Every game. Unlock turfs, billiards, gaming lounges and pickleball arenas across India — and join the Pirates Gaming Club crew.
            </motion.p>

            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.5}}
              className="mt-8 flex flex-wrap gap-3">
              <Link to="/plans" data-testid="hero-join-button"
                className="group px-7 py-4 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow transition-all hover:-translate-y-0.5 flex items-center gap-2">
                <Anchor size={16}/> Join Now <ArrowRight size={16} className="group-hover:translate-x-1 transition"/>
              </Link>
              <Link to="/venues" data-testid="hero-explore-button"
                className="px-7 py-4 rounded-full glass hover:bg-white/10 text-white font-semibold transition-all hover:-translate-y-0.5 flex items-center gap-2">
                <Compass size={16}/> Explore Venues
              </Link>
            </motion.div>

            <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8}}
              className="mt-12 grid grid-cols-3 gap-3 max-w-lg">
              {[stat("120+","Venues"), stat("18K","Crew"), stat("₹999","/month")].map((s,i)=>(
                <div key={i} className="glass rounded-2xl px-4 py-4">
                  <div className="font-bebas text-3xl gold-text">{s.n}</div>
                  <div className="text-[10px] tracking-[0.25em] text-zinc-400 mt-1">{s.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{opacity:0,scale:0.9,rotate:-6}} animate={{opacity:1,scale:1,rotate:0}}
            transition={{duration:1, delay:0.3, ease:[0.2,0.8,0.2,1]}}
            className="relative hidden lg:block">
            <div className="relative w-full aspect-square max-w-md ml-auto">
              <div className="absolute -inset-10 bg-[var(--pizo-gold)]/10 blur-3xl rounded-full"/>
              <motion.img
                src={LOGO_URL}
                animate={{ y: [0, -15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(212,175,55,0.45)]"
                alt="PIZO Pirates Logo"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 glass-strong rounded-full px-5 py-2 text-xs tracking-[0.3em] text-[var(--pizo-gold)] flex items-center gap-2">
                <Crown size={12}/> PIRATES OF PLAY
              </div>
            </div>
          </motion.div>
        </div>

        {/* Marquee */}
        <div className="mt-20 overflow-hidden">
          <div className="marquee whitespace-nowrap text-zinc-500 font-bebas text-3xl tracking-widest">
            {Array(2).fill(0).map((_,k)=>(
              <div key={k} className="flex gap-12 items-center">
                {["TURFS","BILLIARDS","GAMING LOUNGES","PICKLEBALL","TOURNAMENTS","CREATOR CLUB","BOOK INSTANTLY","ECO-FRIENDLY"].map((t,i)=>(
                  <span key={i} className="flex items-center gap-12"><span className="text-[var(--pizo-gold)]">✦</span>{t}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <SectionHeader eyebrow="WHY PIZO" title="Built for the crew that refuses to sit still." />
        <div className="grid md:grid-cols-3 gap-5 mt-12">
          <BentoCard span="md:col-span-2" gradient="from-[#FF5E3A]/20" icon={<Sparkles/>} title="Subscription Pass" sub="₹999/month • All activities"
            desc="One pass unlocks unlimited slots across every category. Cancel anytime, pay-as-you-play later.">
            <img src="https://images.pexels.com/photos/9072386/pexels-photo-9072386.jpeg" className="absolute right-0 bottom-0 w-2/3 h-2/3 object-cover opacity-30 rounded-bl-[80px]" alt=""/>
          </BentoCard>
          <BentoCard gradient="from-[#D4AF37]/20" icon={<Zap/>} title="Instant Booking" sub="0s confirmation" desc="Slot you saw is the slot you get. No back-and-forth."/>
          <BentoCard gradient="from-[#FF5E3A]/15" icon={<MapPin/>} title="Variety Hub" sub="4 categories" desc="Turfs, gaming, billiards, pickleball — under one ship."/>
          <BentoCard gradient="from-[#D4AF37]/20" icon={<Trophy/>} title="Community & Rewards" sub="Badges • Leaderboards" desc="Climb the crew leaderboard, unlock merch, free months & cash."/>
          <BentoCard gradient="from-[#FF5E3A]/15" icon={<ShieldCheck/>} title="Verified & Safe" sub="Eco-friendly venues" desc="Every venue is audited. Green-rated partners get priority."/>
        </div>
      </section>

      {/* VENUES PREVIEW */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <SectionHeader eyebrow="MAP THE TREASURE" title="Featured venues in your harbor." compact/>
          <Link to="/venues" className="text-sm text-[var(--pizo-gold-soft)] hover:underline flex items-center gap-1" data-testid="home-all-venues">
            All venues <ArrowRight size={14}/>
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-5 mt-8">
          {venues.map(v => (
            <motion.div key={v.venue_id} whileHover={{ y: -6 }} className="group glass rounded-3xl overflow-hidden">
              <div className="aspect-[16/11] overflow-hidden">
                <img src={v.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={v.name}/>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)] uppercase">{v.category}</div>
                  <div className="text-xs text-zinc-400">★ {v.rating}</div>
                </div>
                <div className="font-display text-xl font-bold mt-2">{v.name}</div>
                <div className="text-xs text-zinc-400">{v.city} • ₹{v.price_per_hour}/hr</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* EVENTS STRIP */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <SectionHeader eyebrow="THE LOGBOOK" title="Recent raids by Pirates Gaming Club."/>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {events.map((e, i) => (
            <motion.div key={e.event_id} initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*0.1}}
              className="relative rounded-3xl overflow-hidden aspect-[4/5] group">
              <img src={e.image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={e.title}/>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"/>
              <div className="absolute bottom-0 p-6">
                <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{e.category.toUpperCase()}</div>
                <div className="font-display text-xl font-bold mt-1">{e.title}</div>
                <div className="text-xs text-zinc-400 mt-1">{e.date} • {e.location}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 max-w-7xl mx-auto">
        <div className="relative rounded-[2rem] overflow-hidden glass-strong p-10 md:p-16 grain">
          <div className="absolute -top-10 -right-10 w-72 h-72 bg-[var(--pizo-coral)]/30 rounded-full blur-3xl"/>
          <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-[var(--pizo-gold)]/20 rounded-full blur-3xl"/>
          <div className="relative grid md:grid-cols-[1.3fr_0.7fr] gap-6 items-center">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-zinc-400">READY?</div>
              <h2 className="font-display text-4xl md:text-6xl font-black mt-2">
                Hoist the colors.<br/><span className="gold-text">Sail with PIZO.</span>
              </h2>
              <p className="text-zinc-300 mt-4 max-w-xl">Three plans, one crew. Start with Student, scale to Premium — the harbor is open.</p>
            </div>
            <div className="flex md:justify-end gap-3 flex-wrap">
              <Link to="/plans" data-testid="cta-plans-button" className="px-6 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow flex items-center gap-2">
                <Crown size={14}/> See Plans
              </Link>
              <Link to="/creators" data-testid="cta-creators-button" className="px-6 py-3 rounded-full glass hover:bg-white/10 text-white font-semibold flex items-center gap-2">
                <Trophy size={14}/> Creator Club
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function SectionHeader({ eyebrow, title, compact }) {
  return (
    <div className={compact ? "max-w-md" : "max-w-3xl"}>
      <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">{eyebrow}</div>
      <h2 className={`font-display font-black mt-3 leading-[1.05] ${compact? "text-3xl md:text-4xl" : "text-4xl md:text-6xl"}`}>{title}</h2>
    </div>
  );
}

function BentoCard({ icon, title, sub, desc, gradient = "from-white/5", span = "", children }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className={`relative overflow-hidden glass rounded-3xl p-7 hover-lift ${span}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} via-transparent to-transparent pointer-events-none`}/>
      <div className="relative flex flex-col h-full">
        <div className="w-12 h-12 rounded-2xl bg-[var(--pizo-coral)]/15 border border-[var(--pizo-coral)]/30 flex items-center justify-center text-[var(--pizo-coral-soft)]">{icon}</div>
        <div className="mt-5 flex items-center gap-3">
          <h3 className="font-display text-2xl font-bold">{title}</h3>
        </div>
        <div className="text-[11px] tracking-[0.3em] text-zinc-400 mt-1">{sub}</div>
        <p className="text-zinc-300 mt-3 leading-relaxed text-sm max-w-md">{desc}</p>
      </div>
      {children}
    </motion.div>
  );
}
