import Groq from 'groq-sdk';
import type { RunToolOptions, RunToolResult } from './index';

let _client: Groq | null = null;
function client(): Groq {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Add it to .env.local.');
  }
  _client = new Groq({ apiKey });
  return _client;
}

export async function runToolGroq<T>(opts: RunToolOptions<T>): Promise<RunToolResult<T>> {
  const model = opts.model ?? process.env.LLM_MODEL_CLASSIFY ?? 'llama-3.3-70b-versatile';
  const started = Date.now();

  const completion = await client().chat.completions.create({
    model,
    temperature: opts.temperature ?? 0,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: opts.tool.name,
          description: opts.tool.description,
          parameters: opts.tool.parameters,
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: opts.tool.name } },
  });

  const durationMs = Date.now() - started;
  const choice = completion.choices[0];
  const call = choice.message.tool_calls?.[0];
  if (!call || call.function.name !== opts.tool.name) {
    throw new Error(`Groq did not call expected tool "${opts.tool.name}"`);
  }

  const rawArgs = call.function.arguments ?? '{}';
  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(rawArgs);
  } catch (e) {
    throw new Error(`Failed to parse tool arguments as JSON: ${e instanceof Error ? e.message : e}`);
  }

  const result = opts.schema.safeParse(parsedArgs);
  if (!result.success) {
    throw new Error(`Tool arguments failed schema validation: ${result.error.message}`);
  }

  return {
    data: result.data,
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
    durationMs,
    model,
    provider: 'groq',
    rawArgs,
  };
}
