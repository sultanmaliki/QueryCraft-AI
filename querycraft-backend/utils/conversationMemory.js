// utils/conversationMemory.js
const Query = require('../models/Query');
const Chat = require('../models/Chat');
const { queryLLM } = require('./llm');

const DEFAULT_SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'mistral:7b-instruct';
const SUMMARY_OLDEST_COUNT = parseInt(process.env.SUMMARY_OLDEST_COUNT || '15', 10); // oldest 15 messages
const SUMMARY_MAX_TOKENS = parseInt(process.env.SUMMARY_MAX_TOKENS || '400', 10);

/**
 * Summarize oldest K messages for a chat into a short bulleted summary,
 * persist to Chat.memorySummary.
 *
 * Non-blocking: this function returns a Promise, caller should handle errors.
 */
async function createConversationSummary(chatId, opts = {}) {
  const model = opts.model || DEFAULT_SUMMARY_MODEL;
  const oldestCount = opts.oldestCount || SUMMARY_OLDEST_COUNT;
  const maxTokens = opts.maxTokens || SUMMARY_MAX_TOKENS;

  // Fetch oldest completed queries for the chat (oldest -> newest)
  const recent = await Query.find({ chat: chatId, status: 'done' })
    .sort({ createdAt: 1 })
    .limit(oldestCount)
    .lean();

  if (!recent || recent.length === 0) {
    // nothing to summarize
    return null;
  }

  // Build compact conversation text for summarization
  const text = recent
    .map(r => {
      const u = String(r.prompt || r.input || '').replace(/\s+/g, ' ').trim();
      const a = String(r.response || r.answer || '').replace(/\s+/g, ' ').trim();
      return `User: ${u}\nAssistant: ${a}`;
    })
    .join('\n\n');

  // Create summarization prompt (concise bulleted facts)
  const summaryPrompt = `
Summarize the following conversation into concise bullets listing:
- user's goals
- important facts about the user or dataset
- constraints or preferences revealed
Omit trivial chit-chat. Keep it short (6-10 bullets max).

Conversation:
${text}

Summary:
-`;

  // Call your queryLLM util (returns { text, raw, usage, sql? } per your utils/llm.js)
  const llmResult = await queryLLM({
    prompt: summaryPrompt,
    model,
    max_tokens: maxTokens,
    temperature: 0.0
  });

  const summaryText = (llmResult && (llmResult.text || llmResult.cleanedText || llmResult.response)) || '';

  // Persist to Chat
  await Chat.updateOne(
    { _id: chatId },
    {
      $set: {
        memorySummary: summaryText || '',
        memorySummaryUpdatedAt: new Date()
      }
    }
  );

  return summaryText;
}

module.exports = { createConversationSummary };
