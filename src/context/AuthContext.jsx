import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("name, role, initials, badge")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("Could not load profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email).trim(),
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: profile?.name || session.user.email,
        role: profile?.role || "Administrator",
        initials: profile?.initials || "AO",
        badge: profile?.badge || null,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated: !!session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
