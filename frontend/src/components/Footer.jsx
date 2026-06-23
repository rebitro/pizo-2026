import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Youtube, Twitter, Github, Anchor } from "lucide-react";
import { LOGO_URL } from "@/lib/api";

export default function Footer() {
  return (
    <footer className="relative mt-20 border-t border-white/5" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="PIZO" className="w-12 h-12 rounded-full ring-1 ring-[var(--pizo-gold)]/50" />
            <div>
              <div className="font-bebas text-3xl gold-text">PIZO</div>
              <div className="text-[10px] tracking-[0.35em] text-zinc-400">PIRATES OF PLAY</div>
            </div>
          </div>
          <p className="mt-5 text-zinc-400 max-w-md text-sm leading-relaxed">
            One pass. Every game. Built for the youth that refuses to sit still — turfs, gaming lounges, billiards & pickleball across India.
          </p>
          <div className="flex gap-3 mt-6">
            {[Instagram, Youtube, Twitter, Github].map((Icon, i) => (
              <a key={i} href="#" className="w-10 h-10 rounded-full glass hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition" data-testid={`footer-social-${i}`}>
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] tracking-[0.3em] text-zinc-500 mb-4">EXPLORE</div>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li><Link to="/venues" className="hover:text-white">Venues</Link></li>
            <li><Link to="/plans" className="hover:text-white">Plans</Link></li>
            <li><Link to="/events" className="hover:text-white">Events</Link></li>
            <li><Link to="/creators" className="hover:text-white">Creator Club</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.3em] text-zinc-500 mb-4">PIRATES</div>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
            <li><a href="#" className="hover:text-white">Become a Partner</a></li>
            <li><a href="#" className="hover:text-white">Terms</a></li>
            <li><a href="#" className="hover:text-white">Privacy</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5 py-5 px-6 flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto text-xs text-zinc-500 gap-2">
        <div className="flex items-center gap-2"><Anchor size={12} /> © {new Date().getFullYear()} PIZO. Set sail. Play more.</div>
        <div>Crafted for the crew. Eco-friendly venues. Verified & safe.</div>
      </div>
    </footer>
  );
}
