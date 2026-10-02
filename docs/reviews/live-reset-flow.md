# Focused interview workspace and reset repair

The production reset requests succeeded twice within three seconds. Saved-answer reads then returned zero answers, while the live session remained `ending` with `cleanupStage: complete`. The UI was showing old conversation state and the full legacy project page below the host.

The local baseline failed the composed-browser check because requesting restart navigated from Photos to Story. The transport baseline also failed: a provider startup completion arriving after shutdown changed the ended session back to uncertain.

Changes:

- One host-owned confirmation stays mounted during answer refresh and clearing, reports errors in place, and requires server acknowledgement before clearing local recovery or reconnecting.
- Uncertain resets retry the same receipt. Rejected stale commands obtain a new snapshot on an explicit retry. Fresh entry does not restore the ended call.
- Completed provider cleanup remains terminal across repeated End and late startup results; scheduled cleanup repairs historical contradictory reservations.
- Enabled Story presents one project header, photography, the live host, top-level answer review/restart and a deliberate stepped-workspace fallback. The large site wordmark and duplicate legacy project body are removed from this composition. Recording recovery is shown only for recording sessions, and identical notices appear once.

Validation: 18 composed-host browser cases; 33 live-panel/browser/capture cases; 17 guided/legacy entry cases; 39 transport cases; actual reset route and persistence logic against the isolated test database; scheduled cleanup concurrency; scoped ESLint; client imports; migration discipline; TypeScript budget904/904.

Desktop1366×900 and mobile390×844 screenshots were inspected locally. Browser media, auth and API boundaries are synthetic. The production investigation read request status, answer counts and session cleanup state; it did not submit or reset designer answers or create a provider call. Hosted CI and deployed recovery are recorded in the release result.
