# Court Notice Gateway

A production-style ingestion layer for U.S. bankruptcy court notices. Forwarded PACER / CM-ECF notices come in (email or PDF), get validated for authenticity, classified, structured, and routed to the right case as timeline events, tasks, and calendar entries — with low-confidence extractions routed to a paralegal for review.

Built as the take-home for the [Glade.ai](https://glade.ai) Forward Deployed Engineer application.

## Why this exists

Bankruptcy paralegals spend hours each week parsing PACER/CM-ECF notices in inboxes: identifying the right case, extracting hearing details, updating calendars, and routing follow-ups. The workflow is high-stakes (missed dates have real consequences), increasingly exposed to phishing (the U.S. Courts have publicly warned about fake Notices of Electronic Filing), and inherently messy because every district formats notices differently.

Glade's public surface — bankruptcy practice page, May 2026 blog posts on PACER notice tracking, and their first-in-legal-tech MCP integration — points directly at this workflow. This project is a focused build of exactly that gateway: deterministic-first parsing, AI used only where it earns its keep, full human-in-the-loop review, and an optional MCP surface so the resulting case state is queryable from Claude or ChatGPT.

## Status

**Day 1 of 7 — scaffolding complete.**

- [x] Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui
- [x] Drizzle ORM schema (Case, Notice, ParseRun, ExtractedEvent, Task, ReviewDecision, AuditEvent, SenderPolicy)
- [x] Nav shell + empty Notice Inbox / Review / Cases / Metrics screens
- [ ] PDF ingest + deterministic checks (Day 2)
- [ ] Groq classification + extraction (Day 3)
- [ ] Side-by-side review UI + audit log (Day 4)
- [ ] Eval harness with reproducible metrics (Day 5)
- [ ] Phishing heuristics + remaining notice types + MCP server (Day 6)
- [ ] Metrics dashboard + ICS export + Loom walkthrough (Day 7)

## Stack and why

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router) + React 19 | Single repo, server actions, easy Vercel deploy, matches Glade's stack |
| UI | Tailwind 4 + shadcn/ui | Considered defaults, no design tokens to invent |
| DB | Postgres on Neon | Free tier, serverless-friendly |
| ORM | Drizzle | Type-safe, no codegen friction |
| LLM | Groq `llama-3.3-70b-versatile` (tool-use) | Free tier, sub-second latency, open-weight Llama. Provider-abstracted via `lib/llm.ts` so Anthropic / OpenAI / self-hosted swap is one line. |
| MCP | `@modelcontextprotocol/sdk` | Open protocol; Claude Desktop (free) is the demo client |
| Deploy | Vercel + Neon + Groq | $0 to run |

**Design principles:**
- Deterministic rules first (case number regex, sender allowlist, link host validation). LLM only for classification and extraction.
- Every parse run + every human edit is written to an audit log.
- Low-confidence extractions never auto-route — they sit in a Review Queue.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local   # fill in DATABASE_URL and GROQ_API_KEY
pnpm db:push                       # apply schema to Neon
pnpm dev
```

Open <http://localhost:3000>.

### Required environment variables

| Var | Purpose | Free source |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | <https://neon.tech> |
| `GROQ_API_KEY` | LLM provider key | <https://console.groq.com/keys> |
| `BLOB_READ_WRITE_TOKEN` | File storage for PDFs | Vercel Blob (free tier) |

## Non-goals (explicit)

- Broad legal research or case-law search
- Autonomous filing or auto-submission to PACER
- Open-ended legal advice / chat-with-your-docs
- Multi-tenant auth and RBAC beyond a single workspace
- Real PACER credentialed integration (mocked with public sample notices)

## Project layout

```
src/
  app/                  # App Router pages (Inbox, Review, Cases, Metrics, Upload)
  components/ui/        # shadcn primitives
  db/
    schema.ts           # Drizzle schema (10 tables, 6 enums)
    index.ts            # postgres-js client
  lib/                  # utilities (llm.ts, parsing, deterministic checks)
drizzle/                # generated SQL migrations
fixtures/               # public sample notices + synthetic variants (added Day 5)
scripts/                # seed, eval runner
```

## Credits

Built solo against Glade's public job description and product surface. Public source pack: PACER and U.S. Courts noticing documentation, Glade's bankruptcy and general-law pages, Anthropic's MCP spec, ABA Formal Opinion 512 and California State Bar generative AI guidance.
