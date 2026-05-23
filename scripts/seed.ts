/**
 * Seed default SenderPolicy rules.
 *
 * Idempotent — safe to run multiple times. Conflicts on (domain) are ignored.
 *
 * Note: the deterministic parser currently uses a hard-coded allowlist /
 * blocklist in src/lib/parsing/sender.ts. This seed exists for the planned
 * DB-driven policy lookup (so a firm admin can edit the list via the UI
 * without a deploy). Until that lands, the rows here are reference data.
 *
 * Run: `pnpm db:seed`
 */
import './_loadenv';
import { db, schema } from '../src/db';
import { sql } from 'drizzle-orm';

const ALLOW = [
  { domain: 'uscourts.gov', notes: 'U.S. Courts CM-ECF system (all districts)' },
  { domain: 'pacer.gov', notes: 'PACER public access' },
  { domain: 'bnc-mail.com', notes: 'Bankruptcy Noticing Center' },
  { domain: 'noticingcenter.com', notes: 'Bankruptcy Noticing Center' },
  { domain: 'zoomgov.com', notes: 'FedRAMP Zoom for Government — virtual hearings' },
];

const BLOCK = [
  { domain: 'uscourts.com', notes: 'phishing: uscourts on non-gov TLD' },
  { domain: 'uscourts.net', notes: 'phishing: uscourts on non-gov TLD' },
  { domain: 'uscoorts.gov', notes: 'phishing: look-alike of uscourts.gov' },
];

async function main() {
  let upserted = 0;
  for (const row of ALLOW) {
    await db
      .insert(schema.senderPolicies)
      .values({ domain: row.domain, trustLevel: 'allow', notes: row.notes })
      .onConflictDoNothing();
    upserted++;
  }
  for (const row of BLOCK) {
    await db
      .insert(schema.senderPolicies)
      .values({ domain: row.domain, trustLevel: 'block', notes: row.notes })
      .onConflictDoNothing();
    upserted++;
  }

  const [{ count }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from sender_policies`,
  );
  console.log(`seeded ${upserted} sender policy rules; total in DB: ${count}`);
  console.log(
    'note: the parser currently uses the hard-coded lists in src/lib/parsing/sender.ts;\n' +
      '      DB-driven lookup is a planned follow-up (see DESIGN.md).',
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
