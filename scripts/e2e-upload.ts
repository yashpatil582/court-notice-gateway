/**
 * End-to-end ingest test (no HTTP) — exercises the same path the server
 * action takes: read PDF → upload to Vercel Blob → extract text → full
 * notice pipeline (deterministic + classification + extraction + DB writes).
 *
 * Run: `pnpm tsx --env-file=.env.local scripts/e2e-upload.ts`
 */
import './_loadenv';
import { openAsBlob, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { extractPdfText } from '../src/lib/parsing';
import { ingestNotice } from '../src/lib/notice-pipeline/run';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'notices');

type Expected = {
  status: 'received' | 'suspicious' | 'routed' | 'needs_review';
  type?: string;
};

const EXPECTATIONS: Record<string, Expected> = {
  '341-meeting-legit.pdf': { status: 'routed', type: 'meeting_341' },
  'deficiency-legit.pdf': { status: 'routed', type: 'deficiency' },
  'discharge-legit.pdf': { status: 'routed', type: 'discharge' },
  'phishing-fake-nef.pdf': { status: 'suspicious' },
  'phishing-uscoorts.pdf': { status: 'suspicious' },
};

function extractHeader(content: string, name: string): string | null {
  const re = new RegExp(`^${name}:\\s*(.+)$`, 'mi');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

async function ingest(filename: string, fullPath: string, senderEmail: string | null) {
  const fileBlob = await openAsBlob(fullPath, { type: 'application/pdf' });
  const blob = await put(`notices/test-${Date.now()}-${filename}`, fileBlob, {
    access: 'private',
    addRandomSuffix: true,
  });

  const buffer = readFileSync(fullPath);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const { text } = await extractPdfText(bytes);

  return ingestNotice({ text, rawFileUrl: blob.url, senderEmail });
}

async function main() {
  const pdfs = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.pdf')).sort();

  let pass = 0;
  let fail = 0;
  for (const file of pdfs) {
    const expected = EXPECTATIONS[file];
    const txtPath = join(FIXTURES_DIR, file.replace(/\.pdf$/, '.txt'));
    const senderEmail = (() => {
      try {
        return extractHeader(readFileSync(txtPath, 'utf8'), 'From');
      } catch {
        return null;
      }
    })();

    try {
      const result = await ingest(file, join(FIXTURES_DIR, file), senderEmail);
      const statusOk = result.status === expected.status;
      const typeOk = !expected.type || result.type === expected.type;
      const ok = statusOk && typeOk;

      const marker = ok ? '✓' : '✗';
      console.log(
        `${marker} ${file}  status=${result.status}  type=${result.type ?? '-'}  conf=${
          result.confidence?.toFixed(2) ?? '-'
        }  case=${result.caseNumber ?? '-'}  hearing=${result.hearingAt?.toISOString() ?? '-'}`,
      );
      if (!ok) {
        console.log(`    expected: status=${expected.status}${expected.type ? ` type=${expected.type}` : ''}`);
      }
      if (result.deterministicReasons.length) {
        console.log(`    reasons:  ${result.deterministicReasons.join('; ')}`);
      }
      ok ? pass++ : fail++;
    } catch (err) {
      console.error(`✗ ${file}: ${err instanceof Error ? err.message : err}`);
      fail++;
    }
  }
  console.log(`\n${pass}/${pass + fail} fixtures ingested with expected status + type`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
