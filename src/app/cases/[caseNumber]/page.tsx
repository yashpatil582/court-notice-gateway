import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asc, desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { db, schema } from '@/db';

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

function fmt(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function CaseTimelinePage(props: PageProps<'/cases/[caseNumber]'>) {
  const { caseNumber } = await props.params;

  const [theCase] = await db
    .select()
    .from(schema.cases)
    .where(eq(schema.cases.caseNumber, caseNumber))
    .limit(1);

  if (!theCase) notFound();

  const notices = await db
    .select({
      id: schema.notices.id,
      type: schema.notices.type,
      status: schema.notices.status,
      receivedAt: schema.notices.receivedAt,
      hearingAt: schema.extractedEvents.hearingAt,
      deadline: schema.extractedEvents.deadline,
      docketSummary: schema.extractedEvents.docketSummary,
    })
    .from(schema.notices)
    .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
    .where(eq(schema.notices.caseId, theCase.id))
    .orderBy(desc(schema.notices.receivedAt));

  const tasks = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.caseId, theCase.id))
    .orderBy(asc(schema.tasks.dueAt));

  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');

  return (
    <div className="flex-1 px-8 py-8 max-w-5xl">
      <Link href="/" className="text-xs text-muted-foreground hover:underline">
        ← Back to inbox
      </Link>
      <header className="pb-6 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight font-mono">
          {theCase.caseNumber}
        </h1>
        <div className="text-sm text-muted-foreground mt-1">
          {theCase.debtorName ? `${theCase.debtorName} · ` : ''}
          {theCase.district ? `District ${theCase.district} · ` : ''}
          {theCase.chapter ? `Chapter ${theCase.chapter}` : ''}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        <section className="col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Notices &amp; events
          </h2>
          {notices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No notices on this case yet.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {notices.map((n) => (
                <Card key={n.id}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {n.type ? (
                          <Badge variant="outline">{TYPE_LABEL[n.type] ?? n.type}</Badge>
                        ) : null}
                        <Badge variant={STATUS_VARIANT[n.status]}>
                          {n.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <Link
                        href={`/notices/${n.id}`}
                        className="text-xs hover:underline"
                      >
                        Open notice →
                      </Link>
                    </div>
                    {n.docketSummary ? (
                      <p className="text-sm mt-2">{n.docketSummary}</p>
                    ) : null}
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 text-xs text-muted-foreground gap-2">
                      <div>
                        <div className="font-medium text-foreground">Received</div>
                        <div>{fmt(n.receivedAt)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">Hearing</div>
                        <div>{fmt(n.hearingAt)}</div>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">Deadline</div>
                        <div>{fmt(n.deadline)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Tasks ({openTasks.length} open)
          </h2>
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No tasks generated yet. Approving a notice creates one.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{t.title}</div>
                      <Badge
                        variant={
                          t.status === 'done'
                            ? 'outline'
                            : t.status === 'cancelled'
                              ? 'destructive'
                              : 'default'
                        }
                      >
                        {t.status}
                      </Badge>
                    </div>
                    {t.dueAt ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        Due {fmt(t.dueAt)}
                      </div>
                    ) : null}
                    {t.assignee ? (
                      <div className="text-xs text-muted-foreground">{t.assignee}</div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
