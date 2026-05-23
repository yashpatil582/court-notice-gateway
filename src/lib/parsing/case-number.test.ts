import { describe, it, expect } from 'vitest';
import { extractCaseNumbers, pickPrimaryCaseNumber } from './case-number';

describe('extractCaseNumbers', () => {
  it('extracts a full-form bankruptcy case number with district and judge', () => {
    const text = 'Re: Case 1:25-bk-12345-ABC, Notice of Chapter 7 Bankruptcy';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      caseNumber: '25-12345',
      proceeding: 'bk',
      district: '1',
      judge: 'ABC',
    });
  });

  it('extracts an adversary proceeding number', () => {
    const text = 'Adversary Case 2:24-ap-04567 filed';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].proceeding).toBe('ap');
    expect(matches[0].caseNumber).toBe('24-04567');
  });

  it('extracts short-form case numbers in plain text', () => {
    const text = 'Reference case 25-12345 attached.';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].caseNumber).toBe('25-12345');
    expect(matches[0].proceeding).toBe('unknown');
  });

  it('deduplicates full and short matches at the same position', () => {
    const text = 'Case 1:25-bk-12345-ABC will not double-count';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(1);
  });

  it('finds multiple distinct case numbers in one document', () => {
    const text = 'Main case 1:25-bk-12345 related to adversary 1:25-ap-67890';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.caseNumber)).toEqual(['25-12345', '25-67890']);
  });

  it('pads short sequences to 5 digits', () => {
    const text = 'Case 25-1234 here';
    const matches = extractCaseNumbers(text);
    expect(matches[0]?.caseNumber).toBe('25-01234');
  });

  it('skips obvious non-case-number digit clusters', () => {
    const text = 'Tel 555-1234 (not a case)';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(0);
  });

  it('matches case-insensitive bk/ap and uppercases the judge initials', () => {
    const text = 'In re: Case 1:25-BK-12345-abc';
    const matches = extractCaseNumbers(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].proceeding).toBe('bk');
    expect(matches[0].judge).toBe('ABC');
  });
});

describe('pickPrimaryCaseNumber', () => {
  it('prefers full-form matches over short-form when both exist', () => {
    const text = 'See case 25-99999 elsewhere, but this notice concerns 1:25-bk-12345-XYZ';
    const primary = pickPrimaryCaseNumber(text);
    expect(primary?.caseNumber).toBe('25-12345');
    expect(primary?.proceeding).toBe('bk');
  });

  it('falls back to short-form when no full form is present', () => {
    const text = 'Notice about case 25-12345';
    const primary = pickPrimaryCaseNumber(text);
    expect(primary?.caseNumber).toBe('25-12345');
  });

  it('returns null when no case number is found', () => {
    expect(pickPrimaryCaseNumber('No case numbers here at all.')).toBeNull();
  });
});
