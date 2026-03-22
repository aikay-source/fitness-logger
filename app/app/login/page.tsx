"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      toast.error("Could not sign in. Please try again.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / wordmark */}
        <div className="space-y-1">
          <h1 className="font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
            FitLog
          </h1>
          <p className="text-2xl font-semibold tracking-tight text-[#f2f1ed]">
            Welcome back
          </p>
          <p className="text-sm text-[#a3a29f]">Sign in to your coach account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[#a3a29f]">
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
              className="border-[#3d3d3c] bg-[#1e1e1d] text-[#f2f1ed] placeholder:text-[#5e5e5c] focus-visible:ring-[#a3a29f]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[#a3a29f]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border-[#3d3d3c] bg-[#1e1e1d] text-[#f2f1ed] placeholder:text-[#5e5e5c] focus-visible:ring-[#a3a29f]"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f2f1ed] font-semibold text-[#141413] hover:bg-white"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-[#5e5e5c]">
          First time? Enter any email and password to create your account.
        </p>
      </div>
    </div>
  );
}
