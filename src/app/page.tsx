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

async function getNotices() {
  return db
    .select({
      id: schema.notices.id,
      type: schema.notices.type,
      status: schema.notices.status,
      receivedAt: schema.notices.receivedAt,
      caseNumber: schema.cases.caseNumber,
    })
    .from(schema.notices)
    .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
    .orderBy(desc(schema.notices.receivedAt))
    .limit(100);
}

export default async function InboxPage() {
  const notices = await getNotices();

  return (
    <div className="flex-1 px-8 py-8 max-w-6xl">
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
                <TableHead className="w-[180px]">Case</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs">
                    {n.caseNumber ?? "—"}
                  </TableCell>
                  <TableCell>{n.type ? TYPE_LABEL[n.type] ?? n.type : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[n.status as StatusKey]}>
                      {STATUS_LABEL[n.status as StatusKey]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {fmtTimestamp(n.receivedAt)}
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
