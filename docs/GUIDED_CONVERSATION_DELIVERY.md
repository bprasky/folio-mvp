# Conversational project interview

The Story step uses the existing guided interview in an inline text/dictation workspace. It does not start a project avatar call. Existing guided enrollment, protected Spotlight routing, legacy fallback, saved interviews, question preparation, coverage, corrections and explicit article generation remain authoritative.

## One answer, one reply in two parts

The authenticated guided POST accepts `Accept: application/x-ndjson`; existing JSON clients keep their response contract. The answer and its canonical projection commit before `saved` is emitted. Only a newly accepted substantive answer starts one optional Haiku observation, concurrently with the existing next-question work. Skips, corrections, confirmations and exact retries do not start observations.

The observation reads only the current question and accepted answer. It is one grounded statement, never a question, confirmation request, invitation to elaborate, praise or invented comparison. Empty output is valid. Exact evidence, length and interrogative/invitation checks reject malformed candidates, but these checks do not prove semantic grounding. The question generator no longer owns a reaction field; its existing independent reviews remain in place. Previously saved reactions still render.

The composer stays disabled until the complete checked question arrives, with its draft and request receipt preserved. `saved`, `reaction`, `complete` and `error` events are consumed incrementally, including split Unicode. A 90-second deadline covers the entire response body. A truncated stream keeps the original receipt for deliberate retry. A known saved answer is labeled saved even when its next reply fails.

A reaction has one attempt, a 3.5-second provider timeout and no retries. Completion or transport cancellation aborts outstanding reaction work. A fresh session/version read prevents an observation from being emitted over a newer pause/correction. An observation ready before the next canonical commit is stored on its originating turn as Folio presentation text, never copied into designer/article evidence. Superseded/invalidated turns do not show their observation. Late, missing or rejected observations never delay the next question. There is no artificial reading timer.

## Optional room checkpoints

Inline clients opt into persisted room checkpoints on the existing guided command path. After a room with accepted answers is covered, Folio asks “Before we move to [next room], did we miss anything you wanted to mention about [this room]?” The last room uses the same pointed invitation without a next-room announcement. The composer remains open for typing/dictation; Review room and Continue are available. No “Add something” button or required negative reply.

The invitation is a real versioned optional question, not a small-model reaction. The application retains the next prepared question while the designer reviews the room. Continue and unambiguous standalone negative replies skip only the invitation, make no model call, and create no article evidence or missing-coverage penalty. Explicit whole-room skips do not introduce a checkpoint. Earlier rooms remain reviewable; reopening a completed room preserves the current question as its return destination. Read-only review does not discard unsent text; corrections retain history and invalidate dependent evidence as before.

An accepted omission can produce at most one substantive follow-up using the room's existing saved photo classifications/material analysis (up to three included photos, explicitly selected photo first) and accepted project/room answers. This does not run new image analysis. Metadata is tentative context; exact accepted-answer evidence must support factual premises. A dedicated generation/review pair may repair once, with existing token/cost recording and saved-answer retry behavior. An explicitly volunteered object can be discussed in terms of design judgment; general question preparation remains room-wide. A complete explanation can advance directly. The model's ability to make that judgment still requires actual-provider evaluation.

Room invitations, skipped invitations and optional follow-ups are excluded from required room counts. Any substantive accepted answer retains its room/photo/modality attribution in the canonical article evidence. No schema migration or article rewrite is performed by the checkpoint itself.

## Costs and acceptance

`MODEL_FOR.interviewReaction` reuses the configured Haiku model. `guided-interview-reaction` cost events record actual returned usage. Reply timing logs separate saved, reaction and completion latency without logging answers. Call count increases by at most one reaction request per newly accepted eligible answer; existing main-model review/repair work is unchanged. Interrupted provider requests may still incur provider charges.

Local checks use fictional designer content and provider/persistence doubles. They cover durable-save ordering, parallel delivery, lost responses, Unicode, timeout, exact replay, supersession, observation failure and late completion, evidence exclusion, authentication and protected routes. Browser regressions cover inline presentation, no avatar/microphone startup, locked input during a held streamed reply, restoration and desktop/tablet/mobile widths.

Before release, complete browser CI and a bounded actual-model review of observations (negation, uncertainty, budgets, sparse answers and injection attempts). Compare useful next questions, repeated topics, unsupported premises, first-reaction latency and complete-question latency. Synthetic checks do not establish real model quality or zero lag.

Spoken playback and short story-informed video opportunities are subsequent work. This change neither records interview video nor rewrites an article as a side effect of answering.
