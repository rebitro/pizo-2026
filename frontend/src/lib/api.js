import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
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

export const LOGO_URL = "https://customer-assets.emergentagent.com/job_5138dde7-fb31-42b6-b878-d3f8be1c4d5f/artifacts/xbraui72_517247711_17859671220445839_4953795569973148132_n.jpg";
