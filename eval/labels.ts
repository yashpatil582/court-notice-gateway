/**
 * Ground-truth labels for the eval fixture set.
 *
 * For each fixture we record what a careful human paralegal would extract.
 * The eval harness compares model output against these labels and computes
 * per-metric accuracy / F1 / etc.
 *
 * Conventions:
 *   - expectedHearingAt is an ISO-8601 string with timezone, or null.
 *   - Dates without a time component use 00:00 in their local timezone.
 *   - String fields use a `contains` semantic: model output is correct if it
 *     equals or contains the expected substring (case-insensitive).
 *   - `virtualUrl` set to '*' means "any non-null URL is acceptable" — we
 *     don't pin to exact URL.
 *   - `expectedType` of `null` is used for fixtures that should be quarantined
 *     by deterministic checks before the LLM runs.
 */

import type { NoticeType } from '../src/lib/notice-pipeline/analyse';

export type ExpectedFields = {
  hearingAt: string | null;
  courtroom: string | null;
  virtualUrl: '*' | string | null;
  trustee: string | null;
  judge: string | null;
  deadline: string | null;
};

export type Label = {
  expectedCaseNumber: string;
  expectedType: NoticeType | null; // null = phishing / quarantine before LLM
  expectedStatus: 'routed' | 'needs_review' | 'suspicious';
  expectedSenderTrust: 'allow' | 'flag' | 'block';
  expectedFields: ExpectedFields;
};

// Build a per-fixture label keyed by fixture filename stem (no .txt/.pdf suffix).
export const LABELS: Record<string, Label> = {
  '341-meeting-legit': {
    expectedCaseNumber: '25-12345',
    expectedType: 'meeting_341',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-06-14T10:00:00-04:00',
      courtroom: null, // virtual
      virtualUrl: '*',
      trustee: 'Robert J. Whitman',
      judge: null,
      deadline: '2026-08-13',
    },
  },

  '341-meeting-zoom-cacb-ch13': {
    expectedCaseNumber: '25-22890',
    expectedType: 'meeting_341',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-07-22T13:30:00-07:00',
      courtroom: null,
      virtualUrl: '*',
      trustee: 'Kathy A. Dockery',
      judge: null,
      deadline: '2026-09-22',
    },
  },

  '341-meeting-inperson-txsb': {
    expectedCaseNumber: '25-30412',
    expectedType: 'meeting_341',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-05-27T09:00:00-05:00',
      courtroom: 'Room 4202',
      virtualUrl: null,
      trustee: 'Allison D. Byman',
      judge: null,
      deadline: '2026-07-26',
    },
  },

  '341-meeting-rescheduled-flsb': {
    expectedCaseNumber: '25-18077',
    expectedType: 'meeting_341',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-06-09T11:30:00-04:00',
      courtroom: null,
      virtualUrl: null, // telephonic, not virtual URL
      trustee: 'Maria Yip',
      judge: null,
      deadline: '2026-08-08',
    },
  },

  'deficiency-legit': {
    expectedCaseNumber: '25-44321',
    expectedType: 'deficiency',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: '2026-05-12',
    },
  },

  'deficiency-schedules-ganb': {
    expectedCaseNumber: '25-55104',
    expectedType: 'deficiency',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: '2026-05-17',
    },
  },

  'deficiency-fees-mieb': {
    expectedCaseNumber: '25-41229',
    expectedType: 'deficiency',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: '2026-05-30',
    },
  },

  'discharge-legit': {
    expectedCaseNumber: '24-09876',
    expectedType: 'discharge',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: 'Diana A. Cortez',
      deadline: null,
    },
  },

  'discharge-ch13-ohnb': {
    expectedCaseNumber: '22-13456',
    expectedType: 'discharge',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: 'Arthur I. Harris',
      deadline: null,
    },
  },

  'discharge-ch7-vaeb': {
    expectedCaseNumber: '25-72018',
    expectedType: 'discharge',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: 'Keith L. Phillips',
      deadline: null,
    },
  },

  'motion-to-dismiss-trustee-paeb': {
    expectedCaseNumber: '25-19045',
    expectedType: 'motion_to_dismiss',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-06-18T10:00:00-04:00',
      courtroom: 'Courtroom 4',
      virtualUrl: null,
      trustee: 'Scott F. Waterman',
      judge: 'Ashely M. Chan',
      deadline: null,
    },
  },

  'motion-to-dismiss-failure-disclose-cob': {
    expectedCaseNumber: '24-58221',
    expectedType: 'motion_to_dismiss',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-06-02T13:30:00-06:00',
      courtroom: 'Courtroom B',
      virtualUrl: null,
      trustee: null,
      judge: 'Michael E. Romero',
      deadline: '2026-05-26',
    },
  },

  'relief-from-stay-secured-azb': {
    expectedCaseNumber: '25-04412',
    expectedType: 'relief_from_stay',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-06-11T13:30:00-07:00',
      courtroom: '603',
      virtualUrl: null,
      trustee: null,
      judge: 'Daniel P. Collins',
      deadline: '2026-06-04',
    },
  },

  'relief-from-stay-lease-tnmd': {
    expectedCaseNumber: '25-26803',
    expectedType: 'relief_from_stay',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: '2026-05-28T09:30:00-05:00',
      courtroom: 'Courtroom 1',
      virtualUrl: null,
      trustee: null,
      judge: 'Marian F. Harrison',
      deadline: '2026-05-21',
    },
  },

  'claim-deadline-bar-date-ncwb': {
    expectedCaseNumber: '25-50901',
    expectedType: 'claim_deadline',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: '2026-07-31',
    },
  },

  'claim-deadline-amended-mnb': {
    expectedCaseNumber: '24-32189',
    expectedType: 'claim_deadline',
    expectedStatus: 'routed',
    expectedSenderTrust: 'allow',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: '2026-06-30',
    },
  },

  'phishing-fake-nef': {
    expectedCaseNumber: '25-77777',
    expectedType: null,
    expectedStatus: 'suspicious',
    expectedSenderTrust: 'block',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: null,
    },
  },

  'phishing-uscoorts': {
    expectedCaseNumber: '25-88888',
    expectedType: null,
    expectedStatus: 'suspicious',
    expectedSenderTrust: 'block',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: null,
    },
  },

  'phishing-pacer-com': {
    expectedCaseNumber: '25-66677',
    expectedType: null,
    expectedStatus: 'suspicious',
    expectedSenderTrust: 'block',
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: null,
    },
  },

  'phishing-gmail-clerk': {
    expectedCaseNumber: '25-99012',
    expectedType: null,
    expectedStatus: 'suspicious',
    expectedSenderTrust: 'flag', // gmail.com flags, isn't blocked outright
    expectedFields: {
      hearingAt: null,
      courtroom: null,
      virtualUrl: null,
      trustee: null,
      judge: null,
      deadline: null,
    },
  },
};
