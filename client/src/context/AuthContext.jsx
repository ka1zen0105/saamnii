import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { api, AUTH_STORAGE_KEY } from "../api/index.js";

const STORAGE_KEY = AUTH_STORAGE_KEY;

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    return {
      userId: data.userId ?? data.sub,
      role: data.role,
      email: data.email ?? null,
      name: data.name ?? null,
      contact: data.contact ?? null,
      subjectCodes: Array.isArray(data.subjectCodes) ? data.subjectCodes : [],
      assignedClasses: Array.isArray(data.assignedClasses)
        ? data.assignedClasses
        : [],
    };
  } catch {
    return null;
  }
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw);
    const token = parsed?.token ?? null;
    let user = parsed?.user ?? null;
    if (token && !user) {
      user = decodeJwtPayload(token);
    }
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => loadStored());

  const login = useCallback(async (identifier, password) => {
    try {
      const { data } = await api.post("/api/auth/login", {
        email: identifier,
        userId: identifier,
        password,
      });
      const token = data?.token;
      if (!token || typeof token !== "string") {
        throw new Error("No token in response");
      }
      const user = decodeJwtPayload(token);
      const next = { token, user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setState(next);
      return next;
    } catch (err) {
      const msg = err?.message;
      const noResponse = err?.code === "ERR_NETWORK" || msg === "Network Error";
      if (noResponse) {
        throw new Error(
          "Cannot reach the API. Start the server (e.g. npm run dev in /server), use npm run dev for the client, and ensure the API is on port 3000 (or set VITE_API_URL for production)."
        );
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ token: null, user: null });
  }, []);

  const value = useMemo(
    () => ({
      token: state.token,
      user: state.user,
      login,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state.token, state.user, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
