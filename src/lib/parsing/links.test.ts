import { describe, it, expect } from 'vitest';
import { analyseLinks, classifyLink, extractUrls } from './links';

describe('extractUrls', () => {
  it('pulls bare https URLs from text', () => {
    const text = 'View document at https://ecf.nyeb.uscourts.gov/doc/123 or call later.';
    expect(extractUrls(text)).toEqual(['https://ecf.nyeb.uscourts.gov/doc/123']);
  });

  it('strips trailing punctuation', () => {
    const text = 'See https://pacer.gov/login.';
    expect(extractUrls(text)).toEqual(['https://pacer.gov/login']);
  });

  it('handles multiple URLs in one block', () => {
    const text = 'Doc: https://ecf.nyeb.uscourts.gov/d/1 and https://bnc-mail.com/n/5';
    expect(extractUrls(text)).toHaveLength(2);
  });
});

describe('classifyLink', () => {
  it('marks ecf.*.uscourts.gov as court_system', () => {
    expect(classifyLink('https://ecf.cacb.uscourts.gov/cgi-bin/Dispatch.pl').verdict).toBe(
      'court_system',
    );
  });

  it('marks uscourts.com as suspicious', () => {
    expect(classifyLink('http://uscourts.com/n').verdict).toBe('suspicious');
  });

  it('marks unknown hosts as unknown', () => {
    expect(classifyLink('https://example.com/file.pdf').verdict).toBe('unknown');
  });

  it('marks .zip TLDs as suspicious', () => {
    expect(classifyLink('https://document-viewer.zip/notice').verdict).toBe('suspicious');
  });
});

describe('analyseLinks', () => {
  it('overall verdict is suspicious if any link is suspicious', () => {
    const text = 'Doc: https://ecf.nyeb.uscourts.gov/d/1 and https://uscoorts.gov/login';
    expect(analyseLinks(text).overall).toBe('suspicious');
  });

  it('overall is court_system when every link is court system', () => {
    const text = 'https://ecf.nyeb.uscourts.gov/d/1 and https://bnc-mail.com/n/5';
    expect(analyseLinks(text).overall).toBe('court_system');
  });

  it('overall is unknown when no links present', () => {
    expect(analyseLinks('No URLs here.').overall).toBe('unknown');
  });
});
