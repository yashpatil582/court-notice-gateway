import { describe, it, expect } from 'vitest';
import { analyseNotice } from './index';

const LEGIT_341_TEXT = `
UNITED STATES BANKRUPTCY COURT
SOUTHERN DISTRICT OF NEW YORK

In re: Jane Doe
Case No. 1:25-bk-12345-ABC
Chapter 7

NOTICE OF MEETING OF CREDITORS UNDER 11 U.S.C. § 341(a)

The meeting of creditors will be held on June 14, 2026 at 10:00 AM Eastern Time
via Zoom. Trustee: John Smith. Zoom link: https://uscourts.zoomgov.com/j/123456789

To view this document, visit https://ecf.nyeb.uscourts.gov/cgi-bin/Dispatch.pl?123
`;

const PHISHING_NOTICE_TEXT = `
NOTICE OF FILING - Case 25-99999
You are required to download the attached order from
https://uscourts.com/download/order.exe immediately.
`;

describe('analyseNotice', () => {
  it('passes a legitimate 341 notice from an allowed sender', () => {
    const result = analyseNotice({
      text: LEGIT_341_TEXT,
      senderEmail: 'ecf_help@nysb.uscourts.gov',
    });
    expect(result.verdict).toBe('continue');
    expect(result.caseNumber?.caseNumber).toBe('25-12345');
    expect(result.sender?.trust).toBe('allow');
    expect(result.links.overall).toBe('court_system');
  });

  it('quarantines a phishing notice with a non-gov uscourts host', () => {
    const result = analyseNotice({
      text: PHISHING_NOTICE_TEXT,
      senderEmail: 'clerk@uscourts.com',
    });
    expect(result.verdict).toBe('suspicious');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('still extracts case number even when the notice is suspicious', () => {
    const result = analyseNotice({
      text: PHISHING_NOTICE_TEXT,
      senderEmail: 'clerk@uscourts.com',
    });
    expect(result.caseNumber?.caseNumber).toBe('25-99999');
  });

  it('handles text-only input without a sender email', () => {
    const result = analyseNotice({ text: LEGIT_341_TEXT });
    expect(result.verdict).toBe('continue');
    expect(result.sender).toBeNull();
  });

  it('sets requiresReview when the sender is flagged (free email)', () => {
    // Free email senders are flagged, not blocked — the LLM must not be
    // able to auto-route the notice no matter how confident.
    const result = analyseNotice({
      text: LEGIT_341_TEXT,
      senderEmail: 'court.clerk@gmail.com',
    });
    expect(result.verdict).toBe('continue');
    expect(result.sender?.trust).toBe('flag');
    expect(result.requiresReview).toBe(true);
    expect(result.reasons.some((r) => r.includes('sender flagged'))).toBe(true);
  });

  it('sets requiresReview when a link cannot be classified (unknown host)', () => {
    const text = 'Case 25-12345 — see https://some-firm.example/notice.pdf for the order.';
    const result = analyseNotice({ text });
    expect(result.verdict).toBe('continue');
    expect(result.requiresReview).toBe(true);
  });

  it('does NOT set requiresReview when sender is allowed and all links are court-system', () => {
    const result = analyseNotice({
      text: LEGIT_341_TEXT,
      senderEmail: 'ecf_help@nysb.uscourts.gov',
    });
    expect(result.requiresReview).toBe(false);
  });
});
