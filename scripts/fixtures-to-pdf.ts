/**
 * Convert every text fixture in fixtures/notices/*.txt to a PDF in fixtures/notices/.
 *
 * Generated PDFs are useful for the end-to-end upload test and the demo.
 * They are NOT checked into git (the .txt sources are the source of truth).
 *
 * Run: `pnpm tsx scripts/fixtures-to-pdf.ts`
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'notices');

function textToPdf(text: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => {
      writeFileSync(outPath, Buffer.concat(chunks));
      resolve();
    });
    doc.on('error', reject);
    doc.font('Courier').fontSize(10).text(text, { lineGap: 2 });
    doc.end();
  });
}

async function main() {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.txt'));
  for (const file of files) {
    const text = readFileSync(join(FIXTURES_DIR, file), 'utf8');
    const out = join(FIXTURES_DIR, file.replace(/\.txt$/, '.pdf'));
    await textToPdf(text, out);
    console.log(`✓ ${file} → ${out.split('/').slice(-2).join('/')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
