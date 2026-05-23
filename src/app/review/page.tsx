import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

async function getReviewQueue() {
  return db
    .select({
      id: schema.notices.id,
      type: schema.notices.type,
      confidence: schema.notices.confidence,
      receivedAt: schema.notices.receivedAt,
      caseNumber: schema.cases.caseNumber,
      docketSummary: schema.extractedEvents.docketSummary,
    })
    .from(schema.notices)
    .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
    .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
    .where(eq(schema.notices.status, 'needs_review'))
    .orderBy(desc(schema.notices.receivedAt))
    .limit(100);
}

export default async function ReviewQueuePage() {
  const rows = await getReviewQueue();

  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notices with low extraction confidence that need a paralegal to review
          before they are routed to a case.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-2">
            <div className="text-base font-medium">Queue empty</div>
            <div className="text-sm text-muted-foreground max-w-md">
              Every recent notice either routed automatically or was quarantined as suspicious.
              Open any notice from the <Link href="/" className="underline">Inbox</Link> to
              review it manually.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Case</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
                <TableHead className="w-[80px]">Conf.</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="text-right w-[60px]"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.caseNumber ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    {r.type ? <Badge variant="outline">{TYPE_LABEL[r.type] ?? r.type}</Badge> : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {r.docketSummary ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/notices/${r.id}`} className="text-sm font-medium hover:underline">
                      Review →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
