'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CodeCard } from './CodeCard';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  timestamp: string;
}

type Segment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string };

/**
 * Splits a message into plain-text and fenced-code segments.
 * Supports fences like: ``` or ```sql
 */
function parseMessageToSegments(message: string): Segment[] {
  const segments: Segment[] = [];
  const fenceRE = /```(?:([a-zA-Z0-9+-]*)\n)?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRE.exec(message)) !== null) {
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ type: 'text', content: message.slice(lastIndex, index) });
    }

    const lang = match[1] || '';
    const codeContent = match[2];
    segments.push({ type: 'code', lang, content: codeContent });

    lastIndex = fenceRE.lastIndex;
  }

  if (lastIndex < message.length) {
    segments.push({ type: 'text', content: message.slice(lastIndex) });
  }

  return segments;
}

/**
 * Render inline Markdown-like constructs inside a text block.
 * - `**bold**`
 * - `*italic*`
 * - `` `inline code` ``
 *
 * This is intentionally small and deterministic (no external library),
 * just enough to convert common inline patterns LLMs emit.
 */
function renderInlineMarkdown(text: string, keyPrefix = ''): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Regex captures: 1=bold, 2=italic, 3=code
  const inlineRE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = inlineRE.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      nodes.push(
        <span key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIndex, matchIndex)}</span>
      );
    }

    if (match[1]) {
      // **bold**
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx++}`}>{match[2]}</strong>
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        <em key={`${keyPrefix}-i-${idx++}`}>{match[4]}</em>
      );
    } else if (match[5]) {
      // `code`
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          style={{
            backgroundColor: 'rgba(148,163,184,0.12)',
            padding: '0.06rem 0.3rem',
            borderRadius: 4,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace',
            fontSize: '0.92em',
          }}
        >
          {match[6]}
        </code>
      );
    }

    lastIndex = inlineRE.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`${keyPrefix}-t-${idx++}`}>{text.slice(lastIndex)}</span>);
  }

  return nodes;
}

export function ChatMessage({ message, isUser, timestamp }: ChatMessageProps) {
  const segments = parseMessageToSegments(message);

  // Aurora palette (direct values)
  const secondaryBg = '#1e293b'; // slate/blue-gray bubble for bot
  const secondaryFg = '#f8fafc'; // bot text color
  const mutedText = '#94a3b8';
  const bubbleShadow = '0 6px 18px rgba(2,8,23,0.6)';

  const userBubbleStyle: React.CSSProperties = {
    background: secondaryBg,
    color: secondaryFg,
    borderRadius: '12px',
    boxShadow: bubbleShadow,
    padding: '12px 16px',
  };

  const botBubbleStyle: React.CSSProperties = {
    padding: '6px 9px',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.27 }}
      className={`w-full flex gap-4 ${isUser ? 'justify-end' : ''}`}
    >
      {!isUser && (
        <Avatar className="flex-shrink-0">
          <AvatarFallback>
            <Bot />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[80%] space-y-2`}>
        <div
          style={isUser ? userBubbleStyle : botBubbleStyle}
          // keep prose for nice typography inside messages
          className="prose prose-sm max-w-none"
        >
          {/* Render mixed segments: text and code cards */}
          {segments.map((seg, i) => {
            if (seg.type === 'text') {
              // plain text: preserve newlines and spacing, but also render inline MD (bold, italic, inline code)
              return (
                <p
                  key={i}
                  className="whitespace-pre-wrap break-words"
                  style={{ margin: 0, color: secondaryFg }}
                >
                  {renderInlineMarkdown(seg.content, `seg-${i}`)}
                </p>
              );
            }

            // code segment: render CodeCard (keeps its own styling)
            return (
              <div key={i} className="mt-2">
                <CodeCard code={seg.content} lang={seg.lang} />
              </div>
            );
          })}
        </div>

        <div style={{ color: mutedText }} className={`text-xs ${isUser ? 'text-right' : 'text-left'}`}>
          {timestamp}
        </div>
      </div>

      {isUser && (
        <Avatar className="flex-shrink-0">
          <AvatarFallback>
            <User />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

export default ChatMessage;
