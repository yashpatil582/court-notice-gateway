/**
 * Sender domain validation for court notices.
 *
 * Real PACER / CM-ECF notices come from a small set of system domains.
 * The U.S. Courts have publicly warned about fake Notices of Electronic Filing
 * delivered from look-alike domains, so an early deterministic filter against
 * an allowlist catches the obvious phishing cases before any LLM call.
 *
 * This is intentionally conservative: `allow` means "matches a known court-system
 * sender", `block` means "matches a known phishing pattern", and `flag` is the
 * residual middle ground that should never auto-route — it must go to human review.
 */

export type SenderTrust = 'allow' | 'flag' | 'block';

export type SenderClassification = {
  email: string;
  domain: string;
  trust: SenderTrust;
  reasons: string[];
};

/**
 * Known court-system domains (suffix match).
 * - `uscourts.gov` covers every district CM-ECF subdomain (e.g. ecf.nyeb.uscourts.gov).
 * - `pacer.gov` is the case-lookup system.
 * - `bnc-mail.com` and `noticingcenter.com` are the Bankruptcy Noticing Center.
 */
const ALLOW_SUFFIXES = [
  'uscourts.gov',
  'pacer.gov',
  'bnc-mail.com',
  'noticingcenter.com',
];

/**
 * Look-alike domains that have been seen in phishing campaigns targeting law
 * firms. Treated as hard-block.
 */
const BLOCK_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /uscoorts/i, reason: 'look-alike of uscourts.gov (double-o)' },
  { pattern: /uscourts\.(com|net|org|info|co)\b/i, reason: 'uscourts on non-gov TLD' },
  { pattern: /pacer\.(com|net|org|info|co)\b/i, reason: 'pacer on non-gov TLD' },
  { pattern: /uscourts-/i, reason: 'hyphenated uscourts prefix' },
  { pattern: /us-courts/i, reason: 'us-courts hyphenated' },
];

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.zip', '.review', '.country'];

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'aol.com',
  'protonmail.com',
  'icloud.com',
]);

const EMAIL_RE = /^[^@\s]+@([^@\s]+)$/;

export function parseEmail(raw: string): { email: string; domain: string } | null {
  const trimmed = raw.trim().toLowerCase();
  const m = trimmed.match(EMAIL_RE);
  if (!m) return null;
  return { email: trimmed, domain: m[1] };
}

export function classifySender(rawEmail: string): SenderClassification {
  const parsed = parseEmail(rawEmail);
  if (!parsed) {
    return {
      email: rawEmail,
      domain: '',
      trust: 'flag',
      reasons: ['unparseable sender address'],
    };
  }
  const { email, domain } = parsed;
  const reasons: string[] = [];

  for (const { pattern, reason } of BLOCK_PATTERNS) {
    if (pattern.test(domain)) {
      return { email, domain, trust: 'block', reasons: [reason] };
    }
  }

  for (const suffix of ALLOW_SUFFIXES) {
    if (domain === suffix || domain.endsWith(`.${suffix}`)) {
      return { email, domain, trust: 'allow', reasons: [`matches court-system suffix .${suffix}`] };
    }
  }

  if (FREE_EMAIL_DOMAINS.has(domain)) {
    reasons.push('free email provider — court system never sends from these');
  }

  for (const tld of SUSPICIOUS_TLDS) {
    if (domain.endsWith(tld)) {
      reasons.push(`suspicious TLD ${tld}`);
    }
  }

  if (reasons.length === 0) {
    reasons.push('domain not in allowlist; treat as flag pending review');
  }

  return { email, domain, trust: 'flag', reasons };
}
