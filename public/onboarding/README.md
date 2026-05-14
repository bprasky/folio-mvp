# Onboarding modal video assets

Drop video files into this directory to activate the demo modal frames.

| Frame | Filename (base) | Headline |
|---|---|---|
| 1 | `01-published-project` | Your living, breathing portfolio |
| 2 | `02-interview-moment` | Folio asks questions a reporter can't |
| 3 | `03-sourcebook-fills` | Your Sourcebook fills itself |

Each base needs both formats:

- `<base>.webm` (primary, VP9)
- `<base>.mp4` (fallback, H.264)

## Encoding spec

| Property | Value |
|---|---|
| Dimensions | 1280x800 (16:10) |
| Duration | 6-10 seconds |
| File size | <800KB target, <1.5MB ceiling |
| Frame rate | 30fps |
| Audio | Stripped on export |
| Loop | Seamless (first/last frames visually similar) |

## Empty-state behavior

If a file is missing, the corresponding `<video>` element fires `onError` and the modal renders a soft `warm-mesh` fallback at the same 16:10 aspect ratio. The modal ships fully functional without these files; recordings activate the real demo when dropped in.

## Surfaces consuming these paths

- `src/components/marketing/WelcomeModal.tsx` (modal demo, click-to-advance)
- `src/app/for-designers/sections.tsx` (marketing-page version, alternating layout)

Both surfaces reference the same video bases. Re-encoding a file updates both surfaces.
