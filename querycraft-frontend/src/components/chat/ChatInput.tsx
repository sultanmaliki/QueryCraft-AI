"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// --- Types for SpeechRecognition ---

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  length: number;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognitionLike;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionLike;
    };
  }
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseMessageRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      setIsSpeechSupported(false);
      toast.error("Voice input unavailable", {
        description: "Your browser doesn’t support speech recognition. Try Chrome or Edge.",
      });
      return;
    }

    setIsSpeechSupported(true);

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false; // final result only

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const resultsArray = Array.from(event.results);
      const transcript = resultsArray
        .map((result) => result[0].transcript)
        .join(" ");

      const base = baseMessageRef.current.trim();
      const combined = base ? `${base} ${transcript}` : transcript;

      setMessage(combined);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const toggleListening = () => {
    if (!isSpeechSupported || disabled) {
      if (!isSpeechSupported) {
        toast.error("Voice input unavailable", {
          description: "Your browser doesn’t support speech recognition. Try Chrome or Edge.",
        });
      }
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (!isListening) {
      try {
        baseMessageRef.current = message;
        setIsListening(true);
        recognition.start();
      } catch {
        setIsListening(false);
      }
    } else {
      recognition.stop();
      setIsListening(false);
    }
  };

  const showGlow = isListening || isFocused;

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur-lg border-t border-border px-4 py-3 sm:px-6 sm:py-4">
      <div className="max-w-3xl mx-auto">
        <div
          className={`relative flex items-end space-x-2 rounded-2xl border p-4 transition-all duration-200 bg-gradient-to-br from-[#020817] via-[#020817] to-[#050816]
            ${
              showGlow
                ? "border-primary/70 shadow-[0_0_25px_rgba(59,130,246,0.35)]"
                : "border-border hover:border-primary/40"
            }`}
        >
          {isListening && (
            <div className="absolute -top-3 left-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary border border-primary/30 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <Activity className="h-3 w-3" />
                <span>Listening…</span>

                {/* Tiny equalizer */}
                <div className="flex items-end gap-[2px] ml-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full bg-primary animate-pulse"
                      style={{
                        height: i === 1 ? "10px" : "7px",
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message QueryCraft..."
            className="border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent max-h-24 placeholder:text-muted-foreground text-foreground p-0 text-sm leading-relaxed"
            disabled={disabled}
            rows={1}
          />

          {isSpeechSupported ? (
            <Button
              type="button"
              onClick={toggleListening}
              disabled={disabled}
              size="icon"
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              variant={isListening ? "default" : "ghost"}
              className={`shrink-0 h-9 w-9 rounded-full transition-all duration-150
                ${
                  isListening
                    ? "bg-primary text-primary-foreground shadow-md animate-pulse"
                    : "text-muted-foreground hover:text-primary"
                }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              disabled
              className="shrink-0 h-9 w-9 rounded-full text-muted-foreground"
            >
              <MicOff className="w-4 h-4" />
            </Button>
          )}

          <Button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            size="icon"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shrink-0 h-9 w-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>Press Enter to send, Shift + Enter for new line</span>
          {isSpeechSupported && (
            <>
              <span className="text-xs">•</span>
              <span className="inline-flex items-center gap-1">
                <Mic className="w-3 h-3" />
                <span>Click mic to dictate</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
