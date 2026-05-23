/**
 * Build the follow-up Task that a routed/approved notice generates.
 * Centralised so the ingest path (auto-route) and the manual approve path
 * produce identical titles and due dates for the same notice type.
 */

type EventLike = {
  hearingAt: Date | null;
  deadline: Date | null;
  trustee?: string | null;
};

export function buildTaskTitle(type: string | null, event: EventLike | null): string {
  if (!event) return 'Review notice and file in case';
  switch (type) {
    case 'meeting_341':
      return `Prep for 341 meeting${event.hearingAt ? ` on ${event.hearingAt.toDateString()}` : ''}`;
    case 'deficiency':
      return `Cure deficiency${event.deadline ? ` by ${event.deadline.toDateString()}` : ''}`;
    case 'motion_to_dismiss':
      return `Respond to motion to dismiss${event.hearingAt ? ` (hearing ${event.hearingAt.toDateString()})` : ''}`;
    case 'discharge':
      return `File discharge order to case file`;
    case 'relief_from_stay':
      return `Review relief from stay motion${event.hearingAt ? ` (hearing ${event.hearingAt.toDateString()})` : ''}`;
    case 'claim_deadline':
      return `Claim bar date${event.deadline ? ` on ${event.deadline.toDateString()}` : ''}`;
    default:
      return 'Review notice and file in case';
  }
}

export function taskDueDate(event: EventLike | null): Date | null {
  if (!event) return null;
  return event.deadline ?? event.hearingAt ?? null;
}
