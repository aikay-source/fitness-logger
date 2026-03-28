import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SALT_ROUNDS = 12;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.password) return null;

          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name };
        } catch (error) {
          console.error("[authorize] database error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        // Google sign-in — find or create user in DB using the email from the
        // OAuth profile. Must run before the generic `user` check because
        // NextAuth also populates `user` on OAuth sign-ins (with the Google
        // sub ID, not the DB ID), so we'd store the wrong ID without this
        // early-return branch.
        let dbUser = await prisma.user.findUnique({ where: { email: profile.email } });
        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: profile.email,
              name: (profile as { name?: string }).name ?? profile.email.split("@")[0],
            },
          });
        }
        token.id = dbUser.id;
      } else if (user) {
        // Credentials login — id is the DB user id returned by `authorize`
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
