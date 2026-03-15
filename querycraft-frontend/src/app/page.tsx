"use client";

import { useState, useEffect } from "react";
import { IntroPage } from "@/components/pages/IntroPage";
import { AuthPage } from "@/components/pages/AuthPage";
import { ChatApp } from "@/components/pages/ChatApp";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    autoSave: boolean;
    defaultModel: string;
  };
}

type AppView = 'intro' | 'auth' | 'chat';

export default function Home() {
  const [currentView, setCurrentView] = useState<AppView>('intro');
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "QueryCraft User",
    email: "user@querycraft.ai",
    preferences: {
      theme: 'system',
      notifications: true,
      autoSave: true,
      defaultModel: 'qwen'
    }
  });

  // Auto-login if qc_token exists
  useEffect(() => {
    const token = localStorage.getItem("qc_token");
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUserProfile(prev => ({
            ...prev,
            name: data.name ?? prev.name,
            email: data.email ?? prev.email,
            avatar: (data.avatar ?? prev.avatar),
          }));
          setCurrentView("chat");
        } else {
          localStorage.removeItem("qc_token");
          localStorage.removeItem("qc_user");
          setCurrentView("intro");
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        localStorage.removeItem("qc_token");
        localStorage.removeItem("qc_user");
        setCurrentView("intro");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Handlers ---
  const handleShowAuth = () => setCurrentView('auth');
  const handleBackToIntro = () => setCurrentView('intro');

  const handleLogin = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("qc_token", data.token);
        localStorage.setItem("qc_user", JSON.stringify(data.user));
        setUserProfile(prev => ({ ...prev, name: data.user.name, email: data.user.email }));
        setCurrentView("chat");
        toast.success("Successfully logged in", {
          description: "Welcome back to QueryCraft!",
        });
      } else {
        toast.error("Login failed", {
          description: "Invalid email or password",
        });
      }
    } catch {
      toast.error("Login failed", { description: "Server error" });
    }
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("qc_token", data.token);
        localStorage.setItem("qc_user", JSON.stringify(data.user));
        setUserProfile(prev => ({ ...prev, name: data.user.name, email: data.user.email }));
        setCurrentView("chat");
        toast.success("Account created successfully", {
          description: "Welcome to QueryCraft!",
        });
      } else {
        toast.error("Sign up failed", { description: "Could not create account" });
      }
    } catch {
      toast.error("Sign up failed", { description: "Server error" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("qc_token");
    localStorage.removeItem("qc_user");
    setCurrentView("intro");
    toast("Successfully logged out");
  };

  // const handleUpdateProfile = (profile: UserProfile) => {
  //   setUserProfile(profile);
  //   toast.success("Profile updated successfully");
  // };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  // --- Render Logic ---
  switch (currentView) {
    case 'intro':
      return <IntroPage onShowAuth={handleShowAuth} />;
    case 'auth':
      return <AuthPage onLogin={handleLogin} onSignUp={handleSignUp} onBack={handleBackToIntro} />;
    case 'chat':
      return <ChatApp userProfile={userProfile} onLogout={handleLogout} />;
    default:
      return <IntroPage onShowAuth={handleShowAuth} />;
  }
}
