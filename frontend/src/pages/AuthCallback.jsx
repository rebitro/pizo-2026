import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/"); return; }
    const session_id = m[1];

    (async () => {
      try {
        await api.post("/auth/google/session", { session_id });
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true });
        window.location.reload();
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="glass rounded-2xl px-8 py-6 text-zinc-300 text-sm">Setting sail…</div>
    </div>
  );
}
