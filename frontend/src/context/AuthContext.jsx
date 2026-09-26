import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiClient, extractErrorMessage } from "../api/client.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "gyan_sarthi_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await apiClient.get("/auth/me");
      setUser(data.user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await apiClient.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, "Could not sign in.") };
    }
  }, []);

  const loginAsAdmin = useCallback(async (email, password) => {
    try {
      const { data } = await apiClient.post("/auth/admin/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, "Could not sign in.") };
    }
  }, []);

  const register = useCallback(async ({ name, email, password, roleId, adminCode }) => {
    try {
      const { data } = await apiClient.post("/auth/register", { name, email, password, roleId, adminCode });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, "Could not create your account.") };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsAdmin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
