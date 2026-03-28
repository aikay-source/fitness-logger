import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SALT_ROUNDS } from "@/lib/auth";
import { registerLimiter, checkRateLimit } from "@/lib/rate-limit";
import { PrismaClientKnownRequestError } from "@prisma/client";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Rate limit by IP — 5 registrations per hour
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { limited, retryAfter } = await checkRateLimit(registerLimiter, `register:${ip}`);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { email: rawEmail, password } = await request.json();

  if (!rawEmail || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // bcrypt silently truncates at 72 bytes — enforce the limit explicitly
  if (password.length > 72) {
    return NextResponse.json({ error: "Password must be 72 characters or fewer." }, { status: 400 });
  }

  const email = rawEmail.toLowerCase();

  // Pre-check to avoid bcrypt cost on duplicate emails, but catch the race
  // condition where two requests slip past this check simultaneously.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        password: hashedPassword,
      },
    });
  } catch (error) {
    // Handle race condition: another request created the same email between
    // our findUnique check and this create call.
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
