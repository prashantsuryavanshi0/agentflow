/**
 * Real LLM call for `llm_call` steps, using Groq's OpenAI-compatible
 * endpoint (free tier). If no GROQ_API_KEY is set, falls back to a
 * clearly-labelled stub with a disclosed artificial delay, per the
 * assignment's own escape hatch — never silently fakes a real call.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface LLMCallResult {
  text: string;
  stubbed: boolean;
  model: string;
}

export async function callLLM(
  prompt: string,
  opts: { model?: string; system?: string } = {}
): Promise<LLMCallResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = opts.model || "llama-3.1-8b-instant";

  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 1200)); // disclosed artificial delay
    return {
      text: `[stubbed llm response — set GROQ_API_KEY to call a real model] Echo: ${prompt.slice(
        0,
        200
      )}`,
      stubbed: true,
      model: "stub",
    };
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM call failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, stubbed: false, model };
}
