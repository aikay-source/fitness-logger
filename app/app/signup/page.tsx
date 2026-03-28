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
