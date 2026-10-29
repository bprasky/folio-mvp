# Signup email verification

Password signup creates a pending record and sends a six-digit code through the existing Resend integration. A matching code atomically consumes that record and creates the personal account. NextAuth then issues its normal session. No existing account is gated or given an inferred verification status. Google and Apple must supply a matching, verified email claim before account creation or linking.

The pending signup uses a random HTTP-only browser secret and a keyed code hash. Codes expire in ten minutes; the signup session lasts one hour. There are five guesses per pending signup, a one-minute resend cooldown, five sends per signup/email per hour, and separate IP limits. Resends replace the previous code without resetting guesses. Expired pending credentials are removed during subsequent signup activity. The selected business/workspace destination survives refresh and verification.

## Validation

- `check-signup-verification.cjs`: actual service, routes and auth provider; PGlite runs the additive SQL twice and tests transaction rollback, concurrent consumption, replay and resend races. Covers browser binding, limits, expiry, missing configuration, email failure, recovery, consent and input validation. NextAuth's actual handler rejects missing CSRF and produces a signed session after verification. A small adapter translates the tested Prisma calls to SQL; this is not a claim of production Prisma or provider delivery testing.
- Core journey suite, OAuth identity tests, business entry/routing/aliases and background import regressions pass.
- Next production compilation, targeted lint, client import boundaries and migration discipline pass. The TypeScript diagnostic ratchet passes without changing its baseline or equivalences.
- The installation guard pins the new model artifact and migration hash alongside the historical schema. Mutation checks reject altered signup fields/defaults, SQL and review artifacts while preserving all earlier protections.
- Browser walkthrough mounts the real components with synthetic APIs. Tested signup, incorrect code, resend, page refresh, successful continuation to business setup, expired code, delivery failure and exhausted attempts. Checked desktop and mobile layout. The fixture uses `123456` and a shortened resend timer; no real account or email is created.

## Release

Apply `20261029193000_signup_email_verification` before deploying the application. It adds only `signup_email_challenges`; existing user records are unchanged. Keep the existing production `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` and distributed rate-limit configuration. A real delivered-email signup remains a release smoke test; local capture and provider acceptance do not establish inbox delivery.

The full build exposed a legacy client import of the server vendor dashboard. Its analytics tab now links to the existing dashboard route so server authentication code stays out of the client bundle.
