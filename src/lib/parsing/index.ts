/**
 * Deterministic notice analysis pipeline.
 *
 * Given a raw notice (text body + optional sender email), runs every
 * deterministic check before any LLM is involved:
 *
 *   - case-number extraction (regex)
 *   - sender domain classification (allowlist + phishing block list)
 *   - link host validation
 *
 * Emits a single `DeterministicResult` that the caller uses to decide:
 *   1. Should this notice be marked `suspicious` and quarantined immediately?
 *   2. What case number do we attempt to match against the DB?
 *   3. What does the audit log record about why we trusted (or didn't) the
 *      sender and links?
 *
 * The LLM stage (classification + field extraction) runs only for notices
 * that survive this gate.
 */

import { pickPrimaryCaseNumber, type CaseNumberMatch } from './case-number';
import { classifySender, type SenderClassification } from './sender';
import { analyseLinks, type LinksReport } from './links';

export type DeterministicResult = {
  caseNumber: CaseNumberMatch | null;
  sender: SenderClassification | null;
  links: LinksReport;
  /** Final deterministic verdict before LLM stage runs */
  verdict: 'continue' | 'suspicious';
  reasons: string[];
};

export type AnalyseInput = {
  text: string;
  senderEmail?: string | null;
};

export function analyseNotice({ text, senderEmail }: AnalyseInput): DeterministicResult {
  const caseNumber = pickPrimaryCaseNumber(text);
  const sender = senderEmail ? classifySender(senderEmail) : null;
  const links = analyseLinks(text);

  const reasons: string[] = [];
  let verdict: 'continue' | 'suspicious' = 'continue';

  if (sender?.trust === 'block') {
    verdict = 'suspicious';
    reasons.push(`sender blocked: ${sender.reasons.join('; ')}`);
  }

  if (links.overall === 'suspicious') {
    verdict = 'suspicious';
    const bad = links.links.find((l) => l.verdict === 'suspicious');
    reasons.push(`link suspicious: ${bad?.host} — ${bad?.reason}`);
  }

  return { caseNumber, sender, links, verdict, reasons };
}

export * from './case-number';
export * from './sender';
export * from './links';
export * from './pdf';
