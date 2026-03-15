// components/auth/AuthProviderClient.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Preferences = {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoSave: boolean;
  defaultModel: string;
};

export type UserProfile = {
  name: string;
  email: string;
  avatar?: string | null;
  preferences: Preferences;
  _id?: string;
  role?: string;
  createdAt?: string;
} | null;

interface AuthContextShape {
  user: UserProfile;
  loading: boolean;
  login: (token: string, userObj: Partial<ServerUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

interface ServerUser {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  defaultModel?: string | null;
  _id?: string | null;
  role?: string | null;
  createdAt?: string | null;
  [k: string]: unknown;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  notifications: true,
  autoSave: true,
  defaultModel: 'qwen:4b'
};

function normalizeServerUser(u: Partial<ServerUser> | null | undefined): UserProfile {
  if (!u) return null;
  const name = (u.name ?? '') as string;
  const email = (u.email ?? '') as string;
  if (!name && !email) return null;

  const prefs: Preferences = {
    ...DEFAULT_PREFERENCES,
    defaultModel: (u.defaultModel as string) ?? DEFAULT_PREFERENCES.defaultModel
  };

  return {
    name: name || (email ?? 'Unknown user'),
    email: email || 'unknown@example.com',
    avatar: (u.avatar ?? null) as string | null,
    preferences: prefs,
    _id: u._id ?? undefined,
    role: u.role ?? undefined,
    createdAt: u.createdAt ?? undefined
  };
}

export default function AuthProviderClient({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (typeof window === 'undefined') return;

      const token = localStorage.getItem('qc_token');
      const rawUser = localStorage.getItem('qc_user');

      if (!token || !rawUser) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // Try parsing cached user safely
      let cached: Partial<ServerUser> | null = null;
      try {
        const parsed = JSON.parse(rawUser);
        if (typeof parsed === 'object' && parsed !== null) {
          cached = parsed as Partial<ServerUser>;
          if (mounted) setUser(normalizeServerUser(cached));
        } else {
          localStorage.removeItem('qc_user');
          localStorage.removeItem('qc_token');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }
      } catch {
        localStorage.removeItem('qc_user');
        localStorage.removeItem('qc_token');
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // Validate token with server (defensive)
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
        const res = await fetch(`${base}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('qc_token') ?? ''}`
          }
        });

        if (!res.ok) {
          localStorage.removeItem('qc_user');
          localStorage.removeItem('qc_token');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // parse and normalize server response (type-safe)
        const body = (await res.json()) as unknown;
        let serverUserObj: Record<string, unknown> | undefined;

        if (body && typeof body === 'object') {
          const bodyObj = body as Record<string, unknown>;
          if ('user' in bodyObj && typeof bodyObj.user === 'object') {
            serverUserObj = bodyObj.user as Record<string, unknown>;
          } else {
            serverUserObj = bodyObj;
          }
        }

        if (!serverUserObj || typeof serverUserObj !== 'object') {
          localStorage.removeItem('qc_user');
          localStorage.removeItem('qc_token');
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        const mapped = normalizeServerUser(serverUserObj as Partial<ServerUser>);

        try {
          localStorage.setItem('qc_user', JSON.stringify(serverUserObj));
        } catch {
          // ignore localStorage set failures
        }

        if (mounted) {
          setUser(mapped);
          setLoading(false);
        }
      } catch (err) {
        // network / unexpected error -> fall back to unauthenticated
        console.error('[AuthProvider] token validation error', err);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const login = (token: string, userObj: Partial<ServerUser>) => {
    try {
      localStorage.setItem('qc_token', token);
      localStorage.setItem('qc_user', JSON.stringify(userObj ?? {}));
    } catch {
      // ignore localStorage set errors
    }
    setUser(normalizeServerUser(userObj ?? null));
  };

  const logout = () => {
    try {
      localStorage.removeItem('qc_token');
      localStorage.removeItem('qc_user');
    } catch {
      // ignore
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <div className="h-screen w-full flex items-center justify-center">
          <div className="text-sm opacity-80">Validating session…</div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
