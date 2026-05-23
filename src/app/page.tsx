import Link from "next/link";
import { desc, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/db";

type StatusKey = "received" | "parsing" | "needs_review" | "routed" | "suspicious" | "failed";

const STATUS_LABEL: Record<StatusKey, string> = {
  received: "Received",
  parsing: "Parsing",
  needs_review: "Needs review",
  routed: "Routed",
  suspicious: "Suspicious",
  failed: "Failed",
};

const STATUS_VARIANT: Record<StatusKey, "default" | "secondary" | "destructive" | "outline"> = {
  received: "secondary",
  parsing: "secondary",
  needs_review: "default",
  routed: "outline",
  suspicious: "destructive",
  failed: "destructive",
};

const TYPE_LABEL: Record<string, string> = {
  meeting_341: "341 Meeting",
  deficiency: "Deficiency",
  motion_to_dismiss: "Motion to Dismiss",
  discharge: "Discharge",
  relief_from_stay: "Relief from Stay",
  claim_deadline: "Claim Deadline",
  unknown: "Unknown",
};

function fmtTimestamp(ts: Date | string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtHearing(ts: Date | string | null): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function getNotices() {
  return db
    .select({
      id: schema.notices.id,
      type: schema.notices.type,
      status: schema.notices.status,
      confidence: schema.notices.confidence,
      receivedAt: schema.notices.receivedAt,
      caseNumber: schema.cases.caseNumber,
      hearingAt: schema.extractedEvents.hearingAt,
    })
    .from(schema.notices)
    .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
    .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
    .orderBy(desc(schema.notices.receivedAt))
    .limit(100);
}

export default async function InboxPage() {
  const notices = await getNotices();

  return (
    <div className="flex-1 px-8 py-8 max-w-7xl">
      <header className="flex items-center justify-between pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notice Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Forwarded PACER / CM-ECF notices, classified and routed.
          </p>
        </div>
        <Link href="/upload" className={buttonVariants()}>
          Upload notice
        </Link>
      </header>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="text-base font-medium">No notices yet</div>
            <div className="text-sm text-muted-foreground max-w-md">
              Upload a forwarded court notice PDF to see it ingested, validated,
              classified, and routed to a case.
            </div>
            <Link href="/upload" className={`${buttonVariants()} mt-2`}>
              Upload your first notice
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Case</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[110px]">Conf.</TableHead>
                <TableHead>Hearing</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs">
                    {n.caseNumber ? (
                      <Link href={`/cases/${n.caseNumber}`} className="hover:underline">
                        {n.caseNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {n.type ? TYPE_LABEL[n.type] ?? n.type : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[n.status as StatusKey]}>
                      {STATUS_LABEL[n.status as StatusKey]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {n.confidence != null ? `${Math.round(n.confidence * 100)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtHearing(n.hearingAt)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="flex flex-col items-end gap-1">
                      <Link href={`/notices/${n.id}`} className="font-medium hover:underline">
                        Open →
                      </Link>
                      <span className="text-muted-foreground">{fmtTimestamp(n.receivedAt)}</span>
                    </div>
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
