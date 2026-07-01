import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Features from "@/pages/Features";
import Events from "@/pages/Events";
import CreatorClub from "@/pages/CreatorClub";
import Plans from "@/pages/Plans";
import Venues from "@/pages/Venues";
import Contact from "@/pages/Contact";
import Dashboard from "@/pages/Dashboard";
import OwnerDashboard from "@/pages/OwnerDashboard";
import StaffLogin from "@/pages/StaffLogin";
import StaffQR from "@/pages/StaffQR";
import AuthCallback from "@/pages/AuthCallback";
import FindPirate from "@/pages/FindPirate";
import Merch from "@/pages/Merch";
import Admin from "@/pages/Admin";
import MyOrders from "@/pages/MyOrders";

function AppRouter() {
  const location = useLocation();
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/events" element={<Events />} />
        <Route path="/creators" element={<CreatorClub />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/venues" element={<Venues />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/find-pirate" element={<FindPirate />} />
        <Route path="/merch" element={<Merch />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/owner" element={<OwnerDashboard />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        <Route path="/staff/qr" element={<StaffQR />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster theme="dark" position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
