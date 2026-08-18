import { createContext, useContext, useState, type ReactNode } from "react";
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

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
