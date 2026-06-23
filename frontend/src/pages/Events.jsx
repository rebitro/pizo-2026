import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => { api.get("/events").then(r => setEvents(r.data)).catch(()=>{}); }, []);

  const next = () => setIdx((idx + 1) % Math.max(1, events.length));
  const prev = () => setIdx((idx - 1 + events.length) % Math.max(1, events.length));
  const current = events[idx];

  const register = async (eventId) => {
    if (!user) { toast.error("Sign in to register"); return; }
    try { await api.post(`/events/${eventId}/register`); toast.success("Registered! See you there 🏴‍☠️"); }
    catch { toast.error("Registration failed"); }
  };

  const isUpcoming = (d) => new Date(d) >= new Date();

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="events-page">
      <div className="text-center mb-12">
        <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">THE LOGBOOK</div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-3">Pirates raid <span className="gold-text">the calendar.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">College tournaments, BGMI cups, turf showdowns, creator meetups — flip through the highlights.</p>
      </div>

      {current && (
        <div className="relative rounded-[2rem] overflow-hidden glass" data-testid="events-carousel">
          <AnimatePresence mode="wait">
            <motion.div key={current.event_id}
              initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6 }}
              className="relative aspect-[16/9] md:aspect-[21/9]">
              <img src={current.image} className="absolute inset-0 w-full h-full object-cover" alt={current.title}/>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"/>
              <div className="absolute inset-0 flex items-end md:items-center p-8 md:p-14">
                <div className="max-w-xl">
                  <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{current.category.toUpperCase()}</div>
                  <h2 className="font-display text-3xl md:text-5xl font-black mt-3">{current.title}</h2>
                  <p className="text-zinc-300 mt-4">{current.description}</p>
                  <div className="flex flex-wrap gap-4 mt-5 text-sm text-zinc-300">
                    <div className="flex items-center gap-1"><Calendar size={14}/> {current.date}</div>
                    <div className="flex items-center gap-1"><MapPin size={14}/> {current.location}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {current.highlights?.map((h,i)=>(
                      <span key={i} className="px-3 py-1.5 rounded-full glass text-xs">{h}</span>
                    ))}
                  </div>
                  {isUpcoming(current.date) && (
                    <button onClick={()=>register(current.event_id)} data-testid={`event-register-${current.event_id}`}
                      className="mt-6 px-6 py-3 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow flex items-center gap-2">
                      <Ticket size={14}/> Register Now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-strong flex items-center justify-center text-white hover:bg-white/10" data-testid="event-prev">
            <ChevronLeft size={18}/>
          </button>
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full glass-strong flex items-center justify-center text-white hover:bg-white/10" data-testid="event-next">
            <ChevronRight size={18}/>
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
            {events.map((_,i)=>(
              <button key={i} onClick={()=>setIdx(i)} className={`h-1.5 rounded-full transition-all ${i===idx? "w-8 bg-[var(--pizo-gold)]":"w-3 bg-white/30"}`} data-testid={`carousel-dot-${i}`}/>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {events.map((e,i) => (
          <motion.button key={e.event_id} onClick={()=>setIdx(i)} whileHover={{ y: -6 }}
            className="relative rounded-3xl overflow-hidden aspect-[4/5] text-left group" data-testid={`event-tile-${i}`}>
            <img src={e.image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-700" alt={e.title}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"/>
            <div className="absolute bottom-0 p-5">
              <div className="text-[10px] tracking-[0.3em] text-[var(--pizo-gold)]">{e.category.toUpperCase()}</div>
              <div className="font-display text-lg font-bold mt-1">{e.title}</div>
              <div className="text-xs text-zinc-400 mt-1">{e.date}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </main>
  );
}
