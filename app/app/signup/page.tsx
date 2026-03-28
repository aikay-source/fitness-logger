"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Could not create account. Please try again.");
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      toast.error("Account created but sign-in failed. Please go to the login page.");
    } else {
      window.location.href = "/onboarding";
    }
  }

  return (
    <main id="main-content" className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
            FitLog
          </h1>
          <p className="text-2xl font-semibold tracking-tight text-[var(--app-text)]">
            Create your account
          </p>
          <p className="text-sm text-[var(--app-tertiary)]">Start tracking your coaching sessions</p>
        </div>

        <Button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
          variant="outline"
          className="w-full border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--app-border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--app-bg)] px-2 text-[var(--app-muted)]">or</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[var(--app-tertiary)]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
              className="border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus-visible:ring-[var(--app-tertiary)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[var(--app-tertiary)]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus-visible:ring-[var(--app-tertiary)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-[var(--app-tertiary)]">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus-visible:ring-[var(--app-tertiary)]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full bg-[var(--app-text)] font-semibold text-[var(--app-text-inv)] hover:opacity-90"
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-xs text-[var(--app-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
