// Server-only Lovable AI Gateway access for the Phase 5 AI review. Credentials never leave the server.
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { APICallError, NoObjectGeneratedError, Output, streamText, type ModelMessage } from 'ai';
import { aiResponseSchema, errorKindForStatus, type AiErrorKind } from './ai-review';

export const AI_MODEL = 'google/gemini-3-flash-preview';
export const AI_PROVIDER = 'lovable-ai';
const GATEWAY = 'https://ai.gateway.lovable.dev/v1';

export class AiCallError extends Error { constructor(public kind: AiErrorKind, detail?: string) { super(detail ?? kind); } }

export type ModelCaller = (input: { system: string; messages: ModelMessage[] }) => Promise<unknown>;

function provider(apiKey: string) {
  let runId: string | undefined;
  return createOpenAICompatible({
    name: 'lovable', baseURL: GATEWAY, supportsStructuredOutputs: true,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: async (input, init) => {
      const h = new Headers(init?.headers); if (runId) h.set('X-Lovable-AIG-Run-ID', runId);
      const r = await fetch(input, { ...init, headers: h }); runId ??= r.headers.get('X-Lovable-AIG-Run-ID') ?? undefined; return r;
    },
  });
}

/** Real model call: streamed, structured output, no artificial timeout, no automatic retry. */
export const callGatewayModel: ModelCaller = async ({ system, messages }) => {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new AiCallError('configuration', 'missing key');
  let streamError: unknown;
  try {
    const result = streamText({ model: provider(key)(AI_MODEL), system, messages, output: Output.object({ schema: aiResponseSchema }), maxRetries: 0, onError: ({ error }) => { streamError = error; } });
    return await result.output;
  } catch (e) {
    throw classify(streamError ?? e);
  }
};

export function classify(e: unknown): AiCallError {
  if (e instanceof AiCallError) return e;
  if (APICallError.isInstance(e)) return new AiCallError(errorKindForStatus(e.statusCode), `status ${e.statusCode ?? 'none'}`);
  if (NoObjectGeneratedError.isInstance(e)) return new AiCallError('invalid_response', 'no object');
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  if (/timeout|timed out/i.test(msg)) return new AiCallError('timeout', 'timeout');
  if (/fetch failed|network|ECONN|ENOTFOUND|socket/i.test(msg)) return new AiCallError('network', 'network');
  if (/refus/i.test(msg)) return new AiCallError('refused', 'refused');
  return new AiCallError('invalid_response', msg.slice(0, 120));
}
