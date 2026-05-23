/**
 * Minimal parser for the eval-results.md report produced by `pnpm eval`.
 *
 * We deliberately don't depend on a markdown library — the report's structure
 * is stable and small, so a regex pass is enough and keeps the bundle lean.
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type HeadlineMetric = { label: string; result: string; target: string };
export type FieldMetric = {
  field: string;
  precision: string;
  recall: string;
  f1: string;
  tp: number;
  fp: number;
  fn: number;
};
export type FixtureRow = {
  fixture: string;
  caseCell: string;
  typeCell: string;
  statusCell: string;
  confidence: string;
  latencySec: string;
  errors: string;
};

export type EvalReport = {
  generatedAt: string;
  model: string;
  fixtureCount: number;
  legitCount: number;
  phishingCount: number;
  headline: HeadlineMetric[];
  fields: FieldMetric[];
  macroF1: string;
  fixtures: FixtureRow[];
  fileMtime: Date;
};

const REPORT_PATH = join(process.cwd(), 'eval-results.md');

function parseTableRows(md: string, header: string): string[][] {
  const idx = md.indexOf(header);
  if (idx === -1) return [];
  const tail = md.slice(idx + header.length);
  // Skip header + separator
  const lines = tail.split('\n').slice(2);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.startsWith('|')) break;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

export function loadEvalReport(): EvalReport | null {
  if (!existsSync(REPORT_PATH)) return null;
  const md = readFileSync(REPORT_PATH, 'utf8');
  const fileMtime = statSync(REPORT_PATH).mtime;

  const meta = md.match(/_Generated: (.+?)_\s+·\s+fixtures: \*\*(\d+)\*\* \(legit: (\d+), phishing: (\d+)\)\s+·\s+model: `(.+?)`/);
  const generatedAt = meta?.[1] ?? 'unknown';
  const fixtureCount = Number(meta?.[2] ?? 0);
  const legitCount = Number(meta?.[3] ?? 0);
  const phishingCount = Number(meta?.[4] ?? 0);
  const model = meta?.[5] ?? 'unknown';

  const headlineRows = parseTableRows(md, '| Metric | Result | Target |\n| --- | ---: | ---: |');
  const headline: HeadlineMetric[] = headlineRows.map((r) => ({
    label: r[0],
    result: r[1].replace(/\*\*/g, ''),
    target: r[2],
  }));

  const fieldRows = parseTableRows(
    md,
    '| Field | Precision | Recall | F1 | TP | FP | FN |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  );
  const fields: FieldMetric[] = fieldRows.map((r) => ({
    field: r[0],
    precision: r[1],
    recall: r[2],
    f1: r[3],
    tp: Number(r[4]),
    fp: Number(r[5]),
    fn: Number(r[6]),
  }));

  const macroMatch = md.match(/\*\*Macro-F1 across fields\*\*: ([\d.%]+)/);
  const macroF1 = macroMatch?.[1] ?? '—';

  const fixtureRows = parseTableRows(
    md,
    '| Fixture | Case | Type | Status | Conf. | Lat (s) | Errors |\n| --- | --- | --- | --- | ---: | ---: | --- |',
  );
  const fixtures: FixtureRow[] = fixtureRows.map((r) => ({
    fixture: r[0].replace(/`/g, ''),
    caseCell: r[1],
    typeCell: r[2],
    statusCell: r[3],
    confidence: r[4],
    latencySec: r[5],
    errors: r[6],
  }));

  return {
    generatedAt,
    model,
    fixtureCount,
    legitCount,
    phishingCount,
    headline,
    fields,
    macroF1,
    fixtures,
    fileMtime,
  };
}
