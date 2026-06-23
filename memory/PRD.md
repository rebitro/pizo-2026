# PIZO - Pirates of Play

## Original Problem Statement
Build a complete modern website for an entertainment aggregator platform called "PIZO" — premium youthful cinematic glassmorphism, gold pirate ship branding, subscription pass (₹999/mo), venue aggregation (turfs/billiards/gaming/pickleball), creator club with leaderboard, user & owner dashboards, Google + JWT auth, Razorpay/UPI payments, contact form with map, SEO + sitemap.

## Architecture
- Backend: FastAPI + MongoDB (motor). Routes prefixed `/api`. JWT auth + Emergent Google OAuth (cookie session). Auto-seeds 6 venues, 4 events, 6 creators on startup.
- Frontend: React 19 + React Router 7 + Framer Motion + Tailwind + shadcn UI + Recharts. Glassmorphism dark theme (Obsidian Black + Pirate Gold #D4AF37 + Coral #FF5E3A). Fonts: Syne (display) + Bebas Neue + Manrope.

## Implemented (Feb 2026 — MVP 1)
- Homepage with hero, animated logo, marquee, bento features, venue/event previews, CTA
- Features page (6-card grid)
- Events page with cinematic carousel + tile grid
- Creator Club with Face/Model of the Month, filters, podium, animated leaderboard rows, badges
- Plans page (Student ₹599, Premium ₹999, Family ₹1499) + UPI subscription flow (mocked Razorpay)
- Venues page with category/city filters, search, booking modal with date + slot
- Contact page with animated form + OpenStreetMap embed + social links
- User Dashboard (bookings, badges, active subscription)
- Owner Dashboard (venue CRUD, footfall/revenue stats, Recharts line+bar)
- Auth Modal (JWT login/register + Google OAuth button)
- AuthCallback route with race-safe session_id processing
- Navbar with sticky glass, mobile drawer, Sonner toasts, Footer
- SEO: meta tags, OG image, sitemap.xml, robots.txt

## User Personas
1. Player (youth, 16-28) — books, subscribes, climbs creator leaderboard
2. Venue Owner — lists venues, tracks footfall/revenue
3. Creator — gets featured, monthly rewards

## Backlog (P1 / next iteration)
- Razorpay real payment (need API keys)
- Reel upload + video gallery on Creator Club
- Booking conflict detection & real availability calendar
- Owner payouts dashboard
- Notifications/email confirmations
- Parallax scroll effects throughout

## Next Tasks
- Add Razorpay live integration once user provides Key ID + Secret
- Wire reel upload (object storage)
- Production-ready map (Mapbox/Google) once key provided
