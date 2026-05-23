# 4-minute demo script

Tight. Pick one story and tell it cleanly. Read aloud while screen-sharing.

## Setup before recording

- `pnpm db:reset && pnpm e2e` so the inbox is clean and seeded.
- Two browser tabs open:
  1. `http://localhost:3000` (Inbox)
  2. Finder window with `fixtures/notices/phishing-fake-nef.pdf` + `341-meeting-legit.pdf`.
- Claude Desktop open, with MCP config already pointed at the local server.
- Terminal visible with `pnpm eval` and `pnpm mcp` ready to run.

## 0:00 — 0:25  ·  Frame the problem

> "Forwarded PACER notices land in paralegal inboxes every day. They cost time, they cause missed dates, and the U.S. Courts have publicly warned that they're now used in phishing campaigns against law firms.
>
> Glade's bankruptcy practice page and recent blog posts call out PACER notice tracking directly — this is the workflow."

[Show the Inbox tab — empty state or current state.]

## 0:25 — 1:25  ·  Phishing path (build trust)

[Drag `phishing-fake-nef.pdf` into the upload screen.]

> "I'll upload a notice from `clerk@uscourts.com` — that's not the real court domain. Watch the deterministic stage handle it: sender allowlist, link host check, no LLM call needed. It lands in the inbox as **suspicious**, quarantined."

[Show the inbox row — red Suspicious badge. Open the notice.]

> "Audit trail records exactly why we quarantined it. The LLM never saw this file — that's the trust boundary."

## 1:25 — 2:30  ·  Happy path (show the system)

[Drag `341-meeting-legit.pdf` into the upload screen.]

> "Now a real 341 notice. Deterministic checks pass — case-number regex picks up `25-12345`, sender is `*.uscourts.gov`. The notice hits the LLM stage: Groq llama-3.3-70b in a single tool-use call returns notice type, hearing time, trustee, deadline, and per-field confidence — all in one round trip, about 2.5 seconds."

[Open the notice — show side-by-side PDF + extracted fields with confidence bars.]

> "Confidence bars per field. Hearing time, courtroom, trustee, judge, deadline. The 95% overall confidence is above threshold so it auto-routed, but I can still open it and edit anything — every edit is saved to the audit log."

[Click Approve.]

> "Approve generates a follow-up Task and writes a `ReviewDecision` row."

[Click the case number → Case Timeline.]

> "Here's the case timeline: notices, hearings, tasks. And there's a `.ics` export — paralegal subscribes to this in Outlook and the case calendar stays current as new notices land."

## 2:30 — 3:00  ·  Eval

[Switch to terminal.]

```bash
pnpm eval
```

[While it's running:]

> "20 synthetic fixtures across all six notice types plus four phishing variants, with typed ground-truth labels. The harness runs the same pipeline you saw, no DB writes, and emits a markdown report."

[Open `/metrics` in the browser.]

> "100% case match, 100% type classification, 0% phishing false positive, 94.3% macro-F1 across extracted fields. The macro-F1 column tells me courtroom extraction is the weakest — that's the next thing I'd tune."

## 3:00 — 3:45  ·  MCP

[Switch to Claude Desktop.]

> "Glade was the first legal tech to ship MCP. So I built an MCP server with four read-only tools."

[Type in Claude Desktop:]

```
List every bankruptcy hearing in the next 30 days.
```

[Wait for the tool call.]

> "It pulled `list_upcoming_hearings` from the gateway. The data is exactly what's in the Postgres — same source of truth as the UI."

[Follow-up prompt:]

```
What's the case timeline for 25-12345?
```

## 3:45 — 4:00  ·  Close

> "One workflow, done well. The pattern — deterministic checks, single-call structured AI, human review with a confidence-thresholded queue, full audit, optional MCP — generalizes to filings, intake, retainers. That's the slice I'd want to talk through if I'm the engineer who ends up making Glade actually work inside a firm."
