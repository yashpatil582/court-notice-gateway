/**
 * Find or create a Case row for an extracted case number.
 *
 * Day 2 behaviour: exact match on case_number only. Fuzzy debtor-name
 * matching lands later when we have an LLM in the loop.
 */
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { CaseNumberMatch } from './parsing/case-number';

export async function findOrCreateCase(match: CaseNumberMatch): Promise<string> {
  const existing = await db
    .select({ id: schema.cases.id })
    .from(schema.cases)
    .where(eq(schema.cases.caseNumber, match.caseNumber))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [row] = await db
    .insert(schema.cases)
    .values({
      caseNumber: match.caseNumber,
      district: match.district,
    })
    .returning({ id: schema.cases.id });
  return row.id;
}
