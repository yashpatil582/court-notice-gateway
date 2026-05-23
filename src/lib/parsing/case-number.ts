/**
 * Bankruptcy case number extraction.
 *
 * PACER / CM-ECF case numbers appear in these common shapes:
 *
 *   25-12345              short form, no district prefix
 *   25-12345-ABC          short form with judge initials
 *   1:25-bk-12345         full form: district:year-bk-sequence
 *   1:25-bk-12345-ABC     full form with judge initials
 *   1:25-ap-12345         adversary proceeding
 *
 * District prefix is 1-2 digits then a colon. Judge initials are 2-3 capital
 * letters. The canonical form for downstream matching is `YY-NNNNN` (year-sequence).
 */

export type CaseNumberMatch = {
  /** Canonical short form: `YY-NNNNN` */
  caseNumber: string;
  /** Full form as captured, including district prefix and judge initials if present */
  raw: string;
  /** Adversary proceeding vs. main bankruptcy case */
  proceeding: 'bk' | 'ap' | 'unknown';
  /** District prefix if present (e.g. "1") */
  district: string | null;
  /** Judge initials if present (e.g. "ABC") */
  judge: string | null;
  /** Character offset in source text */
  start: number;
  end: number;
};

// Case-insensitive on the proceeding (bk/ap) and judge initials because
// notices from different districts vary on capitalization (1:25-BK-12345).
const FULL_FORM = /\b(\d{1,2}):(\d{2})-(bk|ap)-(\d{4,7})(?:-([A-Z]{2,3}))?\b/gi;
const SHORT_FORM = /\b(\d{2})-(\d{4,7})(?:-([A-Z]{2,3}))?\b/gi;

export function extractCaseNumbers(text: string): CaseNumberMatch[] {
  const matches: CaseNumberMatch[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(FULL_FORM)) {
    const [raw, district, year, proceeding, seq, judge] = m;
    const canonical = `${year}-${seq.padStart(5, '0')}`;
    const key = `${m.index}:${canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      caseNumber: canonical,
      raw,
      proceeding: proceeding.toLowerCase() as 'bk' | 'ap',
      district,
      judge: judge ? judge.toUpperCase() : null,
      start: m.index!,
      end: m.index! + raw.length,
    });
  }

  for (const m of text.matchAll(SHORT_FORM)) {
    const [raw, year, seq, judge] = m;

    // Skip plausible non-case-number numerics: years out of range, ZIPs, phone fragments.
    const yearNum = Number(year);
    if (yearNum < 0 || yearNum > 99) continue;
    if (raw.length < 7) continue; // require at least YY-NNNN
    // Skip if this position was already captured by full form
    const overlapping = matches.some((mm) => mm.start <= m.index! && mm.end >= m.index! + raw.length);
    if (overlapping) continue;

    const canonical = `${year}-${seq.padStart(5, '0')}`;
    const key = `${m.index}:${canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      caseNumber: canonical,
      raw,
      proceeding: 'unknown',
      district: null,
      judge: judge ? judge.toUpperCase() : null,
      start: m.index!,
      end: m.index! + raw.length,
    });
  }

  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Return the single best case-number candidate from notice text.
 * Heuristic: prefer the first full-form match; otherwise the first short-form match.
 */
export function pickPrimaryCaseNumber(text: string): CaseNumberMatch | null {
  const all = extractCaseNumbers(text);
  if (all.length === 0) return null;
  const full = all.find((m) => m.proceeding !== 'unknown');
  return full ?? all[0];
}
