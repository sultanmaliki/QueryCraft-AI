'use client';

import React, { useEffect, useState } from 'react';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInput } from '@/components/chat/ChatInput';
import { DatabaseImportDialog } from '@/components/modals/DatabaseImportDialog';
import { ChatSidebar } from '@/components/layout/ChatSidebar';
import { MobileSidebarTrigger } from '@/components/layout/MobileSidebarTrigger';
import { SettingsDialog } from '@/components/modals/SettingsDialog';

// --- Types ---
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
  isLocal?: boolean;
}

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

interface ChatAppProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://apiquerycraft.hubzero.in';

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('qc_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

// --- Response shapes from backend (narrowly typed) ---
interface RawChatFromServer {
  _id?: string;
  id?: string;
  title?: string;
  messages?: unknown;
  createdAt?: string;
  updatedAt?: string;
  lastActive?: string;
}

// --- Backend minimal response shape ---
interface QueryResponse {
  queryId?: string;
  chatId?: string;
  model?: string;
  status?: 'pending' | 'done' | 'failed';
  createdAt?: string;
  updatedAt?: string;
  response?: string; // the actual generated string
}

// --- Small safe helpers / type guards ---
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function getStringField(obj: unknown, ...keys: string[]): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (isNonEmptyString(v)) return v;
  }
  return undefined;
}

function getBooleanField(obj: unknown, key: string): boolean | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  if (typeof v === 'boolean') return v;
  return undefined;
}

function getTimestampFrom(obj: unknown, ...keys: string[]): string {
  const s = getStringField(obj, ...keys);
  if (s) return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isMessageArray(v: unknown): v is Message[] {
  return Array.isArray(v) && v.every((m) => {
    if (typeof m !== 'object' || m === null) return false;
    const mm = m as Record<string, unknown>;
    return typeof mm.id === 'string' && typeof mm.content === 'string' && typeof mm.isUser === 'boolean';
  });
}

function normalizeChat(raw: RawChatFromServer): ChatSession {
  const id = raw._id || raw.id || String(Date.now());
  const title = raw.title || 'Chat';
  const messages: Message[] = isMessageArray(raw.messages)
    ? raw.messages
    : [
        {
          id: Date.now().toString(),
          content: '',
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];

  return {
    id,
    title,
    messages,
    createdAt: raw.createdAt || new Date().toISOString(),
    lastActive: raw.updatedAt || raw.lastActive || new Date().toISOString(),
    isLocal: false
  };
}

export function ChatApp({ userProfile, onLogout }: ChatAppProps) {
  const [currentSessionId, setCurrentSessionId] = useState<string>(''); // start empty
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState("qwen:4b");
  const [showDatabaseDialog, setShowDatabaseDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const isMountedRef = React.useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Polling helper
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function createLocalChat(title = 'New Chat') {
    const id = Date.now().toString();
    const newChat: ChatSession = {
      id,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isLocal: true
    };
    // prepend locally
    setChatSessions((prev) => [newChat, ...prev]);
    setCurrentSessionId(id);
    return id;
  }

  /**
   * Poll server for query result until status === 'done' or attempts exhausted.
   * Replaces the placeholder message with final AI text when ready.
   */
  async function pollQueryResult(queryId: string, placeholderMessageId: string, sessionId: string) {
    const maxAttempts = 10;
    let attempt = 0;
    let delay = 800; // starting delay

    while (attempt < maxAttempts && isMountedRef.current) {
      try {
        const res = await fetch(`${API_BASE}/api/query/${queryId}`, { headers: authHeaders() });
        if (!res.ok) {
          // If 404/403 etc, stop polling and show error in placeholder
          if (res.status === 404 || res.status === 403) {
            const errText = `Server returned ${res.status}`;
            updateSessionMessages(sessionId, messages =>
              messages.map(m => (m.id === placeholderMessageId ? { ...m, content: errText } : m))
            );
            return;
          }
        } else {
          const data = (await res.json()) as QueryResponse;
          if (data?.status === 'done') {
            const finalText = data.response || 'No response';
            // Replace placeholder with real AI message
            updateSessionMessages(sessionId, (prevMessages) =>
              prevMessages.map((m) => (m.id === placeholderMessageId ? { ...m, content: finalText } : m))
            );
            // Ensure chat session exists / is updated
            if (data.chatId) {
              const title = (prevTitleFromMessage() || '').slice(0, 50) || 'Chat';
              prependOrUpdateSession({ id: data.chatId, title, messages: getSessionMessagesCopy(sessionId, placeholderMessageId, finalText) });
              setCurrentSessionId(data.chatId);
            }
            return;
          } else if (data?.status === 'failed') {
            updateSessionMessages(sessionId, (prevMessages) =>
              prevMessages.map((m) => (m.id === placeholderMessageId ? { ...m, content: 'LLM failed to produce an answer.' } : m))
            );
            return;
          }
        }
      } catch (err) {
        // network error — continue to retry silently
        console.warn('[pollQueryResult] attempt', attempt, 'error', err);
      }

      // backoff
      await sleep(delay);
      attempt += 1;
      delay = Math.min(5000, delay * 1.8);
    }

    // If exhausted attempts, show timed out message
    updateSessionMessages(sessionId, (prevMessages) =>
      prevMessages.map((m) => (m.id === placeholderMessageId ? { ...m, content: 'Request timed out. Try again.' } : m))
    );
  }

  /** Helpers used above — small utility wrappers to keep state updates safe */
  function updateSessionMessages(sessionId: string, updater: (prev: Message[]) => Message[]) {
    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, messages: updater(session.messages), lastActive: new Date().toISOString() } : session
      )
    );
  }
  function getSessionMessagesCopy(sessionId: string, placeholderId: string, finalText: string) {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (!session) return [{ id: placeholderId, content: finalText, isUser: false, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    return session.messages.map((m) => (m.id === placeholderId ? { ...m, content: finalText } : m));
  }
  function prevTitleFromMessage() {
    // pick something intelligent for new chat titles; fallback to current session first message
    const s = chatSessions.find((s) => s.id === currentSessionId);
    return s?.messages?.[0]?.content?.slice?.(0, 50) || '';
  }

  const currentSession = currentSessionId ? chatSessions.find((s) => s.id === currentSessionId) ?? null : null;
  const messages = currentSession?.messages || [];

  const prependOrUpdateSession = (chat: Partial<ChatSession> & { id: string }) => {
    setChatSessions((prev) => {
      const exists = prev.find((p) => p.id === chat.id);
      if (exists) {
        return prev.map((p) => (p.id === chat.id ? { ...p, ...chat } : p));
      }
      return [
        {
          id: chat.id,
          title: chat.title || 'New Chat',
          messages: chat.messages || [],
          createdAt: chat.createdAt || new Date().toISOString(),
          lastActive: chat.lastActive || new Date().toISOString()
        },
        ...prev
      ];
    });
  };

  // --- Load user's chats on mount ---
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat`, { headers: authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as unknown;
          if (Array.isArray(data) && data.length > 0) {
            const chats = data.map((c) => normalizeChat(c as RawChatFromServer));
            // keep chats loaded but do NOT auto-open any chat — show Welcome screen instead
            setChatSessions(chats);
            // DO NOT set currentSessionId(chats[0].id) — leave it empty to show Welcome.
            setCurrentSessionId(''); // explicit about showing welcome
          } else {
            // no server chats: keep client empty => show Welcome
            setChatSessions([]);
            setCurrentSessionId('');
          }
        } else if (res.status === 401) {
          console.warn('Unauthorized when loading chats (401).');
        } else {
          console.warn('Failed to fetch chats', res.status, res.statusText);
        }
      } catch (err: unknown) {
        console.error('Load chats error', err);
      }
    })();
  }, []);

  // When user clicks "New chat" — behave exactly like clicking the QueryCraft header:
  // show the Welcome screen (no local chat creation). The chat will be created only
  // when the user sends their first query from the welcome screen.
  const handleNewChat = () => {
    // Show welcome / no chat selected
    setCurrentSessionId('');

    // Clear typing indicator/state to avoid stale UI when switching to welcome
    setIsTyping(false);

    // Optional: If you have a mobile sidebar open, you can close it here if you
    // expose a handler / state. For now we leave that to the sidebar trigger.
  };

  // Put this inside ChatApp (replace the existing handleSelectSession)
  const handleSelectSession = async (sessionId: string) => {
    if (!sessionId) return;

    try {
      const res = await fetch(`${API_BASE}/api/chat/${sessionId}`, {
        headers: authHeaders(),
      });

      if (!res.ok) {
        // If not found or unauthorized, fall back to selecting any locally-known session
        console.warn('[handleSelectSession] fetch failed', res.status, res.statusText);
        const local = chatSessions.find((s) => s.id === sessionId);
        if (local) {
          // open local version as fallback
          setCurrentSessionId(local.id);
        }
        return;
      }

      const body = (await res.json()) as unknown;

      // The backend endpoint you showed returns { chat, queries }
      // But be defensive: handle a few possible shapes gracefully.
      const serverChat = (body && ((body as Record<string, unknown>).chat || body)) as RawChatFromServer;
      const queries = Array.isArray((body as Record<string, unknown>)?.queries)
        ? ((body as Record<string, unknown>).queries as unknown[])
        : (Array.isArray(body) ? (body as unknown[]) : []);

      // Build messages in the shape your UI expects.
      const mappedMessages: Message[] = [];

      if (Array.isArray(queries) && queries.length > 0) {
        queries.forEach((q: unknown, idx: number) => {
          const qId = getStringField(q, '_id', 'id') ?? `q-${sessionId}-${idx}`;

          // If the query doc stores a user prompt separately, add it as a user message.
          const userPrompt = getStringField(q, 'prompt', 'input');
          if (userPrompt) {
            mappedMessages.push({
              id: `${qId}-u`,
              content: userPrompt,
              isUser: true,
              timestamp: getTimestampFrom(q, 'createdAt', 'created_at')
            });
          }

          // Pull out response text from common fields
          const responseText = getStringField(q, 'response', 'answer', 'output', 'result', 'text', 'content', 'message');

          if (responseText) {
            mappedMessages.push({
              id: `${qId}-a`,
              content: responseText,
              isUser: false,
              timestamp: getTimestampFrom(q, 'updatedAt', 'createdAt', 'created_at')
            });
          }
        });
      } else if (Array.isArray(serverChat?.messages) && (serverChat.messages as unknown[]).length > 0) {
        // If the chat itself contains messages (older shape), map them directly
        (serverChat.messages as unknown[]).forEach((m: unknown, i: number) => {
          const id = getStringField(m, 'id', '_id') ?? `m-${serverChat._id ?? sessionId}-${i}`;
          const content = getStringField(m, 'content', 'text', 'body') ?? '';
          const isUser = getBooleanField(m, 'isUser') ?? ((getStringField(m, 'role') === 'user') ? true : false);
          const timestamp = getTimestampFrom(m, 'timestamp', 'createdAt');

          mappedMessages.push({
            id,
            content,
            isUser,
            timestamp
          });
        });
      }

      // If we couldn't derive messages, fallback to serverChat.messages (if it's already in expected shape) or an empty array
      const finalMessages = mappedMessages.length > 0
        ? mappedMessages
        : (isMessageArray(serverChat?.messages) ? serverChat.messages : []);

      // Build the normalized session object
      const normalized: ChatSession = {
        id: getStringField(serverChat, '_id', 'id') ?? sessionId,
        title: serverChat?.title ?? 'Chat',
        messages: finalMessages,
        createdAt: serverChat?.createdAt ?? new Date().toISOString(),
        lastActive: serverChat?.updatedAt ?? serverChat?.lastActive ?? new Date().toISOString()
      };

      // Prepend or update local sessions and open it
      prependOrUpdateSession(normalized);
      setCurrentSessionId(normalized.id);
    } catch (err) {
      console.error('[handleSelectSession] error fetching chat by id', err);
      // fallback: open a locally-known session if present
      const fallback = chatSessions.find((s) => s.id === sessionId);
      if (fallback) setCurrentSessionId(fallback.id);
    } finally {
      // setFetchingChatId(null); // if you used a fetching state
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId && chatSessions.length > 1) setCurrentSessionId(chatSessions[0].id);
      } else {
        // if backend doesn't support, remove locally
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
        console.warn('Delete session backend returned', res.status);
      }
    } catch (err: unknown) {
      setChatSessions((prev) => prev.filter((s) => s.id !== sessionId));
      console.error('Delete session error', err);
    }
  };

  // --- Send message: POST /api/query ---
  const handleSendMessage = async (content: string) => {
    // Determine or create session: if no chat selected, create server chat first.
    let sessionId = currentSessionId;

    // Create the user message object (timestamp is generated when we append)
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // If no session selected, create a server chat (POST /api/chat).
    if (!sessionId) {
      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ title: content.slice(0, 50) || 'New Chat' })
        });

        if (res.ok) {
          const serverChat = (await res.json()) as RawChatFromServer;
          const normalized = normalizeChat(serverChat);
          // add server chat to state (no messages yet)
          prependOrUpdateSession({ id: normalized.id, title: normalized.title, messages: normalized.messages, createdAt: normalized.createdAt, lastActive: normalized.lastActive });
          setCurrentSessionId(normalized.id);
          sessionId = normalized.id;
        } else {
          console.warn('Failed to create server chat; falling back to local chat', res.status);
          sessionId = createLocalChat('New Chat');
        }
      } catch (err) {
        console.warn('Network error creating server chat, falling back to local chat', err);
        sessionId = createLocalChat('New Chat');
      }
    }

    // Ensure sessionId exists now (either server-provided or local fallback)
    if (!sessionId) {
      sessionId = createLocalChat('New Chat');
    }

    // Append the user message to the chosen session
    updateSessionMessages(sessionId, (prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Now call the query endpoint (POST /api/query)
    try {
      const payload = { chatId: sessionId, prompt: content, model: selectedModel };
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      // try to parse body safely
      let data: QueryResponse | null = null;
      try {
        data = (await res.json()) as QueryResponse;
      } catch {
        data = null;
      }

      if (res.status === 202 || data?.status === 'pending') {
        // placeholder then poll
        const placeholderId = `ai-${data?.queryId || Date.now().toString()}`;
        const placeholderMsg: Message = {
          id: placeholderId,
          content: 'Thinking...',
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updateSessionMessages(sessionId, (prev) => [...prev, placeholderMsg]);

        // If server returned a chatId (maybe a different id), ensure we update local sessions and switch to it
        if (data?.chatId) {
          prependOrUpdateSession({ id: data.chatId, title: content.slice(0, 50), messages: [...(getSessionMessagesCopy(sessionId, '', '') || []), userMessage, placeholderMsg] });
          setCurrentSessionId(data.chatId);
          // ensure we poll for the server chat id
          pollQueryResult(data?.queryId || '', placeholderId, data?.chatId || sessionId);
        } else {
          pollQueryResult(data?.queryId || '', placeholderId, sessionId);
        }
        return;
      }

      if (res.ok && data) {
        const aiText = data.response || 'No response from LLM';
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: aiText,
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updateSessionMessages(sessionId, (prev) => [...prev, aiMessage]);

        if (data.chatId) {
          // Backend claims/created a chat id; ensure local session uses it
          prependOrUpdateSession({ id: data.chatId, title: content.slice(0, 50), messages: [...(getSessionMessagesCopy(sessionId, '', '') || []), userMessage, aiMessage] });
          setCurrentSessionId(data.chatId);
        }
        return;
      }

      // Non-ok response handling
      let errBody: unknown = null;
      try {
        errBody = await res.json();
      } catch {
        errBody = { message: res.statusText };
      }
      const errMsgFromBody =
        typeof errBody === 'object' && errBody !== null
          ? String((errBody as Record<string, unknown>).error ?? (errBody as Record<string, unknown>).message ?? '')
          : '';
      const serverMessage =
        res.status === 404
          ? 'Endpoint not found (404). Check NEXT_PUBLIC_API_BASE and that your backend exposes POST /api/query.'
          : (errMsgFromBody || res.statusText);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: serverMessage,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      updateSessionMessages(sessionId, (prev) => [...prev, aiMessage]);
      console.warn('Query failed', res.status, res.statusText, errBody);
    } catch (err: unknown) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Network or LLM error: ${err instanceof Error ? err.message : String(err)}`,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      updateSessionMessages(sessionId, (prev) => [...prev, aiMessage]);
      console.error('Network or LLM error', err);
    } finally {
      setIsTyping(false);
    }
  };

  // Clear
  const handleClearAllHistory = async () => {
    try {
      // Attempt backend clear first (if backend supports DELETE /api/chat)
      await fetch(`${API_BASE}/api/chat`, { method: 'DELETE', headers: authHeaders() }).catch(() => null);
    } catch (e: unknown) {
      console.error('Clear history network error', e);
    }
    // Always clear client state
    setChatSessions([]);
    setCurrentSessionId('');
  };

  const handleDatabaseImport = () => {
    setShowDatabaseDialog(true);
  };

  // Aurora visual tokens (direct values)
  const auroraBackground = 'linear-gradient(135deg, #020817 0%, #071129 25%, #0b1f2b 50%)';
  const sidebarBg = 'linear-gradient(180deg, rgba(2,8,23,0.95), rgba(2,8,23,0.98))';
  const sidebarBorder = '1px solid rgba(14,165,233,0.15)';
  const primaryText = '#f8fafc';

  return (
    <div className="h-screen flex" style={{ background: auroraBackground, color: primaryText }}>
      <div className="hidden lg:block w-80 flex-shrink-0" style={{ background: sidebarBg, borderRight: sidebarBorder }}>
        <ChatSidebar
          key={userProfile.email}
          chatSessions={chatSessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onNewChat={handleNewChat}
          isAuthenticated={true}
          userProfile={userProfile}
          onLogout={onLogout}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onDatabaseImport={() => setShowDatabaseDialog(true)}
          onSettingsClick={() => setShowSettingsDialog(true)}
          onWelcomeClick={() => setCurrentSessionId('')}
          sidebarTrigger={
            <MobileSidebarTrigger
              chatSessions={chatSessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onNewChat={handleNewChat}
              isAuthenticated={true}
              userProfile={userProfile}
              onLogout={onLogout}
            />
          }
        />
        <ChatWindow messages={messages} isTyping={isTyping} showWelcome={!currentSessionId} />
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </div>

      <DatabaseImportDialog open={showDatabaseDialog} onOpenChange={setShowDatabaseDialog} onImport={() => handleDatabaseImport()} />

      <SettingsDialog
        key={userProfile.email}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        chatSessions={chatSessions}
        currentSessionId={currentSessionId}
        userProfile={userProfile}
        onDeleteSession={handleDeleteSession}
        onClearAllHistory={handleClearAllHistory}
      />
    </div>
  );
}
