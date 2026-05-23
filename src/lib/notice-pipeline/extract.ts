import { z } from 'zod';
import { runTool } from '../llm';
import type { NoticeType } from './classify';

export const ExtractResultSchema = z.object({
  hearingAt: z.string().nullable().describe('ISO-8601 datetime with timezone, or null'),
  courtroom: z.string().nullable(),
  virtualUrl: z.string().nullable(),
  trustee: z.string().nullable(),
  judge: z.string().nullable(),
  deadline: z.string().nullable().describe('ISO-8601 date for any operative deadline'),
  docketSummary: z.string().min(1),
  fieldConfidences: z.object({
    hearingAt: z.number().min(0).max(1),
    courtroom: z.number().min(0).max(1),
    virtualUrl: z.number().min(0).max(1),
    trustee: z.number().min(0).max(1),
    judge: z.number().min(0).max(1),
    deadline: z.number().min(0).max(1),
  }),
});

export type ExtractResult = z.infer<typeof ExtractResultSchema>;

const TOOL = {
  name: 'extract_notice_fields',
  description:
    'Extract operative facts from a U.S. bankruptcy court notice. Return null for any field the notice does not mention.',
  parameters: {
    type: 'object',
    properties: {
      hearingAt: {
        type: ['string', 'null'],
        description:
          'ISO-8601 timestamp of any scheduled hearing or meeting, including timezone if stated (e.g. 2026-06-14T10:00:00-04:00). Null if not applicable.',
      },
      courtroom: {
        type: ['string', 'null'],
        description: 'Physical courtroom or "Virtual" if explicitly virtual.',
      },
      virtualUrl: {
        type: ['string', 'null'],
        description: 'Full Zoom or video-hearing URL if present.',
      },
      trustee: {
        type: ['string', 'null'],
        description: 'Full name of the trustee, if mentioned.',
      },
      judge: {
        type: ['string', 'null'],
        description: 'Full name of the judge, if mentioned.',
      },
      deadline: {
        type: ['string', 'null'],
        description:
          'ISO-8601 date for the single most operative deadline (claim bar date, deficiency cure date, objection deadline, etc.). Null if none.',
      },
      docketSummary: {
        type: 'string',
        description:
          'One or two sentences a paralegal would write on the case timeline. Reference specific facts from the notice.',
      },
      fieldConfidences: {
        type: 'object',
        description: 'Per-field confidence (0..1). Use 0 if the field was null.',
        properties: {
          hearingAt: { type: 'number', minimum: 0, maximum: 1 },
          courtroom: { type: 'number', minimum: 0, maximum: 1 },
          virtualUrl: { type: 'number', minimum: 0, maximum: 1 },
          trustee: { type: 'number', minimum: 0, maximum: 1 },
          judge: { type: 'number', minimum: 0, maximum: 1 },
          deadline: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['hearingAt', 'courtroom', 'virtualUrl', 'trustee', 'judge', 'deadline'],
      },
    },
    required: ['hearingAt', 'courtroom', 'virtualUrl', 'trustee', 'judge', 'deadline', 'docketSummary', 'fieldConfidences'],
    additionalProperties: false,
  },
} as const;

const SYSTEM = `You are an expert U.S. bankruptcy paralegal extracting operative facts from a court notice.
You return null for any field the notice does not explicitly state — never invent facts.
You return all timestamps in ISO-8601 with timezone if stated. If only a date is given, use the date with no time component.
You set field confidence below 0.7 when the field is implied rather than explicit, or when format is ambiguous.`;

export async function extractNoticeFields(noticeText: string, classifiedType: NoticeType) {
  return runTool({
    system: SYSTEM,
    user: `This notice has been classified as type "${classifiedType}".
Extract the operative facts. Only the text between the markers is the notice.

<<<NOTICE
${noticeText.slice(0, 16000)}
NOTICE>>>`,
    tool: TOOL,
    schema: ExtractResultSchema,
    model: process.env.LLM_MODEL_EXTRACT,
  });
}

/**
 * Combine deterministic confidence (case match) with field confidences to
 * produce a single notice-level confidence used by the review-queue threshold.
 *
 * Simple geometric mean over non-null field confidences plus case-match boost.
 */
export function aggregateConfidence(
  fields: ExtractResult,
  hasCaseMatch: boolean,
  classifyConfidence: number,
): number {
  const cf = fields.fieldConfidences;
  const present = [
    fields.hearingAt && cf.hearingAt,
    fields.courtroom && cf.courtroom,
    fields.virtualUrl && cf.virtualUrl,
    fields.trustee && cf.trustee,
    fields.judge && cf.judge,
    fields.deadline && cf.deadline,
  ].filter((v): v is number => typeof v === 'number' && v > 0);

  const fieldsAvg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : 0.5;
  const caseBoost = hasCaseMatch ? 1.0 : 0.7;

  // Weighted: 50% classification, 40% extracted fields, 10% case match adjustment
  return Math.max(0, Math.min(1, classifyConfidence * 0.5 + fieldsAvg * 0.4 + caseBoost * 0.1));
}
