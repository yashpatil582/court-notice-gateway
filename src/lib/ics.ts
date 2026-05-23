/**
 * Minimal RFC 5545 ICS generator for case calendars.
 *
 * Generates a VCALENDAR with one VEVENT per hearing, deadline, and open
 * task on a case. Hearings render as timed UTC events; deadlines and
 * tasks render as all-day events. Long-line folding is omitted; modern
 * clients accept unfolded lines.
 */

export type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  /** UTC datetime for timed events. Mutually exclusive with `date`. */
  startUtc?: Date;
  endUtc?: Date;
  /** All-day events use date-only (YYYYMMDD). */
  date?: Date;
};

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function fmtUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    'T' +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    'Z'
  );
}

function fmtDate(d: Date): string {
  return d.getUTCFullYear().toString() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate());
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildIcs(opts: { calendarName: string; events: IcsEvent[] }): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Court Notice Gateway//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(opts.calendarName)}`,
  ];

  const now = fmtUtc(new Date());

  for (const ev of opts.events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${now}`);

    if (ev.startUtc) {
      lines.push(`DTSTART:${fmtUtc(ev.startUtc)}`);
      const end = ev.endUtc ?? new Date(ev.startUtc.getTime() + 60 * 60 * 1000);
      lines.push(`DTEND:${fmtUtc(end)}`);
    } else if (ev.date) {
      lines.push(`DTSTART;VALUE=DATE:${fmtDate(ev.date)}`);
      // All-day events end on the following day.
      const next = new Date(ev.date.getTime() + 24 * 60 * 60 * 1000);
      lines.push(`DTEND;VALUE=DATE:${fmtDate(next)}`);
    }

    lines.push(`SUMMARY:${escapeIcs(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
