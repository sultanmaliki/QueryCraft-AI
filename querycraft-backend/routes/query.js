// routes/query.js
const express = require('express');
const router = express.Router();
const { queryLLM } = require('../utils/llm');
const auth = require('../middleware/auth');
const Query = require('../models/Query');
const Chat = require('../models/Chat');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // avoid X-Forwarded-For validation problems by using socket remoteAddress
  keyGenerator: ipKeyGenerator,
});

function sanitizePrompt(s) {
  if (!s) return '';
  // remove nulls, trim, collapse whitespace and cap length
  return s.replace(/\u0000/g, '').trim().replace(/\s+/g, ' ').slice(0, 4000);
}

// escape triple backticks so a user can't prematurely break the assistant's output format
function escapeBackticks(s) {
  return s.replace(/```/g, '`' + '``'); // neutralize triple backticks inside user input
}

function looksLikeSQL(s) {
  if (!s) return false;
  const sqlStarts = /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i;
  return sqlStarts.test(s) || /;\s*$/.test(s) || /\bJOIN\b/i.test(s);
}

function looksLikeMongo(s) {
  if (!s) return false;
  // simple heuristics for mongo shell / driver usage
  return /db\.\w+\.(find|aggregate|insert|update|remove)\s*\(/i.test(s) || /collection\(['"`]\w+['"`]\)/i.test(s);
}

// Very rough structural heuristics for other DB query syntaxes
function looksLikeCypher(s) {
  if (!s) return false;
  return /\bMATCH\s*\(/i.test(s) || /\bMERGE\s*\(/i.test(s) || (/\bCREATE\s*\(/i.test(s) && /-\[[^\]]*\]->\(/.test(s));
}

function looksLikeGraphQL(s) {
  if (!s) return false;
  return (
    /^\s*(query|mutation|subscription)\b[\s\S]*\{/i.test(s) ||
    /^\s*\{\s*[A-Za-z0-9_]+\s*\{/m.test(s)
  );
}

/**
 * Try to infer which DB language the user WANTS, based on hints in the text.
 * This is broader than "looksLike<Lang>" – it also considers natural language hints.
 *
 * Returns one of:
 *   'sql', 'mongodb', 'cypher', 'graphql', 'cql', 'redis', 'elasticsearch', 'dynamodb', etc.
 * or null if no strong hint.
 */
function detectQueryLanguageHint(s) {
  if (!s) return null;
  const lower = s.toLowerCase();

  // Explicit language mentions take priority
  if (/\bcypher\b/.test(lower) || /\bneo4j\b/.test(lower)) return 'cypher';
  if (/\bgraphql\b/.test(lower) || /\bgql\b/.test(lower)) return 'graphql';
  if (/\bcassandra\b/.test(lower) || /\bcql\b/.test(lower)) return 'cql';
  if (/\bredis\b/.test(lower)) return 'redis';
  if (/\bdynamodb\b/.test(lower)) return 'dynamodb';
  if (/\belasticsearch\b/.test(lower) || /\bes index\b/.test(lower)) return 'elasticsearch';

  // Structural hints (if user pasted a query without naming the language)
  if (looksLikeMongo(s)) return 'mongodb';
  if (looksLikeSQL(s)) return 'sql';
  if (looksLikeCypher(s)) return 'cypher';
  if (looksLikeGraphQL(s)) return 'graphql';

  return null;
}

function chooseModelForPrompt(prompt, queryTypeHint, originalWasQuery, options = {}) {
  const text = (prompt || '').toLowerCase();
  const len = (prompt || '').length;
  const {
    isDemo = false,
    preferLowCost = false,
    preferLowLatency = false,
    preferLocal = false,
    preferHighAccuracy = false,
  } = options;

  // NOTE: we intentionally avoid 'or-grok-4.1-fast' here if it's unavailable.
  // Use 'or-grok-code-fast' or 'or-qwen3-coder' as code-specialists instead.
  const contains = (arr) => arr.some(s => text.includes(s));
  const looksLikeCode = () =>
    contains(['function ', 'console.log', 'import ', 'from ', 'def ', 'class ', '() =>', 'async ', 'await ']) ||
    /<\/?[a-z][\s\S]*>/i.test(prompt || '') ||
    /#include\s|int\s+main\(|printf\(/.test(prompt || '') ||
    /\btsc\b|\bnode\b/.test(text);
  const looksLikeSQL = () => /\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bfrom\b|\bwhere\b/.test(text);
  const looksLikeMongo = () => queryTypeHint === 'mongodb' || text.includes('mongodb') || text.includes('db.') || text.includes('aggregation') || text.includes('pipeline');
  const wantsExplanation =
    text.includes('explain') ||
    text.includes('step by step') ||
    text.includes('detailed') ||
    text.includes('in detail') ||
    text.includes('what does this do') ||
    text.includes('why does');

  if (originalWasQuery && len < 2000) {
    if (preferLocal || preferLowCost) return 'llama3.2:1b';
    if (preferLowLatency) return 'phi3:mini-4k-instruct';
    return 'phi3:mini-4k-instruct';
  }

  if (isDemo) {
    if (looksLikeCode()) return 'llama3.2:1b';
    return preferLowCost || preferLocal ? 'llama3.2:1b' : 'phi3:mini-4k-instruct';
  }

  if (/vector search|semantic search|faiss|pinecone|weaviate|milvus|semantic similarity/.test(text) || queryTypeHint === 'retrieval' || queryTypeHint === 'search') {
    return 'or-deepseek-r1';
  }

  if (looksLikeMongo() || queryTypeHint === 'mongodb') {
    if (preferLowCost) return 'qwen:4b';
    if (preferLowLatency) return 'qwen:4b';
    if (preferHighAccuracy) return 'or-qwen2.5-72b-free';
    return 'qwen:4b';
  }

  if (looksLikeSQL() || queryTypeHint === 'nl2sql' || queryTypeHint === 'sql') {
    if (preferLowCost) return 'qwen:4b';
    if (preferLowLatency) return 'qwen:4b';
    if (preferHighAccuracy) return 'or-qwen2.5-72b-free';
    return 'qwen:4b';
  }

  // Code: prefer code-specialists but avoid or-grok-4.1-fast if provider doesn't expose it
  if (looksLikeCode() || queryTypeHint === 'code') {
    if (preferHighAccuracy) return 'or-qwen3-coder';
    if (preferLowLatency) return 'or-grok-code-fast';
    // default code fallback
    return 'or-grok-code-fast';
  }

  if (len > 1400 || wantsExplanation || /research paper|longform|contract|agreement|detailed analysis/.test(text)) {
    if (preferLowCost) return 'mistral:7b-instruct';
    if (preferLowLatency) return 'gemini-2.5-flash';
    if (preferHighAccuracy) return 'gemini-2.5-flash';
    return 'gemini-2.5-flash';
  }

  if (wantsExplanation) {
    if (preferLowCost) return 'mistral:7b-instruct';
    if (preferLowLatency) return 'gemini-2.5-flash';
    return 'gemini-2.5-flash';
  }

  if (contains(['write a', 'draft', 'story', 'poem', 'blog post', 'marketing', 'ad copy', 'creative', 'rewrite this'])) {
    if (preferLowCost) return 'mistral:7b-instruct';
    if (preferLowLatency) return 'gemini-2.5-flash';
    return 'gemini-2.5-flash';
  }

  if (preferHighAccuracy) {
    if (looksLikeCode()) return 'or-qwen3-coder';
    return 'or-qwen3-235b-a22b';
  }

  if (preferLowCost || preferLocal) {
    if (looksLikeCode()) return 'llama3.2:1b';
    return 'mistral:7b-instruct';
  }
  if (preferLowLatency) {
    if (looksLikeCode()) return 'or-grok-code-fast';
    return 'gemini-2.5-flash';
  }

  if (looksLikeCode()) return 'or-grok-code-fast';
  if (looksLikeMongo() || looksLikeSQL()) return 'qwen:4b';

  return 'gemini-2.5-flash';
}


function buildGuidedPrompt(
  userPrompt,
  isUserQuery = false,
  queryType = 'sql_or_mongo',
  chatHistoryText = ''
) {
  const instructionHeader = [
    "You are an expert assistant for generating and explaining database queries.",
    "You can work with SQL, MongoDB, and other database query languages such as Cypher (Neo4j), GraphQL, Cassandra CQL, Redis, Elasticsearch DSL, etc.",
    "",
    "CRITICAL QUERY GENERATION RULES:",
    "",
    "• You must produce a SINGLE executable query, not multiple statements.",
    "",
    "• When generating SQL:",
    "  - Use standard ANSI-style SQL that works on Postgres/MySQL/SQLite.",
    "  - Do NOT include comments inside the SQL (no -- or /* */).",
    "  - Do NOT wrap the SQL in quotes or assign it to a variable.",
    "  - Do NOT include placeholders like <table_name> or <column>; use concrete names from the user or from context.",
    "  - Output exactly one complete SQL statement that ends with a semicolon.",
    "",
    "• When generating MongoDB queries:",
    "  - Prefer the form: db.<collection>.find({ ... })",
    "  - You MAY also output only a JSON-style filter object or pipeline array (e.g. { value: 100 }).",
    "  - Do NOT append .pretty(), .toArray(), or other chained methods after the find/ call.",
    "  - Do NOT assign the result to a variable (no const result = ...).",
    "",
    "• When generating queries in OTHER database languages (Cypher, GraphQL, CQL, Redis, etc.):",
    "  - Use idiomatic, executable syntax for that language.",
    "  - Do NOT wrap the query in variables or client-library boilerplate.",
    "  - Do NOT include comments inside the query.",
    "",
    "OUTPUT FORMAT (MUST ALWAYS BE FOLLOWED):",
    "1) The first line must start with: Here's the query",
    "2) Immediately after that, include ONLY the query in fenced code block(s):",
    "   Example:",
    "   ```query",
    "   query text here;",
    "   ```",
    "   Inside the code block, include ONLY the raw query (no comments, no explanation).",
    "3) After the fenced block(s), provide a clear explanation of:",
    "   - What the query does.",
    "   - Which tables/collections/fields or entities it touches.",
    "   - Any assumptions.",
    "",
    "If the user already provided a query (in any database language), DO NOT generate a different query:",
    "  - Show the exact provided query in a fenced block.",
    "  - Then explain that query as described above.",
    "",
    "Keep answers concise, readable, and developer-friendly.",
    ""
  ].join("\\n");

  const sanitized = escapeBackticks(userPrompt);

  let historySection = '';
  if (chatHistoryText && chatHistoryText.trim()) {
    historySection = [
      "Here is the prior conversation context (earlier user questions and assistant answers).",
      "Use it as context, but focus your answer on the latest user input.",
      "",
      chatHistoryText,
      "",
      "End of prior context.",
      ""
    ].join("\\n");
  }

  const typeHintLine =
    queryType === 'sql_or_mongo'
      ? "Current request type hint: sql_or_mongo. Choose between SQL and MongoDB using the rules above (default to SQL when unclear)."
      : `Current request type hint: ${queryType}. You MUST answer using this query language.`;

  const generationInstruction =
    queryType === 'sql_or_mongo'
      ? "User request (generate an appropriate SQL or MongoDB query from this request, then show the query and explain):"
      : `User request (generate an appropriate ${queryType} query from this request, then show the query and explain):`;

  if (isUserQuery) {
    return [
      instructionHeader,
      typeHintLine,
      "",
      historySection,
      "User-supplied query (explain this as-is):",
      "",
      sanitized,
      "",
      "Respond now."
    ].join("\\n");
  } else {
    return [
      instructionHeader,
      typeHintLine,
      "",
      historySection,
      generationInstruction,
      "",
      sanitized,
      "",
      "Respond now."
    ].join("\\n");
  }
}

async function callLlmWithRetries(guidedPrompt, model, max_tokens, temperature, originalPrompt, originalWasQuery) {
  // First try: use provided temperature
  const attempt = async (opts) => {
    const llmResult = await queryLLM(opts);
    const text = (llmResult && typeof llmResult.text === 'string') ? llmResult.text : String(llmResult?.text || '');
    return { llmResult, text };
  };

  // Attempt 1
  let { llmResult, text } = await attempt({ prompt: guidedPrompt, model, max_tokens, temperature });
  // quick check: does it include JSON with query/explanation or typical fences?
  const formatted = enforceOutputFormat(text, originalPrompt, originalWasQuery);
  if (!/Could not reliably extract a single query/.test(formatted) && (formatted.includes("Here's the query") || /```/.test(formatted))) {
    return { llmResult, text, formatted };
  }

  // Attempt 2 (stricter): force determinism and explicit JSON-only instruction
  const strongerPrompt = guidedPrompt + "\n\nSECOND ATTEMPT: If you did not output the JSON object earlier, output only the JSON object now. Do NOT ask clarifying questions. Use empty \"query\" if you cannot generate one.";
  ({ llmResult, text } = await attempt({ prompt: strongerPrompt, model, max_tokens, temperature: 0.0 }));
  const formatted2 = enforceOutputFormat(text, originalPrompt, originalWasQuery);
  return { llmResult, text, formatted: formatted2 };
}

function enforceOutputFormat(llmText, originalPrompt, originalWasQuery) {
  try {
    if (!llmText) llmText = '';

    // If model already returned with fences, trust it.
    if (/```/.test(llmText)) return llmText;

    // Attempt to extract SQL-like snippet ending with semicolon (simple heuristic)
    const sqlMatch = llmText.match(/((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)[\s\S]{0,2000}?;)/i);
    if (sqlMatch) {
      const querySnippet = sqlMatch[1].trim();
      const before = llmText.slice(0, sqlMatch.index).trim();
      const after = llmText.slice(sqlMatch.index + querySnippet.length).trim();
      const explanation = (after || before || 'No additional explanation provided.').trim();
      return `Here's the query\n\n\`\`\`sql\n${querySnippet}\n\`\`\`\n\n${explanation}`;
    }

    // Attempt to detect Mongo-like snippet
    const mongoMatch = llmText.match(/(db\.[\s\S]{1,2000}?(\)|;))/i);
    if (mongoMatch) {
      const querySnippet = mongoMatch[1].trim().replace(/;$/, '');
      const before = llmText.slice(0, mongoMatch.index).trim();
      const after = llmText.slice(mongoMatch.index + querySnippet.length).trim();
      const explanation = (after || before || 'No additional explanation provided.').trim();
      return `Here's the query\n\n\`\`\`mongodb\n${querySnippet}\n\`\`\`\n\n${explanation}`;
    }

    // If the original prompt was itself the query, prefer showing that query and the model explanation.
    if (originalWasQuery) {
      const langHint = detectQueryLanguageHint(originalPrompt) || (looksLikeMongo(originalPrompt) ? 'mongodb' : 'sql');
      return `Here's the query\n\n\`\`\`${langHint}\n${originalPrompt.trim()}\n\`\`\`\n\nExplanation:\n${llmText.trim() || 'No explanation provided.'}`;
    }

    // Fallback: wrap the whole model reply as the explanation and leave a placeholder for the query.
    return `Here's the query\n\n\`\`\`query\n-- Could not reliably extract a single query from the assistant's output.\n-- Assistant's raw output is provided as the explanation below.\n\`\`\`\n\nExplanation:\n${llmText.trim() || 'No explanation provided.'}`;
  } catch (e) {
    // if anything goes wrong, return a safe fallback
    return `Here's the query\n\n\`\`\`query\n-- (formatting fallback) --\n\`\`\`\n\nExplanation:\nCould not format assistant output due to an internal parsing error.`;
  }
}

function buildChatHistoryText(previousQueries, maxPairs = 3) {
  if (!previousQueries || !previousQueries.length) return '';

  const doneOnly = previousQueries.filter((q) => q.status === 'done');
  const last = doneOnly.slice(-maxPairs);

  const lines = [];

  for (const q of last) {
    if (q.prompt) {
      lines.push(`User: ${q.prompt}`);
    }

    if (q.response) {
      // Only keep the first code block (the query)
      const match = q.response.match(/```[\s\S]*?```/);
      if (match) {
        lines.push(`Assistant (query): ${match[0]}`);
      }
    }
  }

  const joined = lines.join("\n\n");
  // Extra safety: full history text hard capped
  return joined.length > 1800 ? joined.slice(-1800) : joined;
}

/**
 * POST /api/query
 * Body: { chatId, prompt, model?, max_tokens?, temperature? }
 *
 * Minimal Response (200):
 * {
 *   queryId,
 *   chatId,
 *   model,
 *   status,
 *   createdAt,
 *   updatedAt,
 *   response  // STRING (the generated answer only)
 * }
 */
router.post('/', limiter, auth, async (req, res) => {
  let saved; // keep in outer scope so catch can access it
  try {
    const userId = req.userId;
    const { chatId, prompt: rawPrompt, model, max_tokens, temperature } = req.body || {};
    const cleaned = sanitizePrompt(rawPrompt);
    if (!cleaned) return res.status(400).json({ error: 'Prompt is required' });

    // Determine whether the user's prompt already *is* a query (in any supported language)
    const isSQLQuery = looksLikeSQL(cleaned);
    const isMongoQuery = looksLikeMongo(cleaned);
    const isCypherQuery = looksLikeCypher(cleaned);
    const isGraphQLQuery = looksLikeGraphQL(cleaned);
    const originalWasQuery = isSQLQuery || isMongoQuery || isCypherQuery || isGraphQLQuery;

    // Ensure chat exists (only that it belongs to the user)
    let chat = null;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, user: userId });
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
    } else {
      chat = await Chat.create({ user: userId, title: cleaned.slice(0, 50) || 'New Chat' });
    }

    // 👉 Fetch previous queries for this chat (all prior turns)
    const previousQueries = await Query.find({
      chat: chat._id,
      user: userId
    })
      .sort({ createdAt: 1 })
      .lean();

    const chatHistoryText = buildChatHistoryText(previousQueries);

    // Decide which query language to guide the LLM towards
    const langHint = detectQueryLanguageHint(cleaned);
    let queryTypeHint;

    if (langHint) {
      // Explicit language requested (cypher, graphql, cql, redis, etc.) or confidently inferred
      queryTypeHint = langHint;
    } else if (isMongoQuery) {
      queryTypeHint = 'mongodb';
    } else if (isSQLQuery) {
      queryTypeHint = 'sql';
    } else {
      // Ambiguous: let the model choose between SQL and MongoDB, with SQL as default
      queryTypeHint = 'sql_or_mongo';
    }

    // Handle model: respect explicit model, or choose for "auto"/undefined
    const incomingModel = typeof model === 'string' ? model.trim() : undefined;
    let resolvedModel;
    if (incomingModel && incomingModel !== 'auto') {
      resolvedModel = incomingModel;
    } else {
      resolvedModel = chooseModelForPrompt(cleaned, queryTypeHint, originalWasQuery);
    }

    const guidedPrompt = buildGuidedPrompt(
      cleaned,
      originalWasQuery,
      queryTypeHint,
      chatHistoryText
    );

    saved = await Query.create({
      user: userId,
      chat: chat._id,
      prompt: cleaned,
      model: resolvedModel || undefined,
      status: 'pending',
      createdAt: new Date()
    });

    const llmResult = await queryLLM({
      prompt: guidedPrompt,
      model: resolvedModel,
      max_tokens: max_tokens || 512,
      temperature: typeof temperature === 'number' ? temperature : 0.2
    });

    const { text = '', raw = null, usage = null } = llmResult || {};

    const answerStringRaw = (typeof text === 'string') ? text : String(text || '');
    const answerString = enforceOutputFormat(answerStringRaw, cleaned, originalWasQuery);

    saved.response = answerString;
    saved.raw = raw;
    saved.usage = usage;
    saved.model = resolvedModel || saved.model;
    saved.status = 'done';
    await saved.save();

    chat.updatedAt = new Date();
    await chat.save();

    const updatedAt = new Date();
    const payload = {
      queryId: saved._id,
      chatId: chat._id,
      model: saved.model || null,
      status: saved.status,
      createdAt: saved.createdAt,
      updatedAt: updatedAt,
      response: answerString
    };

    return res.json(payload);
  } catch (err) {
    console.error('Query error', err);

    try {
      if (saved && saved._id) {
        saved.status = 'failed';
        saved.response = ''; // no response
        saved.raw = (err?.response?.data) ? err.response.data : { message: err.message };
        saved.errorMessage = String(err.message).slice(0, 1000);
        await saved.save();
      }
    } catch (saveErr) {
      console.error('Failed to update saved query on error:', saveErr);
    }

    return res.status(500).json({
      error: 'LLM request failed',
      message: err.message || 'Unknown error'
    });
  }
});

router.post('/demo', limiter, async (req, res) => {
  try {
    const { prompt: rawPrompt, model, max_tokens, temperature } = req.body || {};
    const cleaned = sanitizePrompt(rawPrompt);
    if (!cleaned) return res.status(400).json({ error: 'Prompt is required' });

    const isSQLQuery = looksLikeSQL(cleaned);
    const isMongoQuery = looksLikeMongo(cleaned);
    const isCypherQuery = looksLikeCypher(cleaned);
    const isGraphQLQuery = looksLikeGraphQL(cleaned);
    const originalWasQuery = isSQLQuery || isMongoQuery || isCypherQuery || isGraphQLQuery;

    // Decide queryTypeHint for demo as well (helps auto-model routing)
    const langHint = detectQueryLanguageHint(cleaned);
    let queryTypeHint;
    if (langHint) {
      queryTypeHint = langHint;
    } else if (isMongoQuery) {
      queryTypeHint = 'mongodb';
    } else if (isSQLQuery) {
      queryTypeHint = 'sql';
    } else {
      queryTypeHint = 'sql_or_mongo';
    }

    // default demo model -> llama3.2:1b, unless "auto" or explicit model
    const incomingModel = typeof model === 'string' ? model.trim() : undefined;
    let modelParam;
    if (incomingModel && incomingModel !== 'auto') {
      modelParam = incomingModel;
    } else {
      modelParam = chooseModelForPrompt(cleaned, queryTypeHint, originalWasQuery, { isDemo: true });
    }

    // Build a much stricter guided prompt: only produce the query text.
    // If ambiguous, the model MUST output exactly the token AMBIGUOUS_PROMPT (no extra text).
    const strictGuidance = [
      "You are an expert assistant that generates a single database query from a user's natural language request.",
      "You can generate SQL, MongoDB queries, or other database query languages such as Cypher (Neo4j), GraphQL, Cassandra CQL, Redis, Elasticsearch DSL, etc.",
      "CRITICAL: Output ONLY the query text and NOTHING ELSE. Do NOT output any explanation, JSON, or surrounding text. Do NOT use code fences.",
      "If the correct output is an SQL query, output the SQL statement ending with a semicolon. Example: SELECT id FROM users;",
      "If the correct output is a MongoDB shell/driver statement, output the mongo command (e.g. db.users.find({...})) exactly.",
      "If the correct output is Cypher, GraphQL, CQL, or another DB language explicitly requested by the user, output a single valid query in that language.",
      "If the user's prompt is ambiguous or does not provide enough information to create an unambiguous query, DO NOT attempt to guess. Instead output exactly the single token: AMBIGUOUS_PROMPT",
      "Do NOT add extra filters, ORDER BY, LIMIT, JOINs, or inferred conditions unless explicitly requested by the user.",
      "",
      "User request:",
      cleaned,
      "",
      "Now output only the query text (or AMBIGUOUS_PROMPT if ambiguous)."
    ].join("\n");

    // Call LLM (pass modelParam). Use a deterministic temperature for consistent demo behaviour.
    const llmCall = await callLlmWithRetries(
      strictGuidance,
      modelParam,
      max_tokens || 256,
      typeof temperature === 'number' ? temperature : 0.0,
      cleaned,
      originalWasQuery
    );

    const answerStringRaw = String(llmCall?.text || '');
    const formattedOrRaw = llmCall?.formatted || answerStringRaw;

    // Helper: extract only the query portion (keeps compatibility with any model noise)
    function extractQueryOnly(formattedOrRawValue, rawText) {
      const candidate = String(formattedOrRawValue || rawText || '').trim();
      if (!candidate) return '';

      // If the model obeyed instructions, it may have returned "AMBIGUOUS_PROMPT"
      if (/^\s*AMBIGUOUS_PROMPT\s*$/i.test(candidate)) return 'AMBIGUOUS_PROMPT';

      // 1) If the candidate contains only a single line and looks like a known query, return it
      if (
        /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(candidate) || // SQL
        /^db\./i.test(candidate) ||                                                 // Mongo
        /^\s*MATCH\b/i.test(candidate) ||                                           // Cypher
        /^\s*(query|mutation|subscription)\b/i.test(candidate) ||                   // GraphQL
        /^\s*\{\s*[A-Za-z0-9_]+\s*\{/i.test(candidate)                              // GraphQL shorthand
      ) {
        return candidate;
      }

      // 2) Look for fenced codeblocks (robustness): extract inner content
      const fence = candidate.match(/```(?:sql|mongodb|cypher|graphql|cql|redis|elasticsearch|query)?\n([\s\S]*?)\n```/i);
      if (fence) return fence[1].trim();

      // 3) Extract SQL snippet ending in semicolon
      const sqlMatch = candidate.match(/((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)[\s\S]{0,2000}?;)/i);
      if (sqlMatch) return sqlMatch[1].trim();

      // 4) Extract a simple mongo shell command
      const mongoMatch = candidate.match(/(db\.[\s\S]{1,2000}?(\)|;))/i);
      if (mongoMatch) return mongoMatch[1].trim().replace(/;$/, '');

      // 5) As a last resort, return the whole candidate (trimmed) so we can inspect it client-side
      return candidate;
    }

    const onlyQuery = extractQueryOnly(formattedOrRaw, answerStringRaw);

    // If model returned ambiguous marker or extraction produced nothing meaningful -> ask user to clarify
    const looksLikeMeaningfulQuery = (q) => {
      if (!q) return false;
      if (/^\s*AMBIGUOUS_PROMPT\s*$/i.test(q)) return false;
      // has SQL keywords or mongo prefix or ends with semicolon (common heuristics)
      if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(q)) return true;
      if (/^db\./i.test(q)) return true;
      if (/^\s*MATCH\b/i.test(q)) return true; // Cypher
      if (/^\s*(query|mutation|subscription)\b/i.test(q)) return true; // GraphQL
      if (/^\s*\{\s*[A-Za-z0-9_]+\s*\{/i.test(q)) return true; // GraphQL shorthand
      if (/;$/i.test(q)) return true;
      return false;
    };

    if (!looksLikeMeaningfulQuery(onlyQuery)) {
      // user-facing clarification message
      const askForClarification = 'Your prompt is ambiguous. Please provide a clearer request (specify the table/collection, fields you want, and any filters).';
      return res.json({
        status: 'ok',
        response: askForClarification
      });
    }

    // Otherwise, return the extracted query text only
    return res.json({
      status: 'ok',
      response: onlyQuery
    });
  } catch (err) {
    console.error('Demo query error', err);
    return res.status(500).json({
      error: 'LLM demo request failed',
      message: err.message || 'Unknown error'
    });
  }
});

module.exports = router;
