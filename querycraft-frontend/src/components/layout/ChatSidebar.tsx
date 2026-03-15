'use client';

import React, { useState, useEffect } from "react";
import { MessageSquare, Trash2, Plus, X, LogOut, Settings, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
// import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

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

interface UserProfile {
  name?: string;
  email?: string;
  avatar?: string;
}

interface ChatSidebarProps {
  chatSessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  isMobile?: boolean;
  onClose?: () => void;
  isAuthenticated: boolean;
  userProfile: UserProfile;
  onLogout: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chatSessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  isMobile = false,
  onClose,
  isAuthenticated,
  userProfile,
  onLogout
}) => {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  // Safely read localStorage user (guarded for SSR)
  const getLocalUser = (): { name?: string; email?: string } | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem("qc_user");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed as { name?: string; email?: string };
      return null;
    } catch {
      return null;
    }
  };

  const localUser = getLocalUser();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPreviewText = (messages?: Message[]) => {
    if (!messages || messages.length === 0) return "No messages";
    const previewMessage = messages[messages.length - 1];
    const content = previewMessage?.content ?? "";
    return content.length > 45 ? content.substring(0, 45) + "..." : content;
  };

  const getInitials = (profile?: { name?: string; email?: string }) => {
    const source = (profile?.name ?? profile?.email ?? "").trim();
    if (!source) return "?";
    const parts = source.split(/\s+/);
    if (parts.length >= 2) {
      const a = parts[0][0] ?? "";
      const b = parts[1][0] ?? "";
      return (a + b).toUpperCase();
    }
    return source.charAt(0).toUpperCase();
  };

  useEffect(() => {
    // Keep a lightweight debug but avoid noisy logs in production
    // console.debug('ChatSidebar userProfile changed', userProfile);
  }, [userProfile]);

  // Visual tokens (Option B: 88% opacity + aurora)
  const dialogBackground = `linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(16,33,59,0.88) 100%)`;
  const cardBg = `linear-gradient(135deg, rgba(30,41,59,0.88) 0%, rgba(39,52,73,0.90) 100%)`;
  const cardInactiveBg = `linear-gradient(135deg, rgba(11,18,32,0.88) 0%, rgba(18,24,38,0.88) 100%)`;
  const hoverAurora = `linear-gradient(145deg, rgba(14,165,233,0.10), rgba(168,85,247,0.08))`;
  const borderColor = `rgba(30,41,59,0.88)`; // used for 1px borders
  const accentSolid = `#1e293b`; // accent surface (selected)
  const textNormal = "#f8fafc";
  const textMuted = "#94a3b8";
  const destructive = "#7f1d1d";
  const highlight = "#0ea5e9";

  // typed mouse event helpers
  const handleButtonMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = hoverAurora;
  };
  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = 'transparent';
  };

  return (
    <div
      className="flex flex-col h-full shadow-lg"
      style={{
        background: dialogBackground,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRight: `1px solid ${borderColor}`
      }}
    >
      <div
        className="p-4 border-b"
        style={{
          background: `linear-gradient(135deg, rgba(11,18,32,0.88), rgba(11,18,32,0.86))`,
          borderBottom: `1px solid ${borderColor}`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: textNormal, fontWeight: 600 }}>Chat History</h2>
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              style={{ color: textNormal, background: 'transparent' }}
              onMouseEnter={handleButtonMouseEnter}
              onMouseLeave={handleButtonMouseLeave}
            >
              <X className="w-4 h-4" style={{ color: textNormal }} />
            </Button>
          )}
        </div>
        <Button
          onClick={onNewChat}
          className="w-full shadow-sm"
          style={{
            background: accentSolid,
            color: "#ffffff",
            border: `1px solid ${borderColor}`
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {chatSessions.length === 0 ? (
            <div className="text-center py-12" style={{ color: textMuted }}>
              <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: textMuted }} />
              <p>No chat history</p>
            </div>
          ) : (
            chatSessions.map((session) => {
              const selected = session.id === currentSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  onMouseEnter={() => setHoveredSession(session.id)}
                  onMouseLeave={() => setHoveredSession(null)}
                  className="p-3 rounded-lg cursor-pointer group relative"
                  style={{
                    background: selected ? cardBg : cardInactiveBg,
                    border: selected ? `1px solid ${highlight}` : `1px solid transparent`,
                    transition: 'background 150ms ease, box-shadow 150ms ease',
                    boxShadow: selected ? `0 6px 18px rgba(14,165,233,0.06)` : undefined
                  }}
                >
                  <h4 className="font-medium text-sm" style={{ color: textNormal }}>{session.title}</h4>
                  <p className="text-xs truncate" style={{ color: textMuted }}>{getPreviewText(session.messages)}</p>
                  <span className="text-xs" style={{ color: 'rgba(148,163,184,0.65)' }}>{formatDate(session.lastActive)}</span>

                  {(hoveredSession === session.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      className="h-7 w-7 absolute top-2 right-2"
                      style={{
                        color: textMuted,
                        background: 'transparent',
                        opacity: 1
                      }}
                      onMouseEnter={handleButtonMouseEnter}
                      onMouseLeave={handleButtonMouseLeave}
                    >
                      <Trash2 className="w-3.5 h-3.5" style={{ color: textNormal }} />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-4" style={{ borderTop: `1px solid ${borderColor}` }}>
        {isAuthenticated ? (
          <div className="flex items-center space-x-3">
            <Avatar>
              {userProfile?.avatar ? (
                <AvatarImage src={userProfile.avatar} alt={userProfile?.name ?? userProfile?.email ?? "User"} />
              ) : null}
              <AvatarFallback>{getInitials(userProfile)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: textNormal }}>
                {localUser?.name ?? userProfile?.name ?? "User"}
              </p>
              <p className="text-xs truncate" style={{ color: textMuted }}>
                {localUser?.email ?? userProfile?.email ?? ""}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  style={{ color: textMuted, background: 'transparent' }}
                  onMouseEnter={handleButtonMouseEnter}
                  onMouseLeave={handleButtonMouseLeave}
                >
                  <Settings className="w-4 h-4" style={{ color: textNormal }} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" style={{ background: cardBg, border: `1px solid ${borderColor}`, color: textNormal }}>
                <DropdownMenuItem asChild>
                  <button type="button" className="w-full text-left" onClick={onLogout} style={{ color: destructive }}>
                    <LogOut className="w-4 h-4 mr-2 inline" /> Sign Out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button variant="outline" className="w-full" style={{ border: `1px solid ${borderColor}`, color: textNormal }}>
            <LogIn className="w-4 h-4 mr-2" /> Sign In
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
