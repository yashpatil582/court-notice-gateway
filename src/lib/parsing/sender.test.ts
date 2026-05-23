import { describe, it, expect } from 'vitest';
import { classifySender } from './sender';

describe('classifySender', () => {
  it('allows ecf.*.uscourts.gov senders', () => {
    const c = classifySender('ecf_help@nysb.uscourts.gov');
    expect(c.trust).toBe('allow');
    expect(c.domain).toBe('nysb.uscourts.gov');
  });

  it('allows the bankruptcy noticing center', () => {
    expect(classifySender('noreply@bnc-mail.com').trust).toBe('allow');
    expect(classifySender('notices@noticingcenter.com').trust).toBe('allow');
  });

  it('blocks look-alike uscoorts.gov', () => {
    const c = classifySender('clerk@uscoorts.gov');
    expect(c.trust).toBe('block');
    expect(c.reasons[0]).toContain('double-o');
  });

  it('blocks uscourts on non-gov TLD', () => {
    expect(classifySender('clerk@uscourts.com').trust).toBe('block');
    expect(classifySender('alerts@uscourts.net').trust).toBe('block');
  });

  it('flags free email providers claiming to be courts', () => {
    const c = classifySender('court.clerk.notice@gmail.com');
    expect(c.trust).toBe('flag');
    expect(c.reasons.some((r) => r.includes('free email'))).toBe(true);
  });

  it('flags suspicious TLDs', () => {
    const c = classifySender('clerk@court-notify.xyz');
    expect(c.trust).toBe('flag');
    expect(c.reasons.some((r) => r.includes('suspicious TLD'))).toBe(true);
  });

  it('blocks hyphenated uscourts even on suspicious TLDs (block beats flag)', () => {
    expect(classifySender('clerk@uscourts-notify.xyz').trust).toBe('block');
  });

  it('flags unparseable senders', () => {
    expect(classifySender('not-an-email').trust).toBe('flag');
  });

  it('flags unknown but otherwise innocuous domains', () => {
    const c = classifySender('hello@somefirm.law');
    expect(c.trust).toBe('flag');
  });
});
