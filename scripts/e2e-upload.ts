/**
 * End-to-end ingest test (no HTTP) — exercises the same path the server
 * action takes: read PDF → upload to Vercel Blob → extract text → deterministic
 * analysis → insert Notice + AuditEvent rows.
 *
 * Iterates every fixture PDF and verifies the resulting Notice row has the
 * expected status. Logs the verdict + reasons.
 *
 * Run: `pnpm tsx --env-file=.env.local scripts/e2e-upload.ts`
 */
import { openAsBlob } from 'node:fs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { db, schema } from '../src/db';
import { analyseNotice, extractPdfText } from '../src/lib/parsing';
import { findOrCreateCase } from '../src/lib/case-lookup';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'notices');

async function ingest(filename: string, fullPath: string) {
  const fileBlob = await openAsBlob(fullPath, { type: 'application/pdf' });
  const blob = await put(`notices/test-${Date.now()}-${filename}`, fileBlob, {
    access: 'private',
    addRandomSuffix: true,
  });

  const buffer = readFileSync(fullPath);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const { text, pageCount } = await extractPdfText(bytes);
  const analysis = analyseNotice({ text, senderEmail: null });
  const caseId = analysis.caseNumber ? await findOrCreateCase(analysis.caseNumber) : null;

  const [notice] = await db
    .insert(schema.notices)
    .values({
      caseId,
      source: 'pdf',
      status: analysis.verdict === 'suspicious' ? 'suspicious' : 'received',
      rawText: text,
      rawFileUrl: blob.url,
    })
    .returning({ id: schema.notices.id, status: schema.notices.status });

  await db.insert(schema.auditEvents).values({
    entity: 'notice',
    entityId: notice.id,
    actor: 'system',
    action: 'ingested',
    after: {
      verdict: analysis.verdict,
      caseNumber: analysis.caseNumber?.caseNumber ?? null,
      pageCount,
      reasons: analysis.reasons,
    },
  });

  return { notice, analysis, pageCount, blob };
}

async function main() {
  const pdfs = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.pdf'));

  let pass = 0;
  let fail = 0;
  for (const file of pdfs) {
    const expectSuspicious = file.startsWith('phishing-');
    try {
      const { notice, analysis, pageCount } = await ingest(file, join(FIXTURES_DIR, file));
      const ok = expectSuspicious ? notice.status === 'suspicious' : notice.status === 'received';
      const marker = ok ? '✓' : '✗';
      console.log(
        `${marker} ${file} status=${notice.status} case=${analysis.caseNumber?.caseNumber ?? '-'} pages=${pageCount}`,
      );
      if (analysis.reasons.length) console.log(`    reasons: ${analysis.reasons.join('; ')}`);
      ok ? pass++ : fail++;
    } catch (err) {
      console.error(`✗ ${file}: ${err instanceof Error ? err.message : err}`);
      fail++;
    }
  }
  console.log(`\n${pass}/${pass + fail} fixtures ingested with expected status`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
