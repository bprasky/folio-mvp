# For Designers video assets

These videos support the existing For Designers marketing page. The homepage welcome uses a single still photograph and no longer loads these assets.

| Frame | Filename (base) | Headline |
|---|---|---|
| 1 | `01-published-project` | Your living, breathing portfolio |
| 2 | `02-interview-moment` | An interview that writes itself into editorial |
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

If a file is missing, the corresponding `<video>` element fires `onError` and the marketing page renders a soft `warm-mesh` fallback at the same 16:10 aspect ratio.

## Surfaces consuming these paths

- `src/app/for-designers/sections.tsx` (marketing-page version, alternating layout)

The welcome image is configured in `src/components/marketing/WelcomeModal.tsx` and reuses existing Folio login photography. Its crop, contrast scrim and typography live in `WelcomeModal.module.css`. Replacing the photograph requires checking both desktop and mobile crops.
