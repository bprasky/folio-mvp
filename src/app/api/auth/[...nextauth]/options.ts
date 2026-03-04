import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, RateLimitPresets } from '@/lib/rateLimit';

declare module 'next-auth' {
  interface User {
    role?: string;
    accountStatus?: string;
    onboardingCompletedAt?: Date | null;
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
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Per-email rate limiting (prevents credential stuffing on specific accounts)
        // This complements the IP-level rate limiting in middleware
        const emailRateLimit = checkRateLimit(credentials.email.toLowerCase().trim(), {
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
    async jwt({ token, user, trigger }) {
      if (process.env.NODE_ENV !== 'production') {
        console.log("DEBUG: Entering JWT callback");
      }

      // Persist id on initial sign-in
      if (user?.id) {
        token.id = user.id;
        if (process.env.NODE_ENV !== 'production') {
          console.log("DEBUG: JWT callback - Setting token.id:", user.id);
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
              subscriptionTier: true,
              subscriptionExpiresAt: true,
            },
          });
          token.role = u?.role ?? "GUEST";
          token.accountStatus = u?.accountStatus ?? "APPROVED";
          token.onboardingCompletedAt = u?.onboardingCompletedAt ?? null;
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
      // Always redirect to homepage after login
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
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret-key-not-for-production' : undefined),
  // Add NEXTAUTH_URL for production
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
}; 