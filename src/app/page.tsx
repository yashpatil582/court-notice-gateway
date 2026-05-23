import Link from "next/link";
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

type NoticeRow = {
  id: string;
  caseNumber: string | null;
  type: string | null;
  status: "received" | "parsing" | "needs_review" | "routed" | "suspicious" | "failed";
  receivedAt: string;
};

const STATUS_LABEL: Record<NoticeRow["status"], string> = {
  received: "Received",
  parsing: "Parsing",
  needs_review: "Needs review",
  routed: "Routed",
  suspicious: "Suspicious",
  failed: "Failed",
};

const STATUS_VARIANT: Record<NoticeRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  received: "secondary",
  parsing: "secondary",
  needs_review: "default",
  routed: "outline",
  suspicious: "destructive",
  failed: "destructive",
};

async function getNotices(): Promise<NoticeRow[]> {
  // Day 1: empty state. DB wiring lands in Day 2 once DATABASE_URL is set.
  return [];
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
                  <TableCell>{n.type ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[n.status]}>
                      {STATUS_LABEL[n.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {n.receivedAt}
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
