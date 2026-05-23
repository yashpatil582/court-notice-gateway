/**
 * Full notice ingest pipeline.
 *
 * Stages, in order:
 *   1. Deterministic — case-number regex, sender allowlist, link host validation
 *   2. LLM analyse — single combined classify + extract tool call
 *   3. Routing — aggregate confidence, decide between routed | needs_review
 *
 * The deterministic stage can short-circuit with `suspicious` and skip LLM
 * work entirely (saves Groq tokens and tightens the trust boundary).
 *
 * Every LLM call is persisted as a ParseRun row so we can audit cost, latency,
 * raw output, and which prompt produced which result.
 */

import { db, schema } from '@/db';
import { analyseNotice } from '../parsing';
import { findOrCreateCase } from '../case-lookup';
import { analyseNoticeLlm, aggregateConfidence } from './analyse';

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

  const llm = await analyseNoticeLlm(input.text);

  const overallConfidence = aggregateConfidence(llm.data, Boolean(caseId));

  const status: 'routed' | 'needs_review' =
    overallConfidence >= REVIEW_THRESHOLD && llm.data.type !== 'unknown'
      ? 'routed'
      : 'needs_review';

  const [notice] = await db
    .insert(schema.notices)
    .values({
      caseId,
      source: 'pdf',
      type: llm.data.type,
      status,
      rawText: input.text,
      rawFileUrl: input.rawFileUrl,
      senderEmail: input.senderEmail ?? null,
      senderDomain: analysis.sender?.domain ?? null,
      confidence: overallConfidence,
      classificationReasoning: llm.data.classifyReasoning,
    })
    .returning({ id: schema.notices.id });

  const hearingAt = parseIso(llm.data.hearingAt);
  const deadline = parseIso(llm.data.deadline);

  await db.insert(schema.extractedEvents).values({
    noticeId: notice.id,
    type: llm.data.type,
    hearingAt,
    courtroom: llm.data.courtroom,
    virtualUrl: llm.data.virtualUrl,
    trustee: llm.data.trustee,
    judge: llm.data.judge,
    deadline,
    docketSummary: llm.data.docketSummary,
    fieldConfidences: llm.data.fieldConfidences,
  });

  await db.insert(schema.parseRuns).values({
    noticeId: notice.id,
    model: llm.model,
    stage: 'analyse',
    prompt: llm.rawArgs,
    rawOutput: llm.data,
    durationMs: llm.durationMs,
    inputTokens: llm.usage.inputTokens,
    outputTokens: llm.usage.outputTokens,
  });

  await writeAudit(notice.id, 'ingested', {
    verdict: 'continue',
    caseNumber: analysis.caseNumber?.caseNumber ?? null,
    type: llm.data.type,
    classifyConfidence: llm.data.classifyConfidence,
    overallConfidence,
    status,
    reasons: analysis.reasons,
  });

  return {
    noticeId: notice.id,
    status,
    caseNumber: analysis.caseNumber?.caseNumber ?? null,
    type: llm.data.type,
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
