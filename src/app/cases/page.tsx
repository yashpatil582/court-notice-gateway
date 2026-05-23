import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
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

async function getCases() {
  return db
    .select({
      caseNumber: schema.cases.caseNumber,
      debtorName: schema.cases.debtorName,
      district: schema.cases.district,
      noticeCount: sql<number>`count(${schema.notices.id})::int`.as('notice_count'),
      lastNoticeAt: sql<Date | null>`max(${schema.notices.receivedAt})`.as('last_notice_at'),
    })
    .from(schema.cases)
    .leftJoin(schema.notices, eq(schema.notices.caseId, schema.cases.id))
    .groupBy(schema.cases.id)
    .orderBy(desc(sql`max(${schema.notices.receivedAt})`))
    .limit(100);
}

export default async function CasesIndexPage() {
  const cases = await getCases();

  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
      <header className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every case the gateway has seen, ordered by most-recent notice.
        </p>
      </header>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No cases yet. Upload a notice to create one.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Case</TableHead>
                <TableHead>Debtor</TableHead>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Notices</TableHead>
                <TableHead className="text-right">Last notice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.caseNumber}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/cases/${c.caseNumber}`} className="hover:underline">
                      {c.caseNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.debtorName ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.district ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{c.noticeCount}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {c.lastNoticeAt
                      ? new Date(c.lastNoticeAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
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
