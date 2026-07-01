import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function StaffLogin() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/staff/login", { staff_id: staffId, password });
      const token = r.data?.token;
      if (!token) throw new Error("No token returned");
      localStorage.setItem("staff_token", token);
      toast.success("Staff login successful");
      nav("/staff/qr");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <main className="pt-24 max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Staff Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs text-zinc-400">Staff ID</label>
          <input className="w-full mt-1 p-2 rounded bg-black/40" value={staffId} onChange={e=>setStaffId(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Password</label>
          <input type="password" className="w-full mt-1 p-2 rounded bg-black/40" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="py-2 px-4 rounded bg-[var(--pizo-coral)] text-white" disabled={loading}>{loading?"Logging in...":"Login"}</button>
      </form>
      <div className="mt-4 text-sm text-zinc-400">Need to verify bookings? <a href="/staff/qr" className="text-white font-semibold hover:text-[var(--pizo-gold)]">Open QR verify</a></div>
    </main>
  );
}
