import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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

        // Add vendor demo user
        if (credentials.email === 'vendor@example.com' && credentials.password === 'vendor123') {
          return {
            id: 'vendor-user-id',
            email: 'vendor@example.com',
            name: 'Vendor User',
            role: 'vendor'
          };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST }; 