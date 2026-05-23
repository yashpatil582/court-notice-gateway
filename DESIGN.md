# Design decisions

The application asked to see product judgment and engineering taste, so this doc captures the non-obvious choices I made and what I'd push back on if a teammate proposed the opposite.

## 1. Deterministic first, LLM second

Bankruptcy is a low-tolerance-for-AI-error domain. Sanctions for AI-generated filing errors are now showing up in the legal press, and the ABA and California State Bar both stress lawyer supervision over autonomous action. The right way to use an LLM here is in the narrowest band that earns its keep: classification across messy district formats, and extracting facts that vary too much to regex.

So:
- **Case-number matching is a regex**, not an LLM call. PACER case numbers have a strict shape (`YY-NNNNN`, optionally with district prefix and judge initials). A regex is faster, free, never hallucinates, and is easy for a paralegal to debug.
- **Sender authenticity is an allowlist + blocklist**, not "ask the model if this looks legit." The U.S. Courts have published warnings about fake NEFs from look-alike domains; a model is the wrong place to make that decision.
- **Suspicious-verdict short-circuits the LLM.** Quarantined notices never reach Groq. This both hardens the trust boundary (no prompt injection from a phishing notice) and saves tokens.
- **The LLM gets exactly one tool call** that returns notice type + every operative field + per-field confidence. Originally split into two calls; merged after Day 5 data showed the split doubled latency for no quality gain on a 70B model.

## 2. Confidence ≠ feel-good number

The `confidence` column is the routing key. It blends three signals: classification confidence (50%), average over present-field confidences (40%), and a 10% boost for an exact case-number match. A notice below the 0.75 threshold _never_ auto-routes — it sits in the Review Queue with confidence bars per field so the paralegal can see exactly where the model was unsure.

The threshold is an environment variable (`REVIEW_CONFIDENCE_THRESHOLD`) because what counts as "review-worthy" varies by firm: a high-volume bankruptcy mill wants aggressive auto-routing; a boutique handling business reorganizations wants every notice reviewed.

## 3. Audit log is not optional

Every state change writes an `audit_events` row: ingest, edit, approve, reject. Every LLM call writes a `parse_runs` row with the prompt, raw output, latency, and tokens. This isn't sprinkled in for fun — it's a hard requirement for a system that handles legal workflow:

- The eval is reproducible (re-run any past parse).
- A paralegal can answer "why does this notice say the hearing is the 14th?" by looking at the audit trail.
- An incident review after a bad route is a single query, not a forensic exercise.

The Notice detail page renders the audit trail inline. That's the difference between a demo and a system someone could plausibly deploy.

## 4. Private blobs, proxied

Court notices include client PII (debtor names, case numbers, sometimes amounts owed). Vercel Blob's private store is the right default — but private blobs need signed access. I built a thin proxy route (`/api/notices/[id]/pdf`) that uses `@vercel/blob.get()` server-side and streams the file back. Two upsides over exposing the signed URL to the client:

1. The only thing the browser ever sees is `/api/notices/<id>/pdf` — no tokens in the URL bar, no tokens in browser history.
2. It gives me a single place to add an ACL check later (workspace membership, document-level permissions).

## 5. MCP server is a strategic bet, not a tech demo

Glade publicly announced MCP support before most legal tech. Wiring an MCP server into this build is a signal that I read their roadmap, not that I think every product needs MCP. The server is intentionally narrow: **four read-only tools**, no write surface, no PII dump. They're the questions an attorney would actually ask their tools out loud: _"what hearings do I have next week?"_, _"what's the timeline on case 25-12345?"_, _"what's still in the review queue?"_, _"who got their discharge this month?"_.

Read-only is the right call for v1 — letting an LLM mutate state in a legal workflow is something you earn over time, not ship on day one.

## 6. Provider-abstracted LLM, model-portable

`lib/llm/` has a single `runTool({system, user, tool, schema})` entry point. Today's provider is Groq (free tier, fast); the implementation is two files (`index.ts` dispatch + `groq.ts`). Adding Anthropic, OpenAI, or a self-hosted Llama is one new file and one switch case. The eval harness, the pipeline, the UI — none of them know which provider answered.

This matters for the FDE role specifically: in a real deployment you don't always get to pick the LLM. A firm with HIPAA-adjacent data might require an on-prem model; a firm under a vendor preference might want Azure OpenAI. The architecture should make those choices a config flip, not a refactor.

## 7. Eval is the differentiator

The job description called out "eval loops" explicitly. The temptation is to build a flashy benchmark UI; the right thing is to ship one reproducible script (`pnpm eval`) with a labeled fixture set and a markdown report committed to the repo, so a reviewer reads the numbers without setting anything up. The eval doesn't write to the DB; it's a pure function over the fixtures, which means it stays runnable as the codebase evolves.

Per-field precision/recall/F1 plus a macro-F1 is a better signal than overall accuracy because it surfaces _which_ field needs work. The current numbers show courtroom extraction is the weakest (83% F1) — that's the next thing I'd tune.

## 8. What's intentionally out of scope

- **Multi-tenant auth.** A single-workspace assumption means no time spent on SSO / role-based access. Adding it is a Drizzle table and a session cookie — not interesting.
- **Real PACER credentialed integration.** Stubbed with public sample notices. Plugging in real PACER pulling is plumbing, not product judgment.
- **Open-ended chat.** No "ask the documents anything." That's the legal AI failure mode — broad generation with no eval surface. Every model call is structured tool-use with a schema.
- **Background queue infra.** Notices ingest in-line in the request. For higher volumes (>100/min) move to Inngest; the upload action stays the same, the pipeline runs in a job.
- **Email ingest.** Resend inbound webhooks were drafted but skipped on Day 7. The pipeline accepts arbitrary text, so wiring an inbound channel is a small addition.

## 9. What I'd build next

- **Tune the courtroom field.** It's the weakest at 83% F1; the prompt currently treats "Courtroom 4" and "Room 4202" interchangeably. A few-shot prompt with district examples should clear that up.
- **Latency budget per stage.** Median ingest is 2.6s after Day 6 consolidation. Pushing toward sub-1s means streaming the model output and writing fields as they arrive — perceived latency drops more than wall-clock.
- **Diff-on-paste in Review.** When a paralegal pastes a corrected hearing time, highlight what changed against the model output. Helps trust calibration.
- **MCP write surface, gated.** `approve_notice(noticeId, reviewer)` and `update_extracted_field(noticeId, field, value)`. Same audit trail, gated behind an explicit role.
- **District-specific extraction.** Some districts (CACB, NYEB) format hearing notices very differently. Routing to a per-district few-shot template would lift courtroom and trustee precision more.
