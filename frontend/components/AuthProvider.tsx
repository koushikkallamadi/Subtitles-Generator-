"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { backendUrl } from "../lib/projects";

export type AuthUser = { id: string; name: string; email: string; picture: string | null; credits: number };
type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  requireLogin: (action?: () => void, next?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/auth/me`, { credentials: "include", cache: "no-store" });
      if (!response.ok) { setUser(null); return null; }
      const current = await response.json() as AuthUser;
      setUser(current);
      return current;
    } catch {
      setUser(null);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const requireLogin = useCallback(async (action?: () => void, next = "/") => {
    let current = user;
    if (loading) current = await refreshUser();
    if (current) { action?.(); return true; }
    const returnPath = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
    window.location.assign(`/login?next=${encodeURIComponent(returnPath)}`);
    return false;
  }, [loading, refreshUser, user]);

  const logout = useCallback(async () => {
    try { await fetch(`${backendUrl}/auth/logout`, { method: "POST", credentials: "include" }); }
    catch { /* clear local account state even if the backend session is unreachable */ }
    finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, requireLogin, logout, refreshUser }), [user, loading, requireLogin, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
