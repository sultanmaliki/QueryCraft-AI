'use client';

import React, { useEffect, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css';

import { Copy, Check, Play } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://apiquerycraft.hubzero.in';

type SourceInfo = {
  sourceType?: 'file' | 'connection';
  fileId?: string;
  connectionKey?: string;
  connectionString?: string;
};

type QueryResult = {
  source?: string;
  rows?: Record<string, unknown>[];
  columns?: string[];
  rowCount?: number;
  error?: string;
};

/* --------------------- helpers (updated types) --------------------- */
function tryParseJsonLike(objStr: string): Record<string, unknown> | unknown[] | null {
  if (!objStr || typeof objStr !== 'string') return null;
  let s = objStr.trim();
  if (s.endsWith(';')) s = s.slice(0, -1);
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1).trim();

  try {
    // STEP A: replace regex literals with quoted placeholders that include encoded pattern + flags
    const regexLiteral = /\/((?:\\.|[^\/\\])+)\/([gimsuy]*)/g;
    const hasBtoa = typeof btoa === 'function';
    s = s.replace(regexLiteral, (_m, body, flags) => {
      const encoded = hasBtoa ? btoa(body) : encodeURIComponent(body);
      // placeholder stays a JSON string so JSON.parse won't break
      return `"__REGEX__${encoded}__${flags}__"`;
    });

    // STEP B: convert single-quoted strings to double-quoted strings
    s = s.replace(/'([^']*)'/g, (_m, p1) => {
      const escaped = p1.replace(/"/g, '\\"');
      return `"${escaped}"`;
    });

    // STEP C: quote unquoted object keys (basic heuristic)
    s = s.replace(/([{,]\s*)([A-Za-z0-9_$@-]+)\s*:/g, (_m, prefix, key) => `${prefix}"${key}":`);

    // Now parse
    const parsed = JSON.parse(s);

    // STEP D: revive regex placeholders into special objects carrying flags + pattern
    const revived = reviveRegexPlaceholders(parsed);
    // STEP E: normalize regex objects into pattern + $options injection where appropriate
    const normalized = normalizeRegexObjects(revived);
    // normalized may be unknown (but should be object/array)
    if (typeof normalized === 'object' && normalized !== null) {
      return normalized as Record<string, unknown> | unknown[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Replace placeholder strings like "__REGEX__<b64>__flags__" with special objects:
 * { __isRegex: true, pattern: "...", flags: "i" }
 * (keeps flags available for later injection)
 */
function reviveRegexPlaceholders(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // allow '=' and other base64 chars in capture
    const marker = /^__REGEX__(.+)__([gimsuy]*)__$/;
    const m = obj.match(marker);
    if (m) {
      const encoded = m[1];
      const flags = m[2] || '';
      let decoded: string;
      try {
        decoded = typeof atob === 'function' ? atob(encoded) : decodeURIComponent(encoded);
      } catch {
        try {
          decoded = decodeURIComponent(encoded);
        } catch {
          decoded = encoded;
        }
      }
      // return a small object so we can handle flags later in context
      return { __isRegex: true, pattern: decoded, flags };
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(reviveRegexPlaceholders);
  }

  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const val = (obj as Record<string, unknown>)[k];
      out[k] = reviveRegexPlaceholders(val);
    }
    return out;
  }

  return obj;
}

/**
 * Walk parsed object and:
 * - convert any { __isRegex:true, pattern, flags } found as a value into the pattern string
 * - if that __isRegex object was the value of "$regex" and there is no sibling "$options",
 *   inject "$options" with the flags (if flags exist)
 *
 * Returns a new object (doesn't mutate original input).
 */
function normalizeRegexObjects(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(normalizeRegexObjects);
  }

  if (typeof obj === 'object') {
    // first shallow-copy to inspect siblings
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const v = (obj as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const vObj = v as Record<string, unknown>;
        // detect the special regex object marker
        if (vObj['__isRegex'] === true && typeof vObj['pattern'] === 'string') {
          out[k] = vObj['pattern'];
          if (k === '$regex' && vObj['flags'] && !(obj as Record<string, unknown>)['$options']) {
            out['$options'] = vObj['flags'] as unknown as string;
          }
          continue;
        }
      }
      out[k] = normalizeRegexObjects(v);
    }
    return out;
  }

  return obj;
}

function extractCollectionAndFilter(code: string): { collection?: string; filterStr?: string } {
  const trimmed = code.trim();
  const dbFind = trimmed.match(/db\.([A-Za-z0-9_$]+)\.find\s*\(\s*([\s\S]*)\)\s*;?$/m);
  if (dbFind) {
    const col = dbFind[1];
    const inner = dbFind[2].trim();
    const firstObj = extractFirstObject(inner);
    if (firstObj) return { collection: col, filterStr: firstObj };
    return { collection: col, filterStr: inner.split(/\s*,\s*/)[0] };
  }

  const simpleFind = trimmed.match(/^([A-Za-z0-9_$]+)\.find\s*\(\s*([\s\S]*)\)\s*;?$/m);
  if (simpleFind) {
    const col = simpleFind[1];
    const inner = simpleFind[2].trim();
    const firstObj = extractFirstObject(inner);
    if (firstObj) return { collection: col, filterStr: firstObj };
    return { collection: col, filterStr: inner.split(/\s*,\s*/)[0] };
  }

  const maybeObj = trimmed;
  if (maybeObj.startsWith('{') || maybeObj.startsWith('[') || maybeObj.startsWith('(')) {
    const obj = extractFirstObject(maybeObj) || maybeObj;
    return { filterStr: obj };
  }

  return {};
}

function extractFirstObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function extractErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return 'Unknown error';
  }
}

/* --------------------- CodeCard component (unchanged apart from helpers) --------------------- */
export function CodeCard({
  code,
  lang,
  sourceInfo,
  authToken
}: {
  code: string;
  lang?: string;
  sourceInfo?: SourceInfo;
  authToken?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [maxRows] = useState(200);
  const codeRef = useRef<HTMLElement | null>(null);

  const displayLang = lang && lang.trim() ? lang.trim() : 'bash';
  const languageClass = `language-${displayLang}`;

  useEffect(() => {
    if (codeRef.current) {
      try {
        Prism.highlightElement(codeRef.current);
      } catch {}
    }
  }, [code, displayLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        textarea.remove();
      }
    }
  };

  const dbTypeFromConnection = (cs?: string): string | undefined => {
    if (!cs) return undefined;

    const lowered = cs.toLowerCase();
    if (lowered.startsWith('mongodb://') || lowered.startsWith('mongodb+srv://')) return 'mongodb';
    if (lowered.startsWith('postgres://') || lowered.startsWith('postgresql://')) return 'postgresql';
    if (lowered.startsWith('mysql://')) return 'mysql';
    if (lowered.startsWith('mariadb://')) return 'mariadb';
    if (lowered.startsWith('mssql://') || lowered.startsWith('sqlserver://')) return 'mssql';
    if (lowered.startsWith('sqlite://') || lowered.startsWith('file:')) return 'sqlite';
    if (lowered.startsWith('neo4j://') || lowered.startsWith('bolt://')) return 'neo4j';
    return undefined;
  };


  const handleExecute = async () => {
    setResults(null);
    setError(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setError('Query is empty');
      return;
    }

    const blocked = /\b(drop|truncate|alter|delete|update|insert)\b/i;
    if (blocked.test(trimmed) && !(sourceInfo?.sourceType === 'file')) {
      setError('Query contains potentially destructive statements. Use a read-only connection or confirm in server settings.');
      return;
    }

    setRunning(true);
    try {
      const payload: Record<string, unknown> = {
        sourceType: sourceInfo?.sourceType || 'connection',
        maxRows
      };

      if (sourceInfo?.sourceType === 'file' && sourceInfo.fileId) {
        // File-backed execution: just send the raw query (SQL / Mongo / CSV-backed SQL, etc.)
        payload.fileId = sourceInfo.fileId;
        payload.query = code;
      } else {
        const key = sourceInfo?.connectionKey || 'qc_conn_default';
        const cs = typeof window !== 'undefined'
          ? (sourceInfo?.connectionString || localStorage.getItem(key) || undefined)
          : sourceInfo?.connectionString;

        if (!cs || typeof cs !== 'string') {
          throw new Error('No data source available. Upload a file or save a connection string first.');
        }

        payload.connectionString = cs;
        const dbType = dbTypeFromConnection(cs);
        if (dbType) {
          payload.dbType = dbType; // optional hint for the backend
        }

        if (cs.startsWith('mongodb://') || cs.startsWith('mongodb+srv://')) {
          // --- MongoDB path: build a { mongo: { collection, filter, ... } } payload ---
          const extracted = extractCollectionAndFilter(trimmed);
          let collection = extracted.collection;
          let filter: Record<string, unknown> = {};

          if (extracted.filterStr) {
            const parsed = tryParseJsonLike(extracted.filterStr);
            if (parsed !== null && (typeof parsed === 'object')) {
              if (!Array.isArray(parsed)) filter = parsed as Record<string, unknown>;
            } else {
              try {
                const parsed2 = JSON.parse(extracted.filterStr);
                if (typeof parsed2 === 'object' && parsed2 !== null && !Array.isArray(parsed2)) {
                  filter = parsed2 as Record<string, unknown>;
                }
              } catch {
                filter = {};
              }
            }
          } else {
            const parsed = tryParseJsonLike(trimmed);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
              filter = parsed as Record<string, unknown>;
            }
          }

          if (!collection) {
            const fallback = trimmed.match(/([A-Za-z0-9_$]+)\.find\s*\(/);
            if (fallback) collection = fallback[1];
          }

          payload.mongo = {
            collection: collection || 'default',
            filter,
            projection: undefined,
            limit: maxRows
          };
        } else {
          // --- SQL / Postgres / MySQL / other non-Mongo DBs: send raw query string ---
          payload.query = code;
        }
      }


      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const resp = await fetch(`${API_BASE}/api/db/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || j?.message || `Server responded with ${resp.status}`);
      setResults(j as QueryResult);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  // type guard: safe check for { name: string | number } without using `any`
  function hasName(obj: unknown): obj is { name: string | number } {
    if (obj === null || typeof obj !== 'object') return false;
    const rec = obj as Record<string, unknown>;
    if (!('name' in rec)) return false;
    const val = rec['name'];
    return typeof val === 'string' || typeof val === 'number';
  }

  const formatCell = (val: unknown) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      return <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(val, null, 2)}</pre>;
    }
    if (typeof val === 'object') {
      // use the type guard instead of `any`
      if (hasName(val)) {
        return String(val.name);
      }
      return <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(val, null, 2)}</pre>;
    }
    return String(val);
  };

  /* ---------- Aurora visuals (direct values) ---------- */
  const auroraCardBg = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';
  const auroraHeaderBg = 'rgba(255,255,255,0.02)';
  const borderColor = '#1e293b';
  const primaryText = '#c9d1d9';
  const mutedText = '#94a3b8';
  const highlight = 'linear-gradient(90deg, rgba(14,165,233,1), rgba(139,92,246,1))';
  const dangerColor = '#fb7185';
  const subtleShadow = '0 10px 30px rgba(2,8,23,0.6)';
  const elevatedShadow = '0 18px 50px rgba(2,8,23,0.7)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        margin: '10px 0',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? elevatedShadow : subtleShadow,
        border: `1px solid ${borderColor}`,
        background: auroraCardBg
      }}
      role="region"
      aria-label={`Code snippet (${displayLang})`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: auroraHeaderBg, borderBottom: `1px solid ${borderColor}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: highlight,
            color: '#0f172a',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 0.3,
            boxShadow: '0 4px 14px rgba(139,92,246,0.12)'
          }}>
            {displayLang.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleCopy}
            aria-label="Copy code"
            title={copied ? 'Copied' : 'Copy code'}
            style={{
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: 8,
              background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
              color: primaryText,
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 120ms ease, background 120ms ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = '')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span style={{ fontSize: 12, color: mutedText }}>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleExecute}
            disabled={running}
            aria-busy={running}
            title={running ? 'Running…' : 'Execute query'}
            style={{
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: 10,
              background: running ? 'linear-gradient(90deg, rgba(14,165,233,0.14), rgba(139,92,246,0.12))' : highlight,
              color: '#0f172a',
              fontWeight: 700,
              border: 'none',
              cursor: running ? 'default' : 'pointer',
              transition: 'transform 120ms ease, opacity 120ms ease'
            }}
            onMouseDown={(e) => !running && (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = '')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
          >
            {running ? (
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ marginRight: 4 }}>
                <g transform="translate(12,12)">
                  <circle cx="0" cy="0" r="8" fill="none" stroke="rgba(15,23,42,0.14)" strokeWidth="3"></circle>
                  <path d="M8 0 A8 8 0 0 1 0 -8" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none">
                    <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite" />
                  </path>
                </g>
              </svg>
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span style={{ fontSize: 13 }}>{running ? 'Running' : 'Run'}</span>
          </button>
        </div>
      </div>

      {/* Code block */}
      <pre style={{ margin: 0, padding: 16, overflowX: 'auto', background: 'transparent' }}>
        <code ref={codeRef as React.RefObject<HTMLElement>} className={`${languageClass} font-mono`} style={{ fontSize: 13 }}>
          {code.replace(/\n$/, '')}
        </code>
      </pre>

      {/* Results / footer */}
      <div style={{ padding: 12, borderTop: `1px solid ${borderColor}`, background: 'rgba(255,255,255,0.01)' }}>
        {running && <div style={{ color: mutedText, fontSize: 12, marginBottom: 8 }}>Executing query…</div>}

        {error && (
          <div style={{ color: dangerColor, fontSize: 13, marginBottom: 8 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {results && !results.error && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ color: mutedText, fontSize: 12 }}>
                Source: {results.source || 'unknown'}
              </div>
              <div style={{ color: mutedText, fontSize: 12 }}>
                Rows: {results.rowCount ?? (results.rows?.length ?? 0)}
              </div>
            </div>

            <div style={{ maxHeight: 320, overflow: 'auto', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {(results.columns || (results.rows && results.rows[0] ? Object.keys(results.rows[0]) : [])).map((col: string) => (
                      <th key={col} style={{ textAlign: 'left', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', fontWeight: 700, fontSize: 12 }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(results.rows || []).map((row: Record<string, unknown>, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                      {(results.columns || (row ? Object.keys(row) : [])).map((col: string) => {
                        const v = row ? row[col] : undefined;
                        return (
                          <td key={col} style={{ padding: '8px 10px', verticalAlign: 'top', maxWidth: 360, wordBreak: 'break-word' }}>
                            {formatCell(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* small footer actions when results present */}
            {results && !results.error && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => {
                    // CSV export: convert object/array cells to JSON strings
                    const rows = results.rows || [];
                    if (rows.length === 0) return;
                    const cols = results.columns || Object.keys(rows[0]);

                    const lines = [cols.join(',')].concat(rows.map(r => cols.map(c => {
                      const v = r[c];
                      if (v === null || v === undefined) return '';
                      if (typeof v === 'object') {
                        // JSON-stringify and escape quotes for CSV
                        const s = JSON.stringify(v).replace(/"/g, '""');
                        return `"${s}"`;
                      }
                      const s = String(v).replace(/"/g, '""');
                      return `"${s}"`;
                    }).join(',')));

                    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'query-results.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${borderColor}`,
                    color: mutedText,
                    cursor: 'pointer'
                  }}
                >
                  Export CSV
                </button>
              </div>
            )}
          </div>
        )}

        {results && results.error && (
          <div style={{ color: dangerColor, fontSize: 13 }}>
            Error: {results.error}
          </div>
        )}

        {/* small footer actions when results present */}
        {/* {results && !results.error && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => {
                // simple CSV download helper for visible rows
                const rows = results.rows || [];
                if (rows.length === 0) return;
                const cols = results.columns || Object.keys(rows[0]);
                const lines = [cols.join(',')].concat(rows.map(r => cols.map(c => {
                  const v = r[c];
                  if (v === null || v === undefined) return '';
                  const s = String(v).replace(/"/g, '""');
                  return `"${s}"`;
                }).join(',')));
                const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'query-results.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'transparent',
                border: `1px solid ${borderColor}`,
                color: mutedText,
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>
          </div>
        )} */}
      </div>
    </div>
  );
}
