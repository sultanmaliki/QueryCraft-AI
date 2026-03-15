'use client';

import { useEffect, useRef } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

interface ChatWindowProps {
  messages: Message[];
  isTyping?: boolean;
  showWelcome?: boolean;
}

export function ChatWindow({ messages, isTyping = false, showWelcome = false }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    } catch (e) {
      console.warn('[ChatWindow] scroll error', e);
    }
  }, [messages, isTyping]);

  const shouldShowWelcome = (showWelcome && !isTyping) || (messages.length === 0 && !isTyping);

  return (
    <div className="flex-1 bg-transparent overflow-hidden">
      <ScrollArea className="h-full" ref={scrollRef}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          {shouldShowWelcome ? (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
              <div className="w-20 h-20 mb-6 rounded-2xl bg-card border flex items-center justify-center">
                <p className="text-3xl">🤖</p>
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-3">Welcome to QueryCraft</h2>
              <p className="text-muted-foreground max-w-md leading-relaxed">
                Your intelligent database assistant. Start by asking questions about your data.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message.content}
                  isUser={message.isUser}
                  timestamp={message.timestamp}
                />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
