import { requestSchema, GenerationError, type GenerateRequest } from './generation';
import { proposalSchema, type Proposal } from './generation-schema';

// ملف مسودات: الطلب نفسه الذي في صفحة التوليد، والأسئلة بصيغة مخرجات Claude نفسها،
// لتمر بالفحص الآلي ذاته قبل الحفظ.
export function parseDraftFile(json: unknown): { request: GenerateRequest; proposal: Proposal } {
  const obj = (json ?? {}) as { request?: unknown; questions?: unknown };
  const request = requestSchema.safeParse(obj.request);
  if (!request.success) throw new GenerationError(request.error.issues.map((i) => i.message).join('، '));
  const proposal = proposalSchema.safeParse({ questions: obj.questions });
  if (!proposal.success) throw new GenerationError('صيغة الأسئلة غير صحيحة');
  return { request: request.data, proposal: proposal.data };
}
