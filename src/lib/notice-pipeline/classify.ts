import { z } from 'zod';
import { runTool } from '../llm';

export const NOTICE_TYPES = [
  'meeting_341',
  'deficiency',
  'motion_to_dismiss',
  'discharge',
  'relief_from_stay',
  'claim_deadline',
  'unknown',
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];

export const ClassifyResultSchema = z.object({
  type: z.enum(NOTICE_TYPES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type ClassifyResult = z.infer<typeof ClassifyResultSchema>;

const TOOL = {
  name: 'classify_notice',
  description:
    'Classify a U.S. bankruptcy court notice into one of the operationally distinct types used by a paralegal team.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: NOTICE_TYPES,
        description: [
          'meeting_341: notice of meeting of creditors under 11 U.S.C. § 341(a)',
          'deficiency: notice of deficient filing (missing or incomplete schedules/forms)',
          'motion_to_dismiss: motion or notice seeking dismissal of the case',
          'discharge: discharge order under § 727 (Ch 7) or § 1328 (Ch 13)',
          'relief_from_stay: motion for relief from the automatic stay',
          'claim_deadline: bar date / claim filing deadline notice',
          'unknown: does not match any of the above; flag for human review',
        ].join('; '),
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'How confident you are in this classification (0..1).',
      },
      reasoning: {
        type: 'string',
        description: 'Two-sentence justification citing language from the notice.',
      },
    },
    required: ['type', 'confidence', 'reasoning'],
    additionalProperties: false,
  },
} as const;

const SYSTEM = `You are an expert U.S. bankruptcy paralegal triaging incoming court notices.
You only classify notices into the exact enum values provided. You do not invent new categories.
You set confidence below 0.7 when the notice does not unambiguously match one type.`;

export async function classifyNotice(noticeText: string) {
  return runTool({
    system: SYSTEM,
    user: `Classify this notice. Only the text between the markers is the notice; ignore anything outside.

<<<NOTICE
${noticeText.slice(0, 16000)}
NOTICE>>>`,
    tool: TOOL,
    schema: ClassifyResultSchema,
    model: process.env.LLM_MODEL_CLASSIFY,
  });
}
