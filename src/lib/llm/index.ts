/**
 * Provider-abstracted LLM tool-use wrapper.
 *
 * The two LLM stages in this app — classification and field extraction —
 * both call a single tool and read back structured JSON. By routing every
 * call through `runTool`, swapping providers (Groq → Anthropic → OpenAI →
 * self-hosted vLLM) is a one-line change in this file, not a refactor.
 *
 * Current default: Groq (`llama-3.3-70b-versatile`) on the free tier.
 */

import type { z } from 'zod';
import { runToolGroq } from './groq';

export type LlmProvider = 'groq' | 'anthropic' | 'openai';

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input arguments */
  parameters: Record<string, unknown>;
}

export interface RunToolOptions<T> {
  system: string;
  user: string;
  tool: ToolDefinition;
  /** Zod schema used to validate and type the tool's returned arguments */
  schema: z.ZodType<T>;
  model?: string;
  temperature?: number;
  /** Optional override; defaults to env LLM_PROVIDER */
  provider?: LlmProvider;
}

export interface RunToolResult<T> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
  model: string;
  provider: LlmProvider;
  /** Raw tool-call arguments JSON string — stored in ParseRun for audit */
  rawArgs: string;
}

export async function runTool<T>(opts: RunToolOptions<T>): Promise<RunToolResult<T>> {
  const provider = opts.provider ?? (process.env.LLM_PROVIDER as LlmProvider) ?? 'groq';

  switch (provider) {
    case 'groq':
      return runToolGroq(opts);
    case 'anthropic':
    case 'openai':
      throw new Error(`Provider "${provider}" not yet implemented — add lib/llm/${provider}.ts`);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
