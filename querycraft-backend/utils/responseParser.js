// utils/responseParser.js
function tryParsePossibleJsonString(s) {
  if (!s || typeof s !== 'string') return s;
  s = s.trim();
  // Quick heuristic: starts with { and ends with } -> try parse
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('"') && s.endsWith('"'))) {
    try {
      // remove surrounding quotes if present (sometimes double-encoded)
      if (s.startsWith('"') && s.endsWith('"')) {
        s = JSON.parse(s); // unescape quoted JSON string
      }
      const parsed = JSON.parse(s);
      // If parsed has a "response" field use that
      if (parsed && typeof parsed.response === 'string') return parsed.response;
      // fallback to other fields
      if (parsed && typeof parsed.output === 'string') return parsed.output;
      if (parsed && typeof parsed.result === 'string') return parsed.result;
      // otherwise return original string
      return s;
    } catch (e) {
      return s;
    }
  }
  return s;
}

function stripCodeFences(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove leading/trailing whitespace
  let t = text.trim();
  // If there's a ```sql or ``` block, extract that block contents
  const fenceMatch = t.match(/```(?:sql)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  // Also handle inline backticks or ``` without sql label
  const fenceMatch2 = t.match(/```([\s\S]*?)```/);
  if (fenceMatch2 && fenceMatch2[1]) return fenceMatch2[1].trim();
  // If no fences, just return the whole text
  return t;
}

function extractSQL(text) {
  if (!text || typeof text !== 'string') return null;
  // try to find obvious SQL starting keywords and capture until end
  const sqlMatch = text.match(/((?:SELECT|WITH|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b[\s\S]*)/i);
  if (sqlMatch) {
    // Trim trailing explanation (stop at two newlines or end)
    let candidate = sqlMatch[1].trim();
    // If candidate contains explanation separated by blank line, take the first block
    const splitByBlank = candidate.split(/\n\s*\n/);
    return splitByBlank[0].trim();
  }
  return null;
}

/**
 * Main parser: returns { cleanedText, sql }
 */
function parseLLMResponseText(possibleJsonString, rawObj) {
  // Step 1: if the text itself is a JSON-string, parse it out
  let afterJson = tryParsePossibleJsonString(possibleJsonString);

  // Step 2: if that still looks like JSON-like object (object passed as raw), try to fetch common fields
  if ((!afterJson || afterJson.trim() === '') && rawObj && typeof rawObj === 'object') {
    if (typeof rawObj.response === 'string') afterJson = rawObj.response;
    else if (typeof rawObj.output === 'string') afterJson = rawObj.output;
    else if (Array.isArray(rawObj.output)) afterJson = rawObj.output.join('\n');
    else if (rawObj.choices && rawObj.choices[0]) {
      const c = rawObj.choices[0];
      afterJson = c.message?.content || c.text || JSON.stringify(c).slice(0, 2000);
    }
  }

  // Step 3: cleaned text and SQL extraction
  const cleanedText = (afterJson || '').trim();
  const sqlFromFence = stripCodeFences(cleanedText);
  const sql = sqlFromFence && sqlFromFence.length > 0 ? sqlFromFence : extractSQL(cleanedText);

  return { cleanedText, sql };
}

module.exports = { parseLLMResponseText };
