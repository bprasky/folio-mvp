import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

declare module 'next-auth' {
  interface User {
    role?: string;
    accountStatus?: string;
    onboardingCompletedAt?: Date | null;
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
    impersonating?: {
      originalAdminId: string;
      originalAdminEmail: string;
    };
  }
}

// Debug environment variables
console.log('DEBUG: NextAuth Environment Check');
console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
console.log('NEXTAUTH_SECRET length:', process.env.NEXTAUTH_SECRET?.length || 0);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('Current working directory:', process.cwd());
console.log('Environment variables loaded:', Object.keys(process.env).filter(key => key.includes('NEXTAUTH')));

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
            console.error('User not found:', credentials.email);
            return null;
          }

          if (!user.passwordHash) {
            console.error('User found but no passwordHash:', credentials.email);
            return null;
          }

          console.log('DEBUG authorize - Prisma user found:', {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
          });

          // Compare password against passwordHash
          const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
          
          if (isValidPassword) {
            console.log('DEBUG authorize - User authenticated:', {
              id: user.id,
              email: user.email,
              role: user.role
            });
            // RETURN ID! - This is critical for session.user.id
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role || 'GUEST'
            };
          }

          console.log('Invalid password for user:', credentials.email);
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
      console.log("DEBUG: Entering JWT callback");

      // Persist id on initial sign-in
      if (user?.id) {
        token.id = user.id;
        console.log("DEBUG: JWT callback - Setting token.id:", user.id);
      }

      // Always hydrate role, accountStatus, and onboardingCompletedAt from DB to avoid stale tokens
      if (token.sub) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { role: true, accountStatus: true, onboardingCompletedAt: true },
          });
          token.role = u?.role ?? "GUEST";
          token.accountStatus = u?.accountStatus ?? "APPROVED";
          token.onboardingCompletedAt = u?.onboardingCompletedAt ?? null;
          console.log("Hydrated from DB - role:", token.role, "accountStatus:", token.accountStatus);
        } catch (e) {
          // On DB hiccup, keep previous token values rather than blowing up auth
          console.error("Error hydrating from DB:", e);
          token.role = (token as any).role ?? "GUEST";
          token.accountStatus = (token as any).accountStatus ?? "APPROVED";
          token.onboardingCompletedAt = (token as any).onboardingCompletedAt ?? null;
        }
      } else {
        token.role = (token as any).role ?? "GUEST";
        token.accountStatus = (token as any).accountStatus ?? "APPROVED";
        token.onboardingCompletedAt = (token as any).onboardingCompletedAt ?? null;
      }

      return token;
    },

    async session({ session, token }) {
      console.log("DEBUG: Session callback — token.role:", token.role, "token.id:", token.id, "token.accountStatus:", token.accountStatus);
      session.user = session.user || ({} as any);
      if (token?.id && session?.user) {
        (session.user as any).id = token.id as string;
        console.log("DEBUG: Session callback - Setting session.user.id:", token.id);
      }
      (session.user as any).role = (token as any).role || 'GUEST';
      (session.user as any).accountStatus = (token as any).accountStatus || 'APPROVED';
      (session.user as any).onboardingCompletedAt = (token as any).onboardingCompletedAt || null;

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
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
  // Add NEXTAUTH_URL for production
  ...(process.env.NEXTAUTH_URL && { url: process.env.NEXTAUTH_URL }),
}; 