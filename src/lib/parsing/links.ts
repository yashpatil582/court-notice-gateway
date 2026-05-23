/**
 * Link extraction and host validation.
 *
 * Real PACER notice emails contain a hyperlink to the document on the court's
 * CM-ECF system, not the document itself (this is why a "free look" window
 * exists before PACER per-page charges apply). The notice should never contain
 * an out-of-band file attachment URL or a redirector to a non-court host.
 *
 * We extract all URLs, classify each host, and surface a `verdict` for the
 * notice as a whole. The verdict feeds the deterministic suspicious-status path.
 */

export type LinkVerdict = 'court_system' | 'unknown' | 'suspicious';

export type LinkClassification = {
  url: string;
  host: string;
  verdict: LinkVerdict;
  reason: string;
};

export type LinksReport = {
  links: LinkClassification[];
  /** Overall verdict for the notice — worst host wins */
  overall: LinkVerdict;
};

const COURT_SYSTEM_SUFFIXES = [
  'uscourts.gov',
  'pacer.gov',
  'bnc-mail.com',
  'noticingcenter.com',
  // FedRAMP Zoom for Government — districts use *.zoomgov.com for virtual hearings.
  'zoomgov.com',
];

const SUSPICIOUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\buscoorts\b/i, reason: 'look-alike uscoorts' },
  { pattern: /uscourts\.(com|net|org|info|co)\b/i, reason: 'uscourts on non-gov TLD' },
  { pattern: /pacer\.(com|net|org|info|co)\b/i, reason: 'pacer on non-gov TLD' },
  { pattern: /\.(zip|review|country|click)$/i, reason: 'unusual TLD for court-system link' },
];

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+/gi;

export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_RE)).map((m) => stripTrailingPunctuation(m[0]));
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]]+$/, '');
}

function getHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyLink(url: string): LinkClassification {
  const host = getHost(url);
  if (!host) {
    return { url, host: '', verdict: 'suspicious', reason: 'unparseable URL' };
  }

  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(host)) {
      return { url, host, verdict: 'suspicious', reason };
    }
  }

  for (const suffix of COURT_SYSTEM_SUFFIXES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) {
      return {
        url,
        host,
        verdict: 'court_system',
        reason: `matches court-system suffix .${suffix}`,
      };
    }
  }

  return {
    url,
    host,
    verdict: 'unknown',
    reason: 'host not in court-system allowlist',
  };
}

export function analyseLinks(text: string): LinksReport {
  const links = extractUrls(text).map(classifyLink);

  let overall: LinkVerdict = 'court_system';
  for (const link of links) {
    if (link.verdict === 'suspicious') {
      overall = 'suspicious';
      break;
    }
    if (link.verdict === 'unknown') {
      overall = 'unknown';
    }
  }

  if (links.length === 0) {
    overall = 'unknown';
  }

  return { links, overall };
}
