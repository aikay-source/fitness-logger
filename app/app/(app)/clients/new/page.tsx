"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    totalSessionsPurchased: "",
    sessionsRemaining: "",
    unpaidSessions: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Keep sessionsRemaining in sync with totalSessionsPurchased if user
      // hasn't touched sessionsRemaining yet
      if (name === "totalSessionsPurchased" && prev.sessionsRemaining === prev.totalSessionsPurchased) {
        next.sessionsRemaining = value;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          totalSessionsPurchased: Number(form.totalSessionsPurchased),
          sessionsRemaining: Number(form.sessionsRemaining),
          unpaidSessions: Number(form.sessionsRemaining) === 0 ? Number(form.unpaidSessions) || 0 : 0,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const client = await res.json();
      toast.success(`${client.name} added!`);
      router.push("/clients");
    } catch {
      toast.error("Failed to add client. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-2.5 text-sm text-[#f2f1ed] placeholder:text-[#5e5e5c] focus:border-[#a3a29f] focus:outline-none transition-colors";
  const labelClass = "block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f] mb-1.5";

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/clients"
          className="mb-4 inline-flex items-center gap-1 font-mono text-xs text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
        >
          <ChevronLeft size={13} />
          Clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f2f1ed]">
          New client
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className={labelClass}>
            Full name *
          </label>
          <input
            id="name"
            name="name"
            required
            value={form.name}
            onChange={handleChange}
            placeholder="Alex Johnson"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone <span className="normal-case text-[#5e5e5c]">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="+1 555 000 0000"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="totalSessionsPurchased" className={labelClass}>
              Sessions bought
            </label>
            <input
              id="totalSessionsPurchased"
              name="totalSessionsPurchased"
              type="number"
              min="0"
              required
              value={form.totalSessionsPurchased}
              onChange={handleChange}
              placeholder="10"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sessionsRemaining" className={labelClass}>
              Sessions left
            </label>
            <input
              id="sessionsRemaining"
              name="sessionsRemaining"
              type="number"
              min="0"
              required
              value={form.sessionsRemaining}
              onChange={handleChange}
              placeholder="10"
              className={inputClass}
            />
          </div>
        </div>

        {/* Unpaid sessions — only relevant when sessions remaining is 0 */}
        {Number(form.sessionsRemaining) === 0 && form.sessionsRemaining !== "" && (
          <div>
            <label htmlFor="unpaidSessions" className={labelClass}>
              Unpaid sessions{" "}
              <span className="normal-case text-[#5e5e5c]">(optional)</span>
            </label>
            <input
              id="unpaidSessions"
              name="unpaidSessions"
              type="number"
              min="0"
              value={form.unpaidSessions}
              onChange={handleChange}
              placeholder="0"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-[#5e5e5c]">
              Sessions trained that haven&apos;t been paid for yet.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
        >
          {loading ? "Adding…" : "Add client"}
        </button>
      </form>
    </div>
  );
}
