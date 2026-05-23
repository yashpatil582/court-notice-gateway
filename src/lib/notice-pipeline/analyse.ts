/**
 * Single combined LLM stage: classify + extract operative fields in one
 * tool-use call. Replaces the previous two sequential calls (which were
 * unnecessary for a 70B model with tool-use) and roughly halves the
 * end-to-end ingest latency.
 *
 * Output shape mirrors the original classify + extract returns so callers
 * don't have to change.
 */

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

export const FieldConfidencesSchema = z.object({
  hearingAt: z.number().min(0).max(1),
  courtroom: z.number().min(0).max(1),
  virtualUrl: z.number().min(0).max(1),
  trustee: z.number().min(0).max(1),
  judge: z.number().min(0).max(1),
  deadline: z.number().min(0).max(1),
});

export const AnalyseResultSchema = z.object({
  type: z.enum(NOTICE_TYPES),
  classifyConfidence: z.number().min(0).max(1),
  classifyReasoning: z.string().min(1),
  hearingAt: z.string().nullable(),
  courtroom: z.string().nullable(),
  virtualUrl: z.string().nullable(),
  trustee: z.string().nullable(),
  judge: z.string().nullable(),
  deadline: z.string().nullable(),
  docketSummary: z.string().min(1),
  fieldConfidences: FieldConfidencesSchema,
});

export type AnalyseResult = z.infer<typeof AnalyseResultSchema>;

const TOOL = {
  name: 'analyse_notice',
  description:
    'Classify a U.S. bankruptcy court notice and extract its operative facts in a single call.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: NOTICE_TYPES,
        description: [
          'meeting_341: notice of meeting of creditors under 11 U.S.C. § 341(a)',
          'deficiency: notice of deficient filing (missing or incomplete schedules/forms/fees)',
          'motion_to_dismiss: motion or notice seeking dismissal of the case',
          'discharge: discharge order under § 727 (Ch 7) or § 1328 (Ch 13)',
          'relief_from_stay: motion for relief from the automatic stay',
          'claim_deadline: bar date / claim filing deadline notice',
          'unknown: does not match any of the above; flag for human review',
        ].join('; '),
      },
      classifyConfidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'How confident you are in the classification (0..1).',
      },
      classifyReasoning: {
        type: 'string',
        description: 'Two-sentence justification citing language from the notice.',
      },
      hearingAt: {
        type: ['string', 'null'],
        description:
          'ISO-8601 timestamp of any scheduled hearing or meeting, including timezone if stated (e.g. 2026-06-14T10:00:00-04:00). Null if not applicable.',
      },
      courtroom: {
        type: ['string', 'null'],
        description: 'Physical courtroom or "Virtual" if explicitly virtual. Null if not stated.',
      },
      virtualUrl: {
        type: ['string', 'null'],
        description: 'Full Zoom or video-hearing URL if present. Null otherwise.',
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
        description: 'Per-field confidence (0..1). Use 0 for any field returned as null.',
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
    required: [
      'type',
      'classifyConfidence',
      'classifyReasoning',
      'hearingAt',
      'courtroom',
      'virtualUrl',
      'trustee',
      'judge',
      'deadline',
      'docketSummary',
      'fieldConfidences',
    ],
    additionalProperties: false,
  },
} as const;

const SYSTEM = `You are an expert U.S. bankruptcy paralegal triaging incoming court notices.

You classify each notice into the exact enum values provided — never invent new categories.
You return null for any operative field the notice does not explicitly state — never invent facts.
You return all timestamps in ISO-8601 with timezone if stated. If only a date is given, use the date with no time component.
You set classifyConfidence below 0.7 when the notice does not unambiguously match one type.
You set field confidence below 0.7 when the field is implied rather than explicit, or when format is ambiguous.`;

export async function analyseNoticeLlm(noticeText: string) {
  return runTool({
    system: SYSTEM,
    user: `Classify and extract from this notice. Only the text between the markers is the notice.

<<<NOTICE
${noticeText.slice(0, 16000)}
NOTICE>>>`,
    tool: TOOL,
    schema: AnalyseResultSchema,
    model: process.env.LLM_MODEL_CLASSIFY,
  });
}

/**
 * Combine deterministic confidence (case match) with field confidences to
 * produce a single notice-level confidence used by the review-queue threshold.
 *
 * Weighted: 50% classification, 40% extracted-field average, 10% case-match boost.
 */
export function aggregateConfidence(
  fields: AnalyseResult,
  hasCaseMatch: boolean,
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

  return Math.max(
    0,
    Math.min(1, fields.classifyConfidence * 0.5 + fieldsAvg * 0.4 + caseBoost * 0.1),
  );
}
