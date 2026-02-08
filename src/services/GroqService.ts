import { logger } from '../utils/logger';
import { GROQ_API_KEY } from 'react-native-dotenv';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// In-memory cache for summaries
const summaryCache = new Map<string, string>();

export async function getIssueSummary(
  title: string,
  body: string,
  labels: string[],
  repo: string,
): Promise<string> {
  const cacheKey = `${repo}:${title}`;
  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  const labelsStr = labels.length > 0 ? `Labels: ${labels.join(', ')}` : '';
  const bodyTrimmed = (body || '').slice(0, 800);

  const prompt = `Summarize this GitHub issue in exactly 2 short sentences (max 120 chars total). Be concise and actionable.

Title: ${title}
Repo: ${repo}
${labelsStr}
Description: ${bodyTrimmed}

Summary:`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a concise technical summarizer. Respond with exactly 2 short sentences summarizing the GitHub issue. No markdown, no bullet points.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn('Groq API error', { status: response.status, body: errText });
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || 'Unable to generate summary.';

    summaryCache.set(cacheKey, summary);
    return summary;
  } catch (error) {
    logger.error('Failed to get AI summary', error);
    throw error;
  }
}
