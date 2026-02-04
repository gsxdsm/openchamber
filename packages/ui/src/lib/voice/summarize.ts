/**
 * Text summarization utility for TTS
 * 
 * Calls the server-side summarization endpoint which uses
 * the opencode.ai zen API with gpt-5-nano.
 */

import { useConfigStore } from '@/stores/useConfigStore';

/**
 * Summarize text using the server-side zen API endpoint
 * 
 * @param text - The text to summarize
 * @param options - Optional configuration
 * @returns The summarized text, or original text if summarization fails
 */
export async function summarizeText(
    text: string,
    options?: {
        /** Character threshold - don't summarize if under this length */
        threshold?: number;
    }
): Promise<string> {
    const store = useConfigStore.getState();
    const threshold = options?.threshold ?? store.summarizeCharacterThreshold;
    
    // Don't summarize if text is under threshold
    if (text.length <= threshold) {
        return text;
    }
    
    try {
        const response = await fetch('/api/tts/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, threshold }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[summarize] HTTP error ${response.status}:`, errorText);
            throw new Error(`Summarization failed: ${response.status}`);
        }
        
        const data = await response.json() as {
            summarized: boolean;
            summary?: string;
            reason?: string;
            originalLength?: number;
            summaryLength?: number;
        };
        
        if (data.summarized && data.summary) {
            return data.summary;
        }
        
        // Return original text if not summarized
        return text;
    } catch (err) {
        console.error('[summarize] Failed to summarize:', err);
        // Return original text on error
        return text;
    }
}

/**
 * Check if text should be summarized based on settings
 */
export function shouldSummarize(
    text: string,
    context: 'message' | 'voice'
): boolean {
    const store = useConfigStore.getState();
    
    const isEnabled = context === 'message' 
        ? store.summarizeMessageTTS 
        : store.summarizeVoiceConversation;
    
    if (!isEnabled) {
        return false;
    }
    
    return text.length > store.summarizeCharacterThreshold;
}
