import axios from "axios";

const AUTH_STORAGE_KEY = "examgrade_auth";

/**
 * API origin. Set `VITE_API_URL` in `.env` (e.g. `http://localhost:3000`) for direct calls.
 * Leave unset in development to use same-origin URLs and the Vite dev proxy (`/api` → Express).
 */
function resolveBaseURL() {
  const raw = import.meta.env.VITE_API_URL;
  if (raw != null && String(raw).trim() !== "") {
    return String(raw).replace(/\/$/, "");
  }
  return "";
}

export const api = axios.create({
  baseURL: resolveBaseURL(),
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      /* ignore */
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url ?? "");
    const isLoginAttempt = reqUrl.includes("/api/auth/login");
    if (status === 401 && !isLoginAttempt) {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (typeof window !== "undefined") {
        window.location.assign("/");
      }
    }
    return Promise.reject(error);
  }
);
