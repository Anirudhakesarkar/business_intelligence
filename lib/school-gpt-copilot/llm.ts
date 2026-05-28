import { buildCopilotPrompt } from './context-builder';
import { checkRateLimit, logGptCost, validateResponseCitations } from './guardrails';
import type { SchoolGptContext } from './types';

export type LlmResult = { text: string; model: string; provider: 'openai' | 'demo' };

export async function callSchoolLlm(context: SchoolGptContext, userQuestion?: string): Promise<LlmResult> {
  const orgId = context.org_id ?? 1;
  const limited = checkRateLimit(orgId);
  if (!limited.ok) {
    return { text: '', model: 'rate-limited', provider: 'demo' };
  }
  const prompt = buildCopilotPrompt(context, userQuestion);
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  if (!apiKey) {
    return { text: '', model: 'demo', provider: 'demo' };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content:
              'You are a school principal intelligence assistant. Use ONLY the JSON context provided. Cite module keys. Do not invent facts.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let text = data.choices?.[0]?.message?.content?.trim() ?? '';
    const cite = validateResponseCitations(text, context);
    if (!cite.ok) {
      text += `\n\n(Note: omitted ungrounded references: ${cite.unknown.join(', ')})`;
    }
    logGptCost(orgId, model, prompt.length, text.length);
    return { text, model, provider: 'openai' };
  } catch (e) {
    console.error('[school-gpt] LLM call failed:', e);
    return { text: '', model: 'demo', provider: 'demo' };
  }
}
