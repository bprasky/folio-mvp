# Publication export fonts

The article and social assets use Folio's Cormorant Garamond and Instrument Sans families. These files bundle the same fonts for browser canvas previews and server image generation so line breaks and glyphs do not depend on host fonts or a third-party request at export time.

Downloaded from the official Google Fonts repository on 2026-10-28:

- https://github.com/google/fonts/blob/main/ofl/cormorantgaramond/CormorantGaramond%5Bwght%5D.ttf
- https://github.com/google/fonts/blob/main/ofl/instrumentsans/InstrumentSans%5Bwdth,wght%5D.ttf

Both are licensed under SIL Open Font License 1.1. Their original license notices are included beside the font files. Font binaries are unmodified; the application registers private aliases only to avoid colliding with Next.js font family names.

## App typography

The app shell uses these licensed local fonts through `next/font/local` so CI and production builds do not depend on Google Fonts CSS/URL formats. Family names, weights, styles and CSS variables are preserved. Full TTF coverage avoids losing non-Latin glyphs by copying just the Latin web subset.

Additional upstream sources (Google Fonts, downloaded 2026-11-07):
- CormorantGaramond-Italic.ttf: https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/CormorantGaramond-Italic%5Bwght%5D.ttf
- IBMPlexMono-Regular.ttf: https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf
- IBMPlexMono-Medium.ttf: https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-Medium.ttf
- IBMPlexMono-OFL.txt: https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/OFL.txt
