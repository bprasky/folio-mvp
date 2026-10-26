# Selected visual evidence

These are Chrome viewport emulation and simulated touch, not physical-device tests. All content is synthetic. The connected captures use actual Next/session/database rendering; responsive fixtures use actual components/CSS/fonts with synthetic API responses.

| Area | Desktop | Mobile |
| --- | --- | --- |
| Manual creation with entered fields | [1440px](connected-manual-1440.png) | [390px](connected-manual-390.png) |
| Saved project with eleven photos and tag | [1440px](connected-workspace-1440.png) | [390px](connected-workspace-390.png) |
| Published story | [1440px](connected-story-1440.png) | [390px](connected-story-390.png) |
| Public profile and persisted follow controls | — | [390px](connected-profile-390.png) |

Additional significant fixtures: [short dialog with reachable action](dialog-short-action-390.png), [uncropped portrait/tag geometry](tagging-active-390.png), [long story at 360px](story-long-360.png), and [profile error with retry](profile-feed-error-360.png).

The responsive full manifest records 115 entries across required widths and intermediate breakpoints; the additional quick manifest records 27 entries including nested/unsaved-dialog assertions. Full captures are retained locally; selected images above are the reviewable PR evidence. Screenshots alone do not establish focus, geometry persistence or save success: those assertions are in the test logs/manifests.
