/**
 * Full notice ingest pipeline.
 *
 * Stages, in order:
 *   1. Deterministic — case-number regex, sender allowlist, link host validation
 *   2. Classification — Groq tool-use returns notice type + confidence
 *   3. Extraction — Groq tool-use returns operative fields + per-field confidences
 *   4. Routing — aggregate confidence, decide between routed | needs_review
 *
 * The deterministic stage can short-circuit with `suspicious` and skip LLM
 * work entirely (which also saves Groq tokens).
 *
 * Every LLM call is persisted as a ParseRun row so we can audit cost, latency,
 * raw output, and which prompt produced which result.
 */

import { db, schema } from '@/db';
import { analyseNotice } from '../parsing';
import { findOrCreateCase } from '../case-lookup';
import { classifyNotice } from './classify';
import { extractNoticeFields, aggregateConfidence } from './extract';

const REVIEW_THRESHOLD = Number(process.env.REVIEW_CONFIDENCE_THRESHOLD ?? 0.75);

export type IngestInput = {
  text: string;
  rawFileUrl: string;
  senderEmail?: string | null;
};

export type IngestResult = {
  noticeId: string;
  status: 'received' | 'needs_review' | 'routed' | 'suspicious';
  caseNumber: string | null;
  type: string | null;
  confidence: number | null;
  hearingAt: Date | null;
  deterministicReasons: string[];
};

function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function ingestNotice(input: IngestInput): Promise<IngestResult> {
  const analysis = analyseNotice({ text: input.text, senderEmail: input.senderEmail ?? null });
  const caseId = analysis.caseNumber ? await findOrCreateCase(analysis.caseNumber) : null;

  // Short-circuit: suspicious notices skip the LLM entirely.
  if (analysis.verdict === 'suspicious') {
    const [notice] = await db
      .insert(schema.notices)
      .values({
        caseId,
        source: 'pdf',
        status: 'suspicious',
        rawText: input.text,
        rawFileUrl: input.rawFileUrl,
        senderEmail: input.senderEmail ?? null,
        senderDomain: analysis.sender?.domain ?? null,
      })
      .returning({ id: schema.notices.id });

    await writeAudit(notice.id, 'ingested', {
      verdict: 'suspicious',
      caseNumber: analysis.caseNumber?.caseNumber ?? null,
      reasons: analysis.reasons,
      llmSkipped: true,
    });

    return {
      noticeId: notice.id,
      status: 'suspicious',
      caseNumber: analysis.caseNumber?.caseNumber ?? null,
      type: null,
      confidence: null,
      hearingAt: null,
      deterministicReasons: analysis.reasons,
    };
  }

  // Classification stage
  const classify = await classifyNotice(input.text);

  // Extraction stage
  const extract = await extractNoticeFields(input.text, classify.data.type);

  const overallConfidence = aggregateConfidence(
    extract.data,
    Boolean(caseId),
    classify.data.confidence,
  );

  const status: 'routed' | 'needs_review' =
    overallConfidence >= REVIEW_THRESHOLD && classify.data.type !== 'unknown'
      ? 'routed'
      : 'needs_review';

  const [notice] = await db
    .insert(schema.notices)
    .values({
      caseId,
      source: 'pdf',
      type: classify.data.type,
      status,
      rawText: input.text,
      rawFileUrl: input.rawFileUrl,
      senderEmail: input.senderEmail ?? null,
      senderDomain: analysis.sender?.domain ?? null,
      confidence: overallConfidence,
      classificationReasoning: classify.data.reasoning,
    })
    .returning({ id: schema.notices.id });

  const hearingAt = parseIso(extract.data.hearingAt);
  const deadline = parseIso(extract.data.deadline);

  await db.insert(schema.extractedEvents).values({
    noticeId: notice.id,
    type: classify.data.type,
    hearingAt,
    courtroom: extract.data.courtroom,
    virtualUrl: extract.data.virtualUrl,
    trustee: extract.data.trustee,
    judge: extract.data.judge,
    deadline,
    docketSummary: extract.data.docketSummary,
    fieldConfidences: extract.data.fieldConfidences,
  });

  // Persist both LLM calls for audit / eval reproducibility.
  await db.insert(schema.parseRuns).values([
    {
      noticeId: notice.id,
      model: classify.model,
      stage: 'classify',
      prompt: classify.rawArgs,
      rawOutput: classify.data,
      durationMs: classify.durationMs,
      inputTokens: classify.usage.inputTokens,
      outputTokens: classify.usage.outputTokens,
    },
    {
      noticeId: notice.id,
      model: extract.model,
      stage: 'extract',
      prompt: extract.rawArgs,
      rawOutput: extract.data,
      durationMs: extract.durationMs,
      inputTokens: extract.usage.inputTokens,
      outputTokens: extract.usage.outputTokens,
    },
  ]);

  await writeAudit(notice.id, 'ingested', {
    verdict: 'continue',
    caseNumber: analysis.caseNumber?.caseNumber ?? null,
    type: classify.data.type,
    classifyConfidence: classify.data.confidence,
    overallConfidence,
    status,
    reasons: analysis.reasons,
  });

  return {
    noticeId: notice.id,
    status,
    caseNumber: analysis.caseNumber?.caseNumber ?? null,
    type: classify.data.type,
    confidence: overallConfidence,
    hearingAt,
    deterministicReasons: analysis.reasons,
  };
}

async function writeAudit(noticeId: string, action: string, after: Record<string, unknown>) {
  await db.insert(schema.auditEvents).values({
    entity: 'notice',
    entityId: noticeId,
    actor: 'system',
    action,
    after,
  });
}
