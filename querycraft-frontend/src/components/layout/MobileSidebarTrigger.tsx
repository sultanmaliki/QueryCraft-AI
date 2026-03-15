'use client';

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChatSidebar } from "./ChatSidebar";

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

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

interface MobileSidebarTriggerProps {
  chatSessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
  isAuthenticated: boolean;
  userProfile: UserProfile;
  onLogout: () => void;
}

export function MobileSidebarTrigger({
  chatSessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  isAuthenticated,
  userProfile,
  onLogout
}: MobileSidebarTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // Aurora-styled icon button (direct hex)
          style={{
            color: "#94a3b8", // muted text
            background: "transparent",
            borderRadius: 8,
            padding: 6,
          }}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="p-0 w-80"
        // Aurora panel background + subtle border to match sidebar-aurora
        style={{
          background: "linear-gradient(180deg, rgba(2,8,23,0.95), rgba(2,8,23,0.98))",
          color: "#f8fafc",
          borderRight: "1px solid rgba(14,165,233,0.15)",
          boxShadow: "0 8px 30px rgba(2,8,23,0.6)",
        }}
      >
        <ChatSidebar
          chatSessions={chatSessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onNewChat={onNewChat}
          isMobile={true}
          onClose={() => setIsOpen(false)}
          isAuthenticated={isAuthenticated}
          userProfile={userProfile}
          onLogout={onLogout}
        />
      </SheetContent>
    </Sheet>
  );
}
