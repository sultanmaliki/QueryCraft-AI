// hooks/useAutoLogin.ts
import { useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type ServerUser = {
  _id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
};

export type UserProfile = {
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    autoSave: boolean;
    defaultModel: string;
  };
  _id?: string;
  role?: string;
  createdAt?: string;
} | null;

function mapServerUserToUserProfile(serverUser: ServerUser | null | undefined): UserProfile {
  if (!serverUser) return null;
  return {
    name: serverUser.name,
    email: serverUser.email,
    avatar: undefined,
    preferences: {
      theme: 'system',
      notifications: true,
      autoSave: true,
      defaultModel: 'qwen:4b'
    },
    _id: serverUser._id,
    role: serverUser.role,
    createdAt: serverUser.createdAt
  };
}

export function useAutoLogin(onSuccess: (u: UserProfile) => void, onFailure?: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('qc_token');
    const rawUser = localStorage.getItem('qc_user');

    if (!token || !rawUser) {
      onFailure?.();
      return;
    }

    try {
      JSON.parse(rawUser);
    } catch {
      localStorage.removeItem('qc_user');
      localStorage.removeItem('qc_token');
      onFailure?.();
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          signal
        });

        if (!res.ok) {
          localStorage.removeItem('qc_user');
          localStorage.removeItem('qc_token');
          onFailure?.();
          return;
        }

        const body = await res.json() as unknown;
        let serverUserObj: Record<string, unknown> | undefined;

        if (body && typeof body === 'object') {
          const bodyObj = body as Record<string, unknown>;
          if ('user' in bodyObj && typeof bodyObj.user === 'object') {
            serverUserObj = bodyObj.user as Record<string, unknown>;
          } else {
            serverUserObj = bodyObj;
          }
        }

        if (!serverUserObj) {
          localStorage.removeItem('qc_user');
          localStorage.removeItem('qc_token');
          onFailure?.();
          return;
        }

        try {
          localStorage.setItem('qc_user', JSON.stringify(serverUserObj));
        } catch {
          // ignore
        }

        const profile = mapServerUserToUserProfile(serverUserObj as unknown as ServerUser);
        onSuccess(profile);
      } catch (err) {
        if (!signal.aborted) {
          onFailure?.();
        }
        // still helpful to log the error for debugging

        console.error(err);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [onSuccess, onFailure]);
}
