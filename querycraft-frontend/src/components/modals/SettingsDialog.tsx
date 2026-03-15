'use client';

import React, { useState, useEffect } from "react";
import { Settings, User, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

// Define structures - repeated for component self-containment
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  lastActive: string;
}

type ThemePreference = 'light' | 'dark' | 'system';

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: ThemePreference;
    notifications: boolean;
    autoSave: boolean;
    defaultModel: string;
  };
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatSessions: ChatSession[];
  currentSessionId: string;
  userProfile: UserProfile;
  onDeleteSession: (sessionId: string) => void;
  onClearAllHistory: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  chatSessions,
  userProfile,
  onClearAllHistory
}: SettingsDialogProps) {
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const user = typeof window !== "undefined" ? localStorage.getItem("qc_user") : null;

  // Aurora palette (direct values)
  const primaryText = "#f8fafc";
  const mutedText = "#94a3b8";
  const borderColor = "rgba(30,41,59,0.88)";
  const cardBg = "linear-gradient(135deg, rgba(30,41,59,0.88) 0%, rgba(39,52,73,0.90) 100%)";
  const cardInactiveBg = "linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(18,24,38,0.88) 100%)";
  const destructiveColor = "#fb7185";

  // Sync state when dialog opens or userProfile prop changes
  useEffect(() => {
    setProfile(userProfile);
  }, [userProfile]);

  const formatStorageSize = (sessions: ChatSession[]) => {
    try {
      const dataSize = JSON.stringify(sessions).length;
      const sizeInKB = (dataSize / 1024).toFixed(2);
      return `${sizeInKB} KB`;
    } catch (error) {
      console.error(error);
      return '0 KB';
    }
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = event.target.value as ThemePreference;
    setProfile(p => ({
      ...p,
      preferences: { ...p.preferences, theme: newTheme }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[90vh] flex flex-col"
        style={{
          background: "linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(16,33,59,0.88) 100%)",
          border: `1px solid ${borderColor}`,
          color: primaryText,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)"
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2" style={{ color: primaryText }}>
            <Settings className="w-5 h-5" style={{ color: primaryText }} />
            <span>Settings</span>
          </DialogTitle>
          <DialogDescription style={{ color: mutedText }}>
            Manage your account and chat history preferences.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="account" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2" style={{ borderBottom: `1px solid ${borderColor}`, background: "transparent" }}>
            <TabsTrigger value="account" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User className="w-4 h-4" style={{ color: mutedText }} />
              <span style={{ color: primaryText }}>Account</span>
            </TabsTrigger>
            <TabsTrigger value="history" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare className="w-4 h-4" style={{ color: mutedText }} />
              <span style={{ color: primaryText }}>Chat History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="flex-1 mt-4 min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                <Card style={{ background: cardBg, border: `1px solid ${borderColor}`, color: primaryText }}>
                  <CardHeader>
                    <CardTitle style={{ color: primaryText }}>Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" style={{ color: primaryText }}>Display Name</Label>
                      <Input
                        id="name"
                        value={user ? JSON.parse(user).name : profile.name}
                        onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                        style={{ background: "#0f172a", border: `1px solid ${borderColor}`, color: primaryText }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" style={{ color: primaryText }}>Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user ? JSON.parse(user).email : profile.email}
                        onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                        style={{ background: "#0f172a", border: `1px solid ${borderColor}`, color: primaryText }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card style={{ background: cardBg, border: `1px solid ${borderColor}`, color: primaryText }}>
                  <CardHeader>
                    <CardTitle style={{ color: primaryText }}>Preferences</CardTitle>
                    <CardDescription style={{ color: mutedText }}>Customize your experience.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="theme-select" style={{ color: primaryText }}>Theme</Label>
                      <select
                        id="theme-select"
                        aria-label="Theme Preference"
                        value={profile.preferences.theme}
                        onChange={handleThemeChange}
                        style={{
                          background: "transparent",
                          border: `1px solid ${borderColor}`,
                          borderRadius: 6,
                          padding: "8px 10px",
                          color: primaryText
                        }}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-4 min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-6">
                <Card style={{ background: cardBg, border: `1px solid ${borderColor}`, color: primaryText }}>
                  <CardHeader>
                    <CardTitle style={{ color: primaryText }}>Storage Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold" style={{ color: primaryText }}>{chatSessions.length}</p>
                      <p className="text-sm" style={{ color: mutedText }}>Sessions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: primaryText }}>{chatSessions.reduce((acc, s) => acc + s.messages.length, 0)}</p>
                      <p className="text-sm" style={{ color: mutedText }}>Messages</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: primaryText }}>{formatStorageSize(chatSessions)}</p>
                      <p className="text-sm" style={{ color: mutedText }}>Used</p>
                    </div>
                  </CardContent>
                </Card>

                <Card style={{ background: cardInactiveBg, border: `1px solid ${borderColor}`, color: primaryText }}>
                  <CardHeader>
                    <CardTitle style={{ color: destructiveColor }}>Danger Zone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full" style={{ background: destructiveColor, color: primaryText }}>
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Clear All Chat History
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent style={{ background: cardInactiveBg, border: `1px solid ${borderColor}`, color: primaryText }}>
                        <AlertDialogHeader>
                          <AlertDialogTitle style={{ color: primaryText }}>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription style={{ color: mutedText }}>
                            This action cannot be undone. This will permanently delete all your chat sessions.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel style={{ background: "transparent", color: mutedText }}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={onClearAllHistory} style={{ background: destructiveColor, color: primaryText }}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
