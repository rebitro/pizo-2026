import React, { useRef } from "react";
import { motion } from "framer-motion";
import { X, Download, Anchor } from "lucide-react";
import { LOGO_URL } from "@/lib/api";

export default function CaptainsCard({ venue, onClose }) {
  const svgRef = useRef(null);
  if (!venue) return null;
  const qrData = encodeURIComponent(`https://pizo.app/venues/${venue.venue_id}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=050505&bgcolor=D4AF37&margin=10&data=${qrData}`;

  const download = async () => {
    const svg = svgRef.current; if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 1200;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 800, 1200);
      canvas.toBlob((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `PIZO-Captain-${venue.name.replace(/\s+/g,"-")}.png`;
        a.click();
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{scale:0.9}} animate={{scale:1}} onClick={(e)=>e.stopPropagation()}
        className="glass-strong rounded-3xl p-5 max-w-md w-full" data-testid="captains-card-modal">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-xl font-bold">Captain's Card</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5"><X size={16}/></button>
        </div>
        <svg ref={svgRef} viewBox="0 0 800 1200" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-2xl mt-4">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a0a0a"/><stop offset="100%" stopColor="#1a1208"/>
            </linearGradient>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f7e08a"/><stop offset="100%" stopColor="#b8860b"/>
            </linearGradient>
          </defs>
          <rect width="800" height="1200" fill="url(#bg)"/>
          <rect x="20" y="20" width="760" height="1160" rx="40" fill="none" stroke="url(#gold)" strokeWidth="3"/>
          <image href={LOGO_URL} x="280" y="80" width="240" height="240"/>
          <text x="400" y="400" textAnchor="middle" fontFamily="Bebas Neue, sans-serif" fontSize="80" fill="url(#gold)" letterSpacing="6">PIZO</text>
          <text x="400" y="440" textAnchor="middle" fontFamily="Manrope" fontSize="18" fill="#aaa" letterSpacing="8">PIRATES OF PLAY</text>
          <line x1="200" y1="490" x2="600" y2="490" stroke="url(#gold)" strokeWidth="2"/>
          <text x="400" y="560" textAnchor="middle" fontFamily="Syne, sans-serif" fontWeight="800" fontSize="46" fill="#fff">{venue.name.length>22?venue.name.slice(0,22)+"…":venue.name}</text>
          <text x="400" y="610" textAnchor="middle" fontFamily="Manrope" fontSize="22" fill="#D4AF37">{venue.city} • {venue.category.toUpperCase()}</text>
          {venue.verified && <text x="400" y="650" textAnchor="middle" fontFamily="Manrope" fontWeight="700" fontSize="18" fill="#6ee7b7">✓ PIRATES VERIFIED</text>}
          <image href={qrUrl} x="250" y="700" width="300" height="300"/>
          <text x="400" y="1050" textAnchor="middle" fontFamily="Manrope" fontWeight="700" fontSize="22" fill="#fff">SCAN TO BOOK</text>
          <text x="400" y="1085" textAnchor="middle" fontFamily="Manrope" fontSize="16" fill="#888">Play More. Pay Less.</text>
          <text x="400" y="1140" textAnchor="middle" fontFamily="Manrope" fontSize="14" fill="#555">crewpizo.in@gmail.com • +91 76788 71048</text>
        </svg>
        <button onClick={download} data-testid="captains-card-download"
          className="w-full mt-4 py-3 rounded-full bg-[var(--pizo-coral)] text-white font-bold coral-glow flex items-center justify-center gap-2">
          <Download size={14}/> Download PNG
        </button>
        <p className="text-[10px] text-zinc-500 mt-2 text-center">Print A4 size & stick at your venue 🏴‍☠️</p>
      </motion.div>
    </div>
  );
}
