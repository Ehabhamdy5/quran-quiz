import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { proposalSchema, type Proposal } from './generation-schema';
import { GenerationError, type Prompt } from './generation';

export const GENERATION_MODEL = 'claude-opus-5-5';

export async function proposeWithClaude(prompt: Prompt, client = new Anthropic()): Promise<Proposal> {
  const response = await client.beta.messages.parse({
    model: GENERATION_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(proposalSchema) },
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  if (response.stop_reason === 'refusal') throw new GenerationError('اعتذر النموذج عن هذا الطلب؛ جرّب آيات أخرى');
  if (response.stop_reason === 'max_tokens') throw new GenerationError('انقطع الرد قبل اكتماله؛ قلّل عدد الأسئلة');
  if (!response.parsed_output) throw new GenerationError('رد النموذج لم يطابق الصيغة المطلوبة');
  return response.parsed_output;
}
