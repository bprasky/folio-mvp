# Posting Interview Error Guide

This guide summarizes the error contracts for the project interview APIs and the expected client behaviour when saving answers or generating follow-ups.

## Response codes

| Code | Payload | Meaning | Client behaviour |
| --- | --- | --- | --- |
| `200 OK` | `{ ok: true, savedCount, totalCount }` | Save succeeded. `savedCount` reflects new/updated answers merged, `totalCount` is the stored total. | Clear field errors, remove any “retry” banner, keep editing flow. |
| `200 OK` | `{ followUps, filteredOutCount }` | Follow-up suggestions succeeded. `filteredOutCount` indicates prompts rejected for length/blank issues. | Render the returned prompts; optionally show a notice if `filteredOutCount > 0`. |
| `200 OK` | `{ followUps: [], filteredOutCount: 0, error: "llm_unavailable" }` | Follow-up generator is disabled (`POSTING_V1` true but `OPENAI_ENABLED` false). | Continue without follow-ups and fall back to deterministic draft. |
| `404 Not Found` | `{ error: "posting_disabled" }` | `POSTING_V1` is false on the server. | Hide interview UI; only the Media tab and preview shell should remain. |
| `409 Conflict` | `{ error: "concurrent_update", hint: "retry" }` | The interview was updated concurrently (Prisma unique constraint). | Show a transient banner (“We’re syncing your answers—retrying…”). Autosave will re-send on next change. |
| `422 Unprocessable Entity` | `{ error: "validation_failed", issues: ZodIssue[] }` | Validation failed (blank/too long answers, malformed payload). `issues[n]` maps to `answers[n]`. | Highlight offending questions, keep the modal open, block progression. Preview keeps a banner until the next successful save. |
| `429 Too Many Requests` | `{ error: "...", resetAt }` | Draft generation rate limited by user (daily) or project (per minute). | Surface the reset timer to the designer, allow retry once the timer elapses. |
| `500 Internal Server Error` | `{ error: "server_error", requestId }` | Unexpected server error. | Display a generic error with the `requestId` for support; autosave can retry. |

## Client retry rules

1. **Autosave**  
   - Each modal instance keeps a single `AbortController`. When a new save starts, the in-flight request is aborted so only the latest payload is processed.  
   - Saves are debounced at ~700 ms (“trailing only”) to avoid bursts while typing.
2. **422 validation failures**  
   - Field errors are stored per `questionId` and surfaced inline.  
   - The preview page reads `sessionStorage[folio.interview.validation.{projectId}]` and shows a yellow banner until a successful save clears the flag.
3. **409 concurrency conflicts**  
   - Autosave catches the conflict, shows “We’re syncing your answers—retrying…”, and waits for the next input change to re-send.  
   - Step navigation (`Next`, `Generate`) will stop and keep the user on the current screen.
4. **Network errors**  
   - Treated like 409s: a banner prompts the user to keep editing, and the next autosave will retry.

## Validation limits

| Field | Limit |
| --- | --- |
| Interview answer text | Trimmed, must be non-empty, ≤ **2000 characters** |
| Follow-up prompt (LLM output) | ≤ **120 characters** (invalid prompts are filtered server-side) |
| Question bank selection | 1–12 prompts (modal enforces minimum selections before advancing) |

When an answer exceeds the limit or is blank after trimming, the server returns a 422 and identifies the offending `questionId`.



