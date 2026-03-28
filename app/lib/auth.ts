import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginLimiter, checkRateLimit } from "@/lib/rate-limit";

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

        const email = credentials.email.toLowerCase();

        // Rate limit by email — 10 attempts per 15 minutes
        const { limited } = await checkRateLimit(loginLimiter, `login:${email}`);
        if (limited) throw new Error("RATE_LIMITED");

        try {
          const user = await prisma.user.findUnique({ where: { email } });

          if (!user) return null;

          // User signed up via Google — no password set, guide them to OAuth
          if (!user.password) throw new Error("GOOGLE_ACCOUNT");

          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name };
        } catch (error) {
          // Re-throw known errors so they reach the client
          if (error instanceof Error &&
              (error.message === "GOOGLE_ACCOUNT" || error.message === "RATE_LIMITED")) {
            throw error;
          }
          console.error("[authorize] database error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // 24-hour sessions — limits stolen-cookie window while rolling sessions
    // keep active users logged in without re-authenticating every day.
    maxAge: 24 * 60 * 60,
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
        // `account` and `profile` are only populated on the initial sign-in
        // event, not on token refreshes, so this DB call only runs once.
        try {
          const email = profile.email.toLowerCase();
          let dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                email,
                name: (profile as { name?: string }).name ?? email.split("@")[0],
              },
            });
          }
          token.id = dbUser.id;
        } catch (error) {
          console.error("[jwt] Google sign-in db error:", error);
          // Return token without id — session callback will produce no user.id,
          // and the app's auth guard will redirect to login.
        }
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
