import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { buttonVariants } from '@/components/ui/button';
import { db, schema } from '@/db';
import { ReviewForm } from './review-form';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  meeting_341: '341 Meeting',
  deficiency: 'Deficiency',
  motion_to_dismiss: 'Motion to Dismiss',
  discharge: 'Discharge',
  relief_from_stay: 'Relief from Stay',
  claim_deadline: 'Claim Deadline',
  unknown: 'Unknown',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  received: 'secondary',
  parsing: 'secondary',
  needs_review: 'default',
  routed: 'outline',
  suspicious: 'destructive',
  failed: 'destructive',
};

const DEFAULT_CONF = { hearingAt: 0, courtroom: 0, virtualUrl: 0, trustee: 0, judge: 0, deadline: 0 };

export default async function NoticeReviewPage(props: PageProps<'/notices/[id]'>) {
  const { id } = await props.params;

  const [notice] = await db
    .select({
      id: schema.notices.id,
      status: schema.notices.status,
      type: schema.notices.type,
      confidence: schema.notices.confidence,
      classificationReasoning: schema.notices.classificationReasoning,
      receivedAt: schema.notices.receivedAt,
      senderDomain: schema.notices.senderDomain,
      caseNumber: schema.cases.caseNumber,
      caseDistrict: schema.cases.district,
    })
    .from(schema.notices)
    .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
    .where(eq(schema.notices.id, id))
    .limit(1);

  if (!notice) notFound();

  const [event] = await db
    .select()
    .from(schema.extractedEvents)
    .where(eq(schema.extractedEvents.noticeId, id))
    .limit(1);

  const auditTrail = await db
    .select()
    .from(schema.auditEvents)
    .where(eq(schema.auditEvents.entityId, id))
    .orderBy(desc(schema.auditEvents.at))
    .limit(20);

  const confidences = (event?.fieldConfidences as typeof DEFAULT_CONF | null) ?? DEFAULT_CONF;
  const initial = {
    hearingAt: event?.hearingAt ? new Date(event.hearingAt).toISOString() : null,
    courtroom: event?.courtroom ?? null,
    virtualUrl: event?.virtualUrl ?? null,
    trustee: event?.trustee ?? null,
    judge: event?.judge ?? null,
    deadline: event?.deadline ? new Date(event.deadline).toISOString() : null,
    docketSummary: event?.docketSummary ?? '',
  };

  return (
    <div className="flex-1 px-8 py-6 max-w-[1500px]">
      <header className="pb-4 flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:underline w-fit"
          >
            ← Back to inbox
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {notice.caseNumber ? (
                <Link
                  href={`/cases/${notice.caseNumber}`}
                  className="font-mono hover:underline"
                >
                  {notice.caseNumber}
                </Link>
              ) : (
                'Unmatched notice'
              )}
            </h1>
            <Badge variant={STATUS_VARIANT[notice.status]}>{notice.status.replace('_', ' ')}</Badge>
            {notice.type ? <Badge variant="outline">{TYPE_LABEL[notice.type] ?? notice.type}</Badge> : null}
          </div>
          <div className="text-xs text-muted-foreground flex gap-3">
            <span>
              Sender:{' '}
              <span className="font-mono">{notice.senderDomain ?? 'unknown'}</span>
            </span>
            {notice.confidence != null && (
              <span>
                Overall confidence:{' '}
                <span className="font-mono">{Math.round(notice.confidence * 100)}%</span>
              </span>
            )}
            <span>Received {new Date(notice.receivedAt).toLocaleString()}</span>
          </div>
        </div>
      </header>

      {notice.status === 'suspicious' ? (
        <Card className="mb-4">
          <CardContent className="py-4 text-sm">
            <span className="font-medium text-destructive">Quarantined.</span>{' '}
            This notice was flagged by deterministic checks and the LLM stage
            was skipped. Open the source PDF below to inspect; reject to keep it
            out of the case timeline.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-0 h-[820px]">
            <iframe
              src={`/api/notices/${notice.id}/pdf`}
              className="w-full h-full rounded-lg"
              title="Notice PDF"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-6 px-6">
            {notice.classificationReasoning ? (
              <div className="mb-4 text-xs text-muted-foreground italic border-l-2 pl-3">
                {notice.classificationReasoning}
              </div>
            ) : null}

            {event ? (
              <ReviewForm
                noticeId={notice.id}
                initial={initial}
                confidences={confidences}
                approveDisabled={notice.status === 'suspicious'}
              />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No extracted fields. The LLM stage was skipped — this is either a
                suspicious quarantine or an unfinished ingest.
              </div>
            )}

            <Separator className="my-6" />

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                AUDIT TRAIL
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                {auditTrail.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground w-32 shrink-0">
                      {new Date(ev.at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-mono shrink-0 w-20">{ev.action}</span>
                    <span className="text-muted-foreground">by {ev.actor}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Link href="/" className={`${buttonVariants({ variant: 'outline' })}`}>
          Back to inbox
        </Link>
      </div>
    </div>
  );
}
