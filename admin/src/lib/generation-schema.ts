import * as z from 'zod/v4';

export const TAFSIR_SOURCES = ['mukhtasar_ar', 'saadi'] as const;
export type TafsirSourceId = (typeof TAFSIR_SOURCES)[number];

export const proposalSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['mcq', 'true_false']),
      prompt: z.string(),
      options: z.array(z.string()),
      correct_option: z.number().int().nullable(),
      correct_bool: z.boolean().nullable(),
      benefit: z.string(),
      source: z.enum(TAFSIR_SOURCES),
      surah: z.number().int(),
      ayah: z.number().int(),
      evidence: z.string(),
    }),
  ),
});

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposedQuestion = Proposal['questions'][number];
