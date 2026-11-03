import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("ontrack_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("ontrack_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  function login(newToken: string, newUser: AuthUser) {
    localStorage.setItem("ontrack_token", newToken);
    localStorage.setItem("ontrack_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("ontrack_token");
    localStorage.removeItem("ontrack_user");
    setToken(null);
    setUser(null);
  }

  // api.ts fires this after any request comes back 401 (expired/invalid/unverifiable token) --
  // it already cleared localStorage itself, this just drops the in-memory state so RequireAuth
  // re-renders and sends the user back to the login screen instead of leaving the app stuck.
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null);
      setUser(null);
    }
    window.addEventListener("ontrack:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("ontrack:unauthorized", handleUnauthorized);
  }, []);

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
