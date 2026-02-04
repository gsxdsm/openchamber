import type { Part } from '@opencode-ai/sdk/v2';

// Cache for summaries to avoid re-summarizing the same message
const summaryCache = new Map<string, string>();

/**
 * Resolve the server base origin (web, desktop, or VS Code).
 */
function resolveBaseOrigin(): string {
  if (typeof window === 'undefined') return '';
  const desktopOrigin = (
    window as unknown as {
      __OPENCHAMBER_DESKTOP_SERVER__?: { origin: string };
    }
  ).__OPENCHAMBER_DESKTOP_SERVER__?.origin;
  if (desktopOrigin) return desktopOrigin;
  return window.location.origin;
}

/**
 * Extract text content from message parts
 */
export function extractTextContent(parts: Part[]): string {
  let text = '';
  for (const part of parts) {
    if (part.type === 'text') {
      const textPart = part as { text?: string; content?: string };
      text += textPart.text ?? textPart.content ?? '';
    }
  }
  return text.trim();
}

/**
 * Summarize text by calling the server-side /api/summarize endpoint,
 * which uses the zen API for LLM-based summarization.
 */
async function summarizeViaServer(
  text: string,
  threshold: number,
  maxLength: number,
): Promise<string> {
  // Check cache
  const cacheKey = `${text.slice(0, 100)}_${maxLength}`;
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL('/api/summarize', resolveBaseOrigin());
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        threshold,
        maxLength,
      }),
    });

    if (!response.ok) {
      console.error('[ntfy] Summarization request failed:', response.status);
      return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
    }

    const data = (await response.json()) as {
      summary?: string;
      summarized?: boolean;
      reason?: string;
    };

    const summary = data.summary || text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');

    // Cache the result
    summaryCache.set(cacheKey, summary);

    // Limit cache size
    if (summaryCache.size > 100) {
      const firstKey = summaryCache.keys().next().value;
      if (firstKey) summaryCache.delete(firstKey);
    }

    return summary;
  } catch (error) {
    console.error('[ntfy] Summarization error:', error);
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
  }
}

/**
 * Get notification body text based on summarization settings
 */
export async function getNotificationBody(
  parts: Part[],
  options: {
    summarizationEnabled: boolean;
    threshold: number;
    maxLength: number;
  }
): Promise<string> {
  const rawText = extractTextContent(parts);
  const limit = options.maxLength;

  // If summarization is disabled, return truncated raw text
  if (!options.summarizationEnabled) {
    return rawText.slice(0, limit) + (rawText.length > limit ? '...' : '');
  }

  // If text is below threshold, return it as-is
  if (rawText.length < options.threshold) {
    return rawText;
  }

  // Use LLM-based summarization via server
  return summarizeViaServer(rawText, options.threshold, limit);
}

/**
 * Clear the summary cache
 */
export function clearSummaryCache(): void {
  summaryCache.clear();
}
