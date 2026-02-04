/**
 * Text Summarization Service
 *
 * Uses the opencode.ai/zen API (same as commit-message generation)
 * for fast, reliable one-shot summarization.
 */

/**
 * Summarize text using the zen API
 *
 * @param {Object} options
 * @param {string} options.text - The text to summarize
 * @param {number} options.threshold - Character threshold
 * @param {number} [options.maxLength] - Maximum summary length in characters
 * @returns {Promise<{summary: string, summarized: boolean, reason?: string}>}
 */
export async function summarizeText({
  text,
  threshold = 200,
  maxLength = 300,
}) {
  // Don't summarize if text is under threshold
  if (!text || text.length <= threshold) {
    return {
      summary: text || '',
      summarized: false,
    };
  }

  try {
    const prompt = `Summarize for a phone push notification. ${maxLength} characters max. Shorter is better.

Rules:
1. Output ONLY the summary — no thinking, no preamble, no quotes
2. Plain text only — no markdown, no code, no URLs, no file paths
3. State WHAT was done, not how. Be direct.

Text to summarize:
${text.slice(0, 4000)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch('https://opencode.ai/zen/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: [{ role: 'user', content: prompt }],
          max_output_tokens: Math.ceil(maxLength / 2),
          stream: false,
          reasoning: { effort: 'low' },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('[Summarize] zen API error:', response.status, errorBody);
      return {
        summary: text.slice(0, maxLength) + (text.length > maxLength ? '...' : ''),
        summarized: false,
        reason: `zen API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const raw = data?.output
      ?.find((item) => item?.type === 'message')
      ?.content?.find((item) => item?.type === 'output_text')
      ?.text?.trim();

    if (raw) {
      return {
        summary: raw,
        summarized: true,
      };
    }

    return {
      summary: text.slice(0, maxLength) + (text.length > maxLength ? '...' : ''),
      summarized: false,
      reason: 'No text in zen response',
    };
  } catch (error) {
    console.error('[Summarize] Error:', error.message);
    return {
      summary: text.slice(0, maxLength) + (text.length > maxLength ? '...' : ''),
      summarized: false,
      reason: error.message,
    };
  }
}
