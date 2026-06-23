import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare, User as UserIcon, Send, Phone, MapPin, Instagram, Youtube, Twitter } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/contact", form);
      toast.success("Message dispatched — the crew responds within 24h!");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      toast.error("Could not send. Try again.");
    } finally { setSending(false); }
  };

  return (
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto" data-testid="contact-page">
      <div className="text-center">
        <div className="text-[10px] tracking-[0.35em] text-[var(--pizo-gold-soft)]">CONTACT</div>
        <h1 className="font-display text-5xl md:text-7xl font-black mt-3">Signal the <span className="gold-text">flagship.</span></h1>
        <p className="text-zinc-300 mt-5 max-w-2xl mx-auto">Got a venue to partner? A press question? Or just want to join the Pirates crew? Send word.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mt-14">
        <motion.form onSubmit={submit} initial={{opacity:0, x:-30}} whileInView={{opacity:1, x:0}} viewport={{once:true}}
          className="glass rounded-3xl p-7" data-testid="contact-form">
          <div className="space-y-4">
            <Field icon={<UserIcon size={14}/>} label="NAME" testid="contact-name" value={form.name} onChange={v=>setForm({...form,name:v})}/>
            <Field icon={<Mail size={14}/>} label="EMAIL" type="email" testid="contact-email" value={form.email} onChange={v=>setForm({...form,email:v})}/>
            <div>
              <label className="text-[10px] tracking-[0.3em] text-zinc-400">MESSAGE</label>
              <div className="mt-2 flex items-start gap-2 bg-black/40 border border-white/10 rounded-xl px-3 focus-within:border-[var(--pizo-coral)] transition">
                <MessageSquare size={14} className="text-zinc-500 mt-3"/>
                <textarea value={form.message} onChange={(e)=>setForm({...form,message:e.target.value})}
                  required rows={5}
                  className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-zinc-500 outline-none resize-none"
                  placeholder="Tell us your story..."
                  data-testid="contact-message"/>
              </div>
            </div>
          </div>
          <button type="submit" disabled={sending}
            data-testid="contact-submit"
            className="w-full mt-6 py-3.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow flex items-center justify-center gap-2 disabled:opacity-60">
            <Send size={14}/> {sending ? "Sending..." : "Send Signal"}
          </button>
        </motion.form>

        <motion.div initial={{opacity:0, x:30}} whileInView={{opacity:1, x:0}} viewport={{once:true}} className="space-y-5">
          <div className="glass rounded-3xl p-7">
            <div className="text-[10px] tracking-[0.3em] text-zinc-400">DROP BY</div>
            <div className="flex items-center gap-2 mt-3 text-sm"><MapPin size={14} className="text-[var(--pizo-gold)]"/> Barasirohi, Kalyanpur, Kanpur, Uttar Pradesh</div>
            <div className="flex items-center gap-2 mt-2 text-sm"><Phone size={14} className="text-[var(--pizo-gold)]"/> +91 76788 71048</div>
            <div className="flex items-center gap-2 mt-2 text-sm"><Mail size={14} className="text-[var(--pizo-gold)]"/> crewpizo.in@gmail.com</div>
            <div className="flex gap-3 mt-5">
              {[Instagram, Youtube, Twitter].map((Icon, i)=>(
                <a key={i} href="#" className="w-10 h-10 rounded-full glass-strong hover:bg-white/10 flex items-center justify-center transition"><Icon size={14}/></a>
              ))}
            </div>
          </div>

          <motion.div className="glass rounded-3xl overflow-hidden relative aspect-[16/10]" whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }}>
            <iframe
              title="PIZO HQ Map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=72.864%2C19.063%2C72.876%2C19.069&layer=mapnik"
              className="w-full h-full grayscale contrast-110 brightness-75 hue-rotate-180"
              loading="lazy"
            />
            <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-3xl"/>
            <div className="absolute bottom-4 left-4 glass-strong rounded-full px-4 py-2 text-xs flex items-center gap-2">
              <MapPin size={12} className="text-[var(--pizo-coral)]"/> Barasirohi, Kanpur
            </div>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}

function Field({ icon, label, type = "text", value, onChange, testid }) {
  return (
    <div>
      <label className="text-[10px] tracking-[0.3em] text-zinc-400">{label}</label>
      <div className="mt-2 flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 focus-within:border-[var(--pizo-coral)] transition">
        <span className="text-zinc-500">{icon}</span>
        <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} required
          className="flex-1 bg-transparent py-3 text-sm text-white outline-none" data-testid={testid}/>
      </div>
    </div>
  );
}
