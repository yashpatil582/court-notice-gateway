/**
 * Wipe all notice-related rows (notices, cases, parse_runs, extracted_events,
 * tasks, review_decisions, audit_events). Keeps sender_policies so we don't
 * have to re-seed every time.
 *
 * Run: `pnpm db:reset`
 */
import './_loadenv';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';

async function main() {
  const tables = [
    'audit_events',
    'review_decisions',
    'tasks',
    'parse_runs',
    'extracted_events',
    'notices',
    'cases',
  ];

  for (const t of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${t}" CASCADE`));
    console.log(`  truncated ${t}`);
  }
  console.log('clean.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
