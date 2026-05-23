'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';

export type ActionResult = { ok: true } | { ok: false; error: string };

type FieldChanges = {
  hearingAt: string | null;
  courtroom: string | null;
  virtualUrl: string | null;
  trustee: string | null;
  judge: string | null;
  deadline: string | null;
  docketSummary: string;
};

function parseIso(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readFields(formData: FormData): FieldChanges {
  const get = (k: string): string | null => {
    const v = formData.get(k);
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  };
  return {
    hearingAt: get('hearingAt'),
    courtroom: get('courtroom'),
    virtualUrl: get('virtualUrl'),
    trustee: get('trustee'),
    judge: get('judge'),
    deadline: get('deadline'),
    docketSummary: get('docketSummary') ?? '',
  };
}

async function loadEvent(noticeId: string) {
  const [ev] = await db
    .select()
    .from(schema.extractedEvents)
    .where(eq(schema.extractedEvents.noticeId, noticeId))
    .limit(1);
  return ev ?? null;
}

async function diffEvent(noticeId: string, next: FieldChanges) {
  const before = await loadEvent(noticeId);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  if (!before) return { changes, before: null };

  const beforeIso = (d: Date | null) => (d ? d.toISOString() : null);
  const compare: Record<string, [unknown, unknown]> = {
    hearingAt: [beforeIso(before.hearingAt), next.hearingAt],
    courtroom: [before.courtroom, next.courtroom],
    virtualUrl: [before.virtualUrl, next.virtualUrl],
    trustee: [before.trustee, next.trustee],
    judge: [before.judge, next.judge],
    deadline: [beforeIso(before.deadline), next.deadline],
    docketSummary: [before.docketSummary, next.docketSummary],
  };
  for (const [k, [a, b]] of Object.entries(compare)) {
    if (a !== b) changes[k] = { before: a, after: b };
  }
  return { changes, before };
}

export async function saveNoticeEdits(
  noticeId: string,
  reviewer: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const next = readFields(formData);
    const { changes } = await diffEvent(noticeId, next);

    await db
      .update(schema.extractedEvents)
      .set({
        hearingAt: parseIso(next.hearingAt),
        courtroom: next.courtroom,
        virtualUrl: next.virtualUrl,
        trustee: next.trustee,
        judge: next.judge,
        deadline: parseIso(next.deadline),
        docketSummary: next.docketSummary,
      })
      .where(eq(schema.extractedEvents.noticeId, noticeId));

    if (Object.keys(changes).length > 0) {
      await db.insert(schema.reviewDecisions).values({
        noticeId,
        reviewerEmail: reviewer,
        fieldChanges: changes,
        notes: null,
      });

      await db.insert(schema.auditEvents).values({
        entity: 'notice',
        entityId: noticeId,
        actor: reviewer,
        action: 'edited',
        before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.before])),
        after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.after])),
      });
    }

    revalidatePath('/');
    revalidatePath(`/notices/${noticeId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'save failed' };
  }
}

export async function approveNotice(noticeId: string, reviewer: string): Promise<ActionResult> {
  try {
    const [notice] = await db
      .select({
        caseId: schema.notices.caseId,
        type: schema.notices.type,
        status: schema.notices.status,
      })
      .from(schema.notices)
      .where(eq(schema.notices.id, noticeId))
      .limit(1);

    if (!notice) return { ok: false, error: 'Notice not found' };
    if (notice.status === 'suspicious') return { ok: false, error: 'Suspicious notices cannot be approved' };

    await db
      .update(schema.notices)
      .set({ status: 'routed' })
      .where(eq(schema.notices.id, noticeId));

    // Generate follow-up Task from extracted event
    const event = await loadEvent(noticeId);
    if (event && notice.caseId) {
      const taskTitle = buildTaskTitle(notice.type, event);
      const dueAt = event.deadline ?? event.hearingAt ?? null;
      await db.insert(schema.tasks).values({
        caseId: notice.caseId,
        noticeId,
        title: taskTitle,
        description: event.docketSummary,
        dueAt,
        assignee: reviewer,
        status: 'open',
      });
    }

    await db.insert(schema.auditEvents).values({
      entity: 'notice',
      entityId: noticeId,
      actor: reviewer,
      action: 'approved',
      after: { status: 'routed' },
    });

    revalidatePath('/');
    revalidatePath('/review');
    revalidatePath(`/notices/${noticeId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'approve failed' };
  }
}

export async function rejectNotice(
  noticeId: string,
  reviewer: string,
  reason: string,
): Promise<ActionResult> {
  try {
    await db
      .update(schema.notices)
      .set({ status: 'suspicious' })
      .where(eq(schema.notices.id, noticeId));

    await db.insert(schema.reviewDecisions).values({
      noticeId,
      reviewerEmail: reviewer,
      fieldChanges: {},
      notes: reason,
    });

    await db.insert(schema.auditEvents).values({
      entity: 'notice',
      entityId: noticeId,
      actor: reviewer,
      action: 'rejected',
      after: { status: 'suspicious', reason },
    });

    revalidatePath('/');
    revalidatePath('/review');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'reject failed' };
  }
}

function buildTaskTitle(
  type: string | null,
  event: { hearingAt: Date | null; deadline: Date | null; trustee: string | null },
): string {
  switch (type) {
    case 'meeting_341':
      return `Prep for 341 meeting${event.hearingAt ? ` on ${event.hearingAt.toDateString()}` : ''}`;
    case 'deficiency':
      return `Cure deficiency${event.deadline ? ` by ${event.deadline.toDateString()}` : ''}`;
    case 'motion_to_dismiss':
      return `Respond to motion to dismiss${event.hearingAt ? ` (hearing ${event.hearingAt.toDateString()})` : ''}`;
    case 'discharge':
      return `File discharge order to case file`;
    case 'relief_from_stay':
      return `Review relief from stay motion${event.hearingAt ? ` (hearing ${event.hearingAt.toDateString()})` : ''}`;
    case 'claim_deadline':
      return `Claim bar date${event.deadline ? ` on ${event.deadline.toDateString()}` : ''}`;
    default:
      return 'Review notice and file in case';
  }
}

export async function redirectToInbox() {
  redirect('/');
}
