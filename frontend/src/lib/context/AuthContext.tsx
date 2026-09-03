"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchMe,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type LoopAuthorization,
} from "@/lib/api/auth";
import { getAuthToken } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";

type AuthContextValue = {
  user: ApiUser | null;
  loopAuthorization: LoopAuthorization | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    pin: string;
  }) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loopAuthorization, setLoopAuthorization] = useState<LoopAuthorization | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // Prevent double-redirect if multiple 401s fire simultaneously
  const expiredRef = useRef(false);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoopAuthorization(null);
      setLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me.user);
      setLoopAuthorization(me.loopAuthorization);
    } catch {
      apiSignOut();
      setUser(null);
      setLoopAuthorization(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Global 401 handler — any API call that gets a 401 fires this event
  useEffect(() => {
    function onExpired() {
      if (expiredRef.current) return;
      expiredRef.current = true;
      apiSignOut();
      setUser(null);
      setLoopAuthorization(null);
      router.replace("/signin?reason=expired");
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiSignIn({ email, password });
    setUser(data.user);
    setLoopAuthorization(data.loopAuthorization);
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      pin: string;
    }) => {
      const data = await apiSignUp(input);
      setUser(data.user);
      setLoopAuthorization(data.loopAuthorization);
    },
    [],
  );

  const signOut = useCallback(() => {
    apiSignOut();
    setUser(null);
    setLoopAuthorization(null);
  }, []);

  const value = useMemo(
    () => ({ user, loopAuthorization, loading, signIn, signUp, signOut, refresh }),
    [user, loopAuthorization, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
