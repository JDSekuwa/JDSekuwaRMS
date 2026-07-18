"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize client-side Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setRole(session.user.app_metadata?.role || "WORKER");
        }
      } catch (err) {
        console.error("Error retrieving initial session:", err);
      } finally {
        setLoading(false);
      }
    }

    getInitialSession();

    // Listen for auth changes to sync state across tabs and actions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setRole(session.user.app_metadata?.role || "WORKER");
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    try {
      // Clear cookies/tokens via Next.js backend endpoint
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("API logout call failed:", e);
    }
    // Sign out from Supabase client
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  // Inactivity tracking (10 minutes)
  useEffect(() => {
    if (!user) return;

    let lastWriteTime = Date.now();

    // Helper to update the last activity cookie client-side (throttled to once every 10 seconds)
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastWriteTime > 10000) { // 10 seconds throttle
        lastWriteTime = now;
        document.cookie = `rms_last_activity=${now}; path=/; max-age=600; SameSite=Lax`;
      }
    };

    // Listen to user activity events
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity);
    });

    // Periodically check if session has expired
    const interval = setInterval(() => {
      const match = document.cookie.match(/(?:^|; )rms_last_activity=([^;]*)/);
      const lastActivityVal = match ? match[1] : null;
      
      if (!lastActivityVal) {
        // Cookie expired or missing
        console.warn("Inactivity timeout: rms_last_activity cookie is missing.");
        signOut();
      } else {
        const lastActivity = parseInt(lastActivityVal, 10);
        if (isNaN(lastActivity) || Date.now() - lastActivity > 10 * 60 * 1000) {
          console.warn("Inactivity timeout: session expired.");
          signOut();
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [user, signOut]);

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
