/**
 * Calendar export for a single case.
 *
 * Returns an RFC 5545 ICS file with one event per hearing, deadline, and
 * open task. Paralegals subscribe to this URL in Outlook / Google Calendar
 * and the case stays current as new notices land.
 */
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { buildIcs, type IcsEvent } from '@/lib/ics';

export const runtime = 'nodejs';

const TYPE_LABEL: Record<string, string> = {
  meeting_341: '341 Meeting',
  deficiency: 'Deficiency',
  motion_to_dismiss: 'Motion to Dismiss',
  discharge: 'Discharge',
  relief_from_stay: 'Relief from Stay',
  claim_deadline: 'Claim Deadline',
  unknown: 'Notice',
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ caseNumber: string }> },
) {
  const { caseNumber } = await ctx.params;

  const [theCase] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.caseNumber, caseNumber))
    .limit(1);

  if (!theCase) {
    return new NextResponse('Case not found', { status: 404 });
  }

  const notices = await db
    .select({
      id: schema.notices.id,
      type: schema.notices.type,
      hearingAt: schema.extractedEvents.hearingAt,
      deadline: schema.extractedEvents.deadline,
      courtroom: schema.extractedEvents.courtroom,
      virtualUrl: schema.extractedEvents.virtualUrl,
      trustee: schema.extractedEvents.trustee,
      judge: schema.extractedEvents.judge,
      docketSummary: schema.extractedEvents.docketSummary,
    })
    .from(schema.notices)
    .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
    .where(eq(schema.notices.caseId, theCase.id));

  const tasks = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.caseId, theCase.id));

  const events: IcsEvent[] = [];

  for (const n of notices) {
    const label = TYPE_LABEL[n.type ?? 'unknown'] ?? 'Notice';

    if (n.hearingAt) {
      const descParts = [n.docketSummary, n.trustee ? `Trustee: ${n.trustee}` : null, n.judge ? `Judge: ${n.judge}` : null]
        .filter(Boolean)
        .join('\n');
      events.push({
        uid: `${n.id}-hearing@court-notice-gateway`,
        summary: `${label} — ${theCase.caseNumber}`,
        description: descParts || undefined,
        location: n.courtroom ?? (n.virtualUrl ? 'Virtual' : undefined),
        url: n.virtualUrl ?? undefined,
        startUtc: new Date(n.hearingAt),
        endUtc: new Date(new Date(n.hearingAt).getTime() + 60 * 60 * 1000),
      });
    }

    if (n.deadline) {
      events.push({
        uid: `${n.id}-deadline@court-notice-gateway`,
        summary: `Deadline: ${label} — ${theCase.caseNumber}`,
        description: n.docketSummary ?? undefined,
        date: new Date(n.deadline),
      });
    }
  }

  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'cancelled') continue;
    if (!t.dueAt) continue;
    events.push({
      uid: `${t.id}-task@court-notice-gateway`,
      summary: `Task: ${t.title}`,
      description: t.description ?? undefined,
      date: new Date(t.dueAt),
    });
  }

  const ics = buildIcs({
    calendarName: `Case ${theCase.caseNumber}${theCase.debtorName ? ` — ${theCase.debtorName}` : ''}`,
    events,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="case-${caseNumber}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
