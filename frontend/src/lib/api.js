import axios from "axios";

const DEFAULT_BACKEND_URL = process.env.NODE_ENV === "production"
  ? "https://pizo-2026-1.onrender.com"
  : "";
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("pizo_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Notify frontend when responses include wallet balance info
api.interceptors.response.use((resp) => {
  try {
    const data = resp && resp.data;
    let wallet = null;
    if (data && typeof data === 'object') {
      if (typeof data.wallet_balance !== 'undefined') wallet = data.wallet_balance;
      else if (data.user && typeof data.user.wallet_balance !== 'undefined') wallet = data.user.wallet_balance;
    }
    if (wallet !== null) {
      try { window.dispatchEvent(new CustomEvent('pizo:wallet_update', { detail: { wallet_balance: wallet } })); } catch (e) {}
    }
  } catch (e) {}
  return resp;
}, (err) => Promise.reject(err));

export const LOGO_URL = "/images/pizo-pirate-logo.jpg";
