/**
 * Court Notice Gateway — MCP server.
 *
 * Exposes a small read-only surface so an MCP-aware AI client (Claude Desktop,
 * ChatGPT, etc.) can query the same notice/case/task state that the inbox UI
 * shows. This is intentionally narrow: no writes, no PII dump — just the
 * queries a paralegal or attorney actually asks out loud.
 *
 * Transport: stdio. Launched as a subprocess by the MCP client (see README
 * for the claude_desktop_config.json snippet).
 *
 * Run locally: `pnpm mcp`
 */

import '../scripts/_loadenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { and, asc, desc, eq, gt, isNotNull, lt, sql } from 'drizzle-orm';
import { db, schema } from '../src/db';

const server = new McpServer({
  name: 'court-notice-gateway',
  version: '0.1.0',
});

function jsonContent(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

server.tool(
  'list_upcoming_hearings',
  'List bankruptcy hearings (341 meetings, motion hearings, etc.) scheduled within the next N days, with case number, debtor, and trustee/judge if known.',
  {
    withinDays: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(14)
      .describe('How many days ahead to look. Defaults to 14.'),
  },
  async ({ withinDays }) => {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        caseNumber: schema.cases.caseNumber,
        debtorName: schema.cases.debtorName,
        type: schema.notices.type,
        status: schema.notices.status,
        hearingAt: schema.extractedEvents.hearingAt,
        courtroom: schema.extractedEvents.courtroom,
        virtualUrl: schema.extractedEvents.virtualUrl,
        trustee: schema.extractedEvents.trustee,
        judge: schema.extractedEvents.judge,
        docketSummary: schema.extractedEvents.docketSummary,
      })
      .from(schema.extractedEvents)
      .leftJoin(schema.notices, eq(schema.extractedEvents.noticeId, schema.notices.id))
      .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
      .where(
        and(
          isNotNull(schema.extractedEvents.hearingAt),
          gt(schema.extractedEvents.hearingAt, now),
          lt(schema.extractedEvents.hearingAt, horizon),
        ),
      )
      .orderBy(asc(schema.extractedEvents.hearingAt))
      .limit(50);

    return jsonContent({
      windowDays: withinDays,
      count: rows.length,
      hearings: rows,
    });
  },
);

server.tool(
  'get_case_notice_timeline',
  'Fetch every notice, hearing, and follow-up task on a single bankruptcy case in chronological order.',
  {
    caseNumber: z
      .string()
      .min(4)
      .describe('Canonical short-form case number, e.g. "25-12345". Year-sequence with hyphen.'),
  },
  async ({ caseNumber }) => {
    const [theCase] = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.caseNumber, caseNumber))
      .limit(1);

    if (!theCase) {
      return jsonContent({ caseNumber, found: false });
    }

    const notices = await db
      .select({
        id: schema.notices.id,
        type: schema.notices.type,
        status: schema.notices.status,
        confidence: schema.notices.confidence,
        receivedAt: schema.notices.receivedAt,
        senderDomain: schema.notices.senderDomain,
        hearingAt: schema.extractedEvents.hearingAt,
        deadline: schema.extractedEvents.deadline,
        courtroom: schema.extractedEvents.courtroom,
        trustee: schema.extractedEvents.trustee,
        judge: schema.extractedEvents.judge,
        docketSummary: schema.extractedEvents.docketSummary,
      })
      .from(schema.notices)
      .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
      .where(eq(schema.notices.caseId, theCase.id))
      .orderBy(desc(schema.notices.receivedAt));

    const tasks = await db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        status: schema.tasks.status,
        dueAt: schema.tasks.dueAt,
        assignee: schema.tasks.assignee,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.caseId, theCase.id))
      .orderBy(asc(schema.tasks.dueAt));

    return jsonContent({
      case: {
        caseNumber: theCase.caseNumber,
        debtorName: theCase.debtorName,
        district: theCase.district,
        chapter: theCase.chapter,
      },
      noticesCount: notices.length,
      tasksCount: tasks.length,
      notices,
      tasks,
    });
  },
);

server.tool(
  'find_unreviewed_notices',
  'List notices currently sitting in the Review Queue (needs_review status), oldest first. Use this to ask "what is the paralegal team still on the hook for?"',
  {
    olderThanHours: z
      .number()
      .min(0)
      .default(0)
      .describe('Only include notices older than this many hours. Defaults to 0 (all).'),
  },
  async ({ olderThanHours }) => {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: schema.notices.id,
        caseNumber: schema.cases.caseNumber,
        type: schema.notices.type,
        confidence: schema.notices.confidence,
        receivedAt: schema.notices.receivedAt,
        docketSummary: schema.extractedEvents.docketSummary,
      })
      .from(schema.notices)
      .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
      .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
      .where(
        and(
          eq(schema.notices.status, 'needs_review'),
          lt(schema.notices.receivedAt, cutoff),
        ),
      )
      .orderBy(asc(schema.notices.receivedAt))
      .limit(50);

    return jsonContent({
      olderThanHours,
      count: rows.length,
      notices: rows,
    });
  },
);

server.tool(
  'summarise_recent_discharge_orders',
  'List discharge orders entered in the period since the given date. Useful for "which clients got their discharge this week?"',
  {
    sinceDate: z
      .string()
      .describe('ISO-8601 date or datetime. Discharge orders received after this point are returned. e.g. "2026-05-01" for "this month".')
      .default(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  },
  async ({ sinceDate }) => {
    const since = new Date(sinceDate);
    if (Number.isNaN(since.getTime())) {
      return jsonContent({ error: 'invalid sinceDate; expected ISO-8601' });
    }

    const rows = await db
      .select({
        caseNumber: schema.cases.caseNumber,
        debtorName: schema.cases.debtorName,
        chapter: schema.cases.chapter,
        judge: schema.extractedEvents.judge,
        receivedAt: schema.notices.receivedAt,
        docketSummary: schema.extractedEvents.docketSummary,
      })
      .from(schema.notices)
      .leftJoin(schema.cases, eq(schema.notices.caseId, schema.cases.id))
      .leftJoin(schema.extractedEvents, eq(schema.extractedEvents.noticeId, schema.notices.id))
      .where(
        and(
          eq(schema.notices.type, 'discharge'),
          eq(schema.notices.status, 'routed'),
          gt(schema.notices.receivedAt, since),
        ),
      )
      .orderBy(desc(schema.notices.receivedAt));

    return jsonContent({
      sinceDate,
      count: rows.length,
      discharges: rows,
    });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The MCP server exits when the client closes stdio. No keep-alive loop.
}

main().catch((err) => {
  // Errors must go to stderr — stdout is reserved for JSON-RPC frames.
  console.error('[mcp] fatal:', err);
  process.exit(1);
});

// Silence unused-symbol warnings for imports kept for future schema use.
void sql;
