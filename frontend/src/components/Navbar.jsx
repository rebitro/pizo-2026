import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, LayoutDashboard, Anchor } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LOGO_URL } from "@/lib/api";
import AuthModal from "@/components/AuthModal";

const links = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/venues", label: "Venues" },
  { to: "/find-pirate", label: "Find Pirate" },
  { to: "/events", label: "Events" },
  { to: "/creators", label: "Creators" },
  { to: "/merch", label: "Merch" },
  { to: "/plans", label: "Plans" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? "py-2" : "py-4"}`}
        data-testid="main-navbar"
      >
        <div className={`mx-3 md:mx-6 rounded-2xl ${scrolled ? "glass-strong" : "glass"} px-4 md:px-6 py-3 flex items-center justify-between`}>
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
            <img src={LOGO_URL} alt="PIZO" className="w-10 h-10 rounded-full object-cover ring-1 ring-[var(--pizo-gold)]/40" />
            <div className="flex flex-col leading-none">
              <span className="font-bebas text-2xl gold-text">PIZO</span>
              <span className="text-[10px] tracking-[0.3em] text-zinc-400">PIRATES OF PLAY</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase()}-link`}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-full transition-all ${
                    isActive ? "text-white bg-white/10" : "text-zinc-300 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => navigate(user.role === "owner" ? "/owner" : "/dashboard")}
                  data-testid="nav-dashboard-button"
                  className="hidden md:flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                >
                  <LayoutDashboard size={16} /> {user.name?.split(" ")[0] || "Me"}
                </button>
                <button
                  onClick={logout}
                  data-testid="nav-logout-button"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                data-testid="nav-join-button"
                className="text-sm px-5 py-2.5 rounded-full bg-[var(--pizo-coral)] hover:bg-[var(--pizo-coral-soft)] text-white font-bold coral-glow transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Anchor size={14} /> Join Now
              </button>
            )}
            <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-full bg-white/5 border border-white/10" data-testid="mobile-menu-toggle">
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="lg:hidden mx-3 mt-2 glass-strong rounded-2xl p-4 flex flex-col gap-1"
            >
              {links.map((l) => (
                <NavLink
                  key={l.to} to={l.to} onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-3 text-sm rounded-xl ${isActive ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5"}`
                  }
                  data-testid={`mobile-nav-${l.label.toLowerCase()}`}
                >
                  {l.label}
                </NavLink>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
