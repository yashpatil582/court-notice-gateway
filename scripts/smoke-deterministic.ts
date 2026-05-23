/**
 * Smoke test: run the deterministic notice pipeline against every fixture
 * and pretty-print the results. Useful as a quick "does this still work"
 * check during Day 2-3 iteration, and as a demo prop.
 *
 * Run: `pnpm tsx scripts/smoke-deterministic.ts`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyseNotice } from '../src/lib/parsing';

const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'notices');

function extractHeader(content: string, name: string): string | null {
  const re = new RegExp(`^${name}:\\s*(.+)$`, 'mi');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.txt')).sort();

let pass = 0;
let fail = 0;

for (const file of files) {
  const content = readFileSync(join(FIXTURES_DIR, file), 'utf8');
  const sender = extractHeader(content, 'From');
  const result = analyseNotice({ text: content, senderEmail: sender });

  const expectedSuspicious = file.startsWith('phishing-');
  const actualSuspicious = result.verdict === 'suspicious';
  const ok = expectedSuspicious === actualSuspicious;
  if (ok) pass++;
  else fail++;

  console.log(`\n${ok ? '✓' : '✗'} ${file}`);
  console.log(`    case:    ${result.caseNumber?.caseNumber ?? '(none)'} (${result.caseNumber?.proceeding ?? '-'})`);
  console.log(`    sender:  ${result.sender?.domain ?? '(none)'} → ${result.sender?.trust ?? '-'}`);
  console.log(`    links:   ${result.links.links.length} link(s), overall=${result.links.overall}`);
  console.log(`    verdict: ${result.verdict}${result.reasons.length ? ` — ${result.reasons.join('; ')}` : ''}`);
}

console.log(`\n${pass}/${pass + fail} fixtures behave as expected`);
process.exit(fail === 0 ? 0 : 1);
