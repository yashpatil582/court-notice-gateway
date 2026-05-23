/**
 * Seed default SenderPolicy rules.
 *
 * Idempotent — safe to run multiple times. Conflicts on (domain) are ignored.
 *
 * Run: `pnpm db:seed`
 */
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
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
