import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

        // For development, create a default admin user
        // In production, you'd verify against your database
        if (credentials.email === 'admin@example.com' && credentials.password === 'admin123') {
          return {
            id: 'admin-user-id',
            email: 'admin@example.com',
            name: 'Admin User',
            role: 'admin'
          };
        }

        // Check database for user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (user) {
          // In production, you'd hash and verify the password
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.profileType // Assuming profileType contains the role
          };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
}; 