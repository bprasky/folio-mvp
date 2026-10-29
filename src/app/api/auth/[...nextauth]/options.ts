import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import bcrypt from 'bcryptjs';
import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp, RateLimitPresets } from '@/lib/rateLimit';
import { signupCookieFromHeader, verifySignup, SignupVerificationError } from '@/lib/auth/signup-verification';

declare module 'next-auth' {
  interface User {
    role?: string;
    accountStatus?: string;
    onboardingCompletedAt?: Date | null;
    onboardingDiagnosticAt?: Date | null;
    onboardingFirmContextAt?: Date | null;
    onboardingBioCaptureAt?: Date | null;
    onboardingProfilePreviewAt?: Date | null;
    operatingAsOrgId?: string | null;
    operatingAsOrg?: {
      id: string;
      name: string;
      logo: string | null;
      status: 'UNCLAIMED' | 'CLAIMED' | 'PROFESSIONAL';
    } | null;
    subscriptionTier?: string;
    subscriptionExpiresAt?: Date | null;
    isFoundingDesigner?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      accountStatus: string;
      onboardingCompletedAt: Date | null;
      onboardingDiagnosticAt: Date | null;
      onboardingFirmContextAt: Date | null;
      onboardingBioCaptureAt: Date | null;
      onboardingProfilePreviewAt: Date | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      operatingAsOrgId?: string | null;
      operatingAsOrg?: {
        id: string;
        name: string;
        logo: string | null;
        status: 'UNCLAIMED' | 'CLAIMED' | 'PROFESSIONAL';
      } | null;
      subscriptionTier?: string;
      subscriptionExpiresAt?: Date | null;
      isFoundingDesigner?: boolean;
    };
    impersonating?: {
      originalAdminId: string;
      originalAdminEmail: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    accountStatus?: string;
    onboardingCompletedAt?: Date | null;
    onboardingDiagnosticAt?: Date | null;
    onboardingFirmContextAt?: Date | null;
    onboardingBioCaptureAt?: Date | null;
    onboardingProfilePreviewAt?: Date | null;
    operatingAsOrgId?: string | null;
    operatingAsOrg?: {
      id: string;
      name: string;
      logo: string | null;
      status: 'UNCLAIMED' | 'CLAIMED' | 'PROFESSIONAL';
    } | null;
    impersonating?: {
      originalAdminId: string;
      originalAdminEmail: string;
    };
    subscriptionTier?: string;
    subscriptionExpiresAt?: Date | null;
    isFoundingDesigner?: boolean;
  }
}

// Debug environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('DEBUG: NextAuth Environment Check');
  console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
  console.log('NEXTAUTH_SECRET length:', process.env.NEXTAUTH_SECRET?.length || 0);
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
  console.log('Current working directory:', process.cwd());
  console.log('Environment variables loaded:', Object.keys(process.env).filter(key => key.includes('NEXTAUTH')));
}

export const authOptions: NextAuthOptions = {
  providers: [
    // OAuth providers are registered only when their credentials are set so that
    // local/preview environments without OAuth env vars still boot cleanly.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'email-verification',
      name: 'Verify signup email',
      credentials: { code: { label: 'Verification code', type: 'text' } },
      async authorize(credentials, request) {
        const limit = await checkRateLimit(getClientIp(new Headers(request.headers as Record<string, string>)), {
          ...RateLimitPresets.LOGIN_PER_IP, keyGenerator: ip => `signup-verify-ip:${ip}`,
        });
        if (!limit.success) throw new Error('RATE_LIMIT');
        try {
          return await verifySignup(signupCookieFromHeader(request.headers?.cookie), credentials?.code || '');
        } catch (error) {
          throw new Error(error instanceof SignupVerificationError ? error.code : 'UNAVAILABLE');
        }
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const ipRateLimit = await checkRateLimit(getClientIp(new Headers(request.headers as Record<string, string>)), {
          ...RateLimitPresets.LOGIN_PER_IP,
          keyGenerator: (ip) => `login-ip:${ip}`,
        });
        if (!ipRateLimit.success) return null;

        // Per-email rate limiting (prevents credential stuffing on specific accounts)
        // Both dimensions run here because page middleware excludes APIs.
        const emailRateLimit = await checkRateLimit(credentials.email.toLowerCase().trim(), {
          ...RateLimitPresets.LOGIN_PER_EMAIL,
          keyGenerator: (email) => `login-email:${email}`,
        });

        if (!emailRateLimit.success) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Rate limit exceeded for email: ${credentials.email}`);
          }
          // Return null to fail authentication, but don't reveal rate limiting to prevent email enumeration
          return null;
        }

        try {
          // Check database for user with case-insensitive email lookup
          const user = await prisma.user.findFirst({
            where: { 
              email: { 
                equals: credentials.email.trim().toLowerCase(),
                mode: 'insensitive'
              }
            },
            select: { 
              id: true, 
              email: true, 
              role: true, 
              passwordHash: true,
              name: true
            }
          });

          if (!user) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('User not found:', credentials.email);
            }
            return null;
          }

          if (!user.passwordHash) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('User found but no passwordHash:', credentials.email);
            }
            return null;
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('DEBUG authorize - Prisma user found:', {
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name
            });
          }

          // Compare password against passwordHash
          const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);

          if (isValidPassword) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('DEBUG authorize - User authenticated:', {
                id: user.id,
                email: user.email,
                role: user.role
              });
            }
            // RETURN ID! - This is critical for session.user.id
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role || 'GUEST'
            };
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('Invalid password for user:', credentials.email);
          }
          return null;
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider === 'credentials' || account.provider === 'email-verification') {
        return true;
      }
      // OAuth (Google / Apple): we don't use the NextAuth Prisma adapter, so
      // materialize the User row ourselves so the rest of the app's
      // prisma.user-driven machinery (role, accountStatus, onboarding flags)
      // works on first OAuth sign-in.
      if (!user?.email) return false;
      const email = user.email.toLowerCase().trim();
      const claims = profile as { email?: string; email_verified?: boolean | string } | undefined;
      const verified = claims?.email_verified === true || (account.provider === 'apple' && claims?.email_verified === 'true');
      if (!['google', 'apple'].includes(account.provider) || !verified || claims?.email?.trim().toLowerCase() !== email) return false;
      const now = new Date();
      try {
        await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: user.name ?? '',
            // OAuth users sign in via the provider, never via credentials.
            // Empty hash is treated as "no password" by the credentials authorize().
            passwordHash: '',
            role: 'INDIVIDUAL',
            accountStatus: AccountStatus.APPROVED,
            tosAcceptedAt: now,
            privacyAcceptedAt: now,
            tosVersion: '2026-01-19',
            privacyVersion: '2026-01-19',
          },
          update: {},
        });
        return true;
      } catch (err) {
        console.error('OAuth signIn upsert failed:', err);
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("DEBUG: Entering JWT callback");
      }

      // Credentials already carry the Folio ID. OAuth user.id belongs to the
      // external provider and must never overwrite the resolved Folio ID.
      if (user?.id && (account?.provider === 'credentials' || account?.provider === 'email-verification')) {
        token.id = user.id;
        token.sub = user.id;
      }

      // For OAuth first sign-in, resolve the Folio user id by email so the
      // hydration block below (which queries by token.sub) finds the right row.
      if (
        (account?.provider === 'google' || account?.provider === 'apple') &&
        user?.email
      ) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase().trim() },
            select: { id: true },
          });
          if (!dbUser) throw new Error('OAuth user has no Folio account');
          token.id = dbUser.id;
          token.sub = dbUser.id;
        } catch (e) {
          console.error('Error resolving OAuth user to Folio id:', e);
          throw e;
        }
      }

      // Always hydrate role, accountStatus, onboardingCompletedAt, subscriptionTier from DB to avoid stale tokens
      // Note: Query only core columns that exist in prod, workspace context is optional
      if (token.sub) {
        try {
          // Core query - these columns definitely exist
          const u = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: {
              role: true,
              accountStatus: true,
              onboardingCompletedAt: true,
              onboardingDiagnosticAt: true,
              onboardingFirmContextAt: true,
              onboardingBioCaptureAt: true,
              onboardingProfilePreviewAt: true,
              subscriptionTier: true,
              subscriptionExpiresAt: true,
            },
          });
          token.role = u?.role ?? "GUEST";
          token.accountStatus = u?.accountStatus ?? "APPROVED";
          token.onboardingCompletedAt = u?.onboardingCompletedAt ?? null;
          token.onboardingDiagnosticAt = u?.onboardingDiagnosticAt ?? null;
          token.onboardingFirmContextAt = u?.onboardingFirmContextAt ?? null;
          token.onboardingBioCaptureAt = u?.onboardingBioCaptureAt ?? null;
          token.onboardingProfilePreviewAt = u?.onboardingProfilePreviewAt ?? null;
          token.subscriptionTier = u?.subscriptionTier ?? "FREE";
          token.subscriptionExpiresAt = u?.subscriptionExpiresAt ?? null;
          // Founding designers have Pro tier with null expiry (lifetime)
          const isPaidTier = u?.subscriptionTier === 'PRO' || u?.subscriptionTier === 'STUDIO' || u?.subscriptionTier === 'ENTERPRISE';
          token.isFoundingDesigner = isPaidTier && u?.subscriptionExpiresAt === null;
          if (process.env.NODE_ENV !== 'production') {
            console.log("Hydrated from DB - role:", token.role, "accountStatus:", token.accountStatus, "subscriptionTier:", token.subscriptionTier, "isFoundingDesigner:", token.isFoundingDesigner);
          }

          // Try to get workspace context (operatingAsOrgId may not exist in prod yet)
          try {
            const workspace = await prisma.$queryRaw<any[]>`
              SELECT "operatingAsOrgId" FROM users WHERE id = ${token.sub}
            `;
            if (workspace?.[0]?.operatingAsOrgId) {
              token.operatingAsOrgId = workspace[0].operatingAsOrgId;
              // Get org details including status
              const org = await prisma.organization.findUnique({
                where: { id: workspace[0].operatingAsOrgId },
                select: { id: true, name: true, status: true },
              });
              token.operatingAsOrg = org ? { ...org, logo: null, status: org.status as 'UNCLAIMED' | 'CLAIMED' | 'PROFESSIONAL' } : null;
            } else {
              token.operatingAsOrgId = null;
              token.operatingAsOrg = null;
            }
          } catch (workspaceErr) {
            // operatingAsOrgId column doesn't exist yet, that's fine
            token.operatingAsOrgId = null;
            token.operatingAsOrg = null;
          }
        } catch (e) {
          // On DB hiccup, keep previous token values rather than blowing up auth
          console.error("Error hydrating from DB:", e);
          token.role = (token as any).role ?? "GUEST";
          token.accountStatus = (token as any).accountStatus ?? "APPROVED";
          token.onboardingCompletedAt = (token as any).onboardingCompletedAt ?? null;
          token.onboardingDiagnosticAt = (token as any).onboardingDiagnosticAt ?? null;
          token.onboardingFirmContextAt = (token as any).onboardingFirmContextAt ?? null;
          token.onboardingBioCaptureAt = (token as any).onboardingBioCaptureAt ?? null;
          token.onboardingProfilePreviewAt = (token as any).onboardingProfilePreviewAt ?? null;
          token.operatingAsOrgId = (token as any).operatingAsOrgId ?? null;
          token.operatingAsOrg = (token as any).operatingAsOrg ?? null;
          token.subscriptionTier = (token as any).subscriptionTier ?? "FREE";
          token.subscriptionExpiresAt = (token as any).subscriptionExpiresAt ?? null;
          token.isFoundingDesigner = (token as any).isFoundingDesigner ?? false;
        }
      } else {
        token.role = (token as any).role ?? "GUEST";
        token.accountStatus = (token as any).accountStatus ?? "APPROVED";
        token.onboardingCompletedAt = (token as any).onboardingCompletedAt ?? null;
        token.onboardingDiagnosticAt = (token as any).onboardingDiagnosticAt ?? null;
        token.onboardingFirmContextAt = (token as any).onboardingFirmContextAt ?? null;
        token.onboardingBioCaptureAt = (token as any).onboardingBioCaptureAt ?? null;
        token.onboardingProfilePreviewAt = (token as any).onboardingProfilePreviewAt ?? null;
        token.operatingAsOrgId = (token as any).operatingAsOrgId ?? null;
        token.operatingAsOrg = (token as any).operatingAsOrg ?? null;
        token.subscriptionTier = (token as any).subscriptionTier ?? "FREE";
        token.subscriptionExpiresAt = (token as any).subscriptionExpiresAt ?? null;
        token.isFoundingDesigner = (token as any).isFoundingDesigner ?? false;
      }

      return token;
    },

    async session({ session, token }) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("DEBUG: Session callback — token.role:", token.role, "token.id:", token.id, "token.accountStatus:", token.accountStatus, "operatingAsOrgId:", token.operatingAsOrgId, "subscriptionTier:", token.subscriptionTier, "isFoundingDesigner:", token.isFoundingDesigner);
      }
      session.user = session.user || ({} as any);
      if (token?.id && session?.user) {
        (session.user as any).id = token.id as string;
        if (process.env.NODE_ENV !== 'production') {
          console.log("DEBUG: Session callback - Setting session.user.id:", token.id);
        }
      }
      (session.user as any).role = (token as any).role || 'GUEST';
      (session.user as any).accountStatus = (token as any).accountStatus || 'APPROVED';
      (session.user as any).onboardingCompletedAt = (token as any).onboardingCompletedAt || null;
      (session.user as any).onboardingDiagnosticAt = (token as any).onboardingDiagnosticAt || null;
      (session.user as any).onboardingFirmContextAt = (token as any).onboardingFirmContextAt || null;
      (session.user as any).onboardingBioCaptureAt = (token as any).onboardingBioCaptureAt || null;
      (session.user as any).onboardingProfilePreviewAt = (token as any).onboardingProfilePreviewAt || null;
      (session.user as any).operatingAsOrgId = (token as any).operatingAsOrgId || null;
      (session.user as any).operatingAsOrg = (token as any).operatingAsOrg || null;
      (session.user as any).subscriptionTier = (token as any).subscriptionTier || 'FREE';
      (session.user as any).subscriptionExpiresAt = (token as any).subscriptionExpiresAt || null;
      (session.user as any).isFoundingDesigner = (token as any).isFoundingDesigner || false;

      // Include impersonation info if present
      if ((token as any).impersonating) {
        (session as any).impersonating = (token as any).impersonating;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Honor relative same-origin callbackUrls (e.g. OAuth signIn passing
      // '/onboarding/diagnostic'); reject anything off-origin.
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // fall through
      }
      return `${baseUrl}/`;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? "__Secure-next-auth.session-token" 
        : "next-auth.session-token",
      options: { 
        httpOnly: true, 
        sameSite: "lax", 
        path: "/", 
        secure: process.env.NODE_ENV === "production" 
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Add NEXTAUTH_URL for production
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
};
