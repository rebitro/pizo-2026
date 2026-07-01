import React, { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function StaffQR() {
  const [bookingId, setBookingId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = React.createRef();

  const submit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("staff_token");
    if (!token) { toast.error("Not logged in as staff"); return; }
    setVerifying(true);
    try {
      const r = await api.post(`/staff/verify-qr`, null, { params: { booking_id: bookingId }, headers: { token } });
      toast.success("Booking verified");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err.message || "Verify failed");
    } finally { setVerifying(false); }
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      const tracks = videoRef.current?.srcObject?.getTracks() || [];
      tracks.forEach(t => t.stop());
      setCameraOn(false);
      videoRef.current.srcObject = null;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setCameraOn(true);
    } catch (e) {
      toast.error('Camera access denied or not available');
    }
  };

  return (
    <main className="pt-24 max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">QR Scanner (manual)</h2>
      <p className="text-sm text-zinc-400 mb-4">Paste booking id (or scanned QR payload) and verify.</p>
      <form onSubmit={submit} className="space-y-3">
        <input value={bookingId} onChange={e=>setBookingId(e.target.value)} placeholder="booking_..." className="w-full p-2 rounded bg-black/40" />
        <button className="py-2 px-4 rounded bg-[var(--pizo-coral)] text-white" disabled={verifying}>{verifying?"Verifying...":"Verify"}</button>
      </form>
      <div className="mt-4">
        <button onClick={toggleCamera} className="py-2 px-3 rounded-full bg-white/5 text-sm">{cameraOn? 'Stop Camera' : 'Scan via Camera'}</button>
        {cameraOn && <div className="mt-3"><video ref={videoRef} className="w-full rounded-md" playsInline muted/></div>}
        <div className="text-xs text-zinc-400 mt-2">Camera scan is a preview only; use a dedicated QR scanner app to read code into the input if automatic decoding isn't available.</div>
      </div>
    </main>
  );
}
