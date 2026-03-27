"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Check, ChevronRight, Users } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { saveReminderSettings } from "@/app/actions/settings";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [saving, setSaving] = useState(false);
  const { state: pushState, loading: pushLoading, subscribe } = usePushNotifications();

  async function handleReminderNext() {
    setSaving(true);
    try {
      await saveReminderSettings(reminderTime, true);
      setStep(2);
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableNotifications() {
    const ok = await subscribe();
    if (ok) {
      toast.success("Notifications enabled!");
      setStep(3);
    } else {
      toast.error("Permission denied — you can enable this later in Settings.");
    }
  }

  function handleSkipStep1() {
    saveReminderSettings(null, false).catch(() => null);
    setStep(2);
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:border-[var(--app-tertiary)] focus:outline-none transition-colors";

  return (
    <main id="main-content" className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Progress dots */}
        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-label={`Onboarding step ${step} of 3`}
          className="flex justify-center gap-2"
        >
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              aria-hidden="true"
              className={`h-1.5 w-6 rounded-full transition-colors ${
                s <= step ? "bg-[var(--app-text)]" : "bg-[var(--app-border)]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Reminder time */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--app-surface)]">
                <Clock size={18} className="text-[var(--app-tertiary)]" />
              </div>
              <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                When do you finish training?
              </h1>
              <p className="text-sm text-[var(--app-tertiary)]">
                We&apos;ll remind you to log sessions at this time each day.
              </p>
            </div>

            <div>
              <label htmlFor="reminder-time" className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]">
                Daily reminder time
              </label>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleReminderNext}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Next"}
                {!saving && <ChevronRight size={14} />}
              </button>
              <button
                onClick={handleSkipStep1}
                className="w-full text-center text-sm text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Push permission */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--app-surface)]">
                <Bell size={18} className="text-[var(--app-tertiary)]" />
              </div>
              <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                Stay on top of your clients
              </h1>
              <p className="text-sm text-[var(--app-tertiary)]">
                Get a nudge at {reminderTime} and an alert when a client&apos;s
                package is nearly up.
              </p>
            </div>

            {pushState === "granted" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <Check size={14} className="text-emerald-400" />
                <p className="text-sm text-emerald-300">
                  Notifications are already enabled.
                </p>
              </div>
            )}

            {pushState === "unsupported" && (
              <p className="text-sm text-[var(--app-tertiary)]">
                Push notifications aren&apos;t supported in this browser. Install
                the app on your home screen for the best experience.
              </p>
            )}

            <div className="space-y-3">
              {pushState !== "granted" && pushState !== "unsupported" && (
                <button
                  onClick={handleEnableNotifications}
                  disabled={pushLoading || pushState === "denied"}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  <Bell size={14} />
                  {pushLoading
                    ? "Requesting…"
                    : pushState === "denied"
                    ? "Permission denied in browser"
                    : "Enable notifications"}
                </button>
              )}

              {pushState === "granted" && (
                <button
                  onClick={() => setStep(3)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 transition-colors"
                >
                  <ChevronRight size={14} />
                  Next
                </button>
              )}

              <button
                onClick={() => setStep(3)}
                className="w-full text-center text-sm text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Add clients */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--app-surface)]">
                <Users size={18} className="text-[var(--app-tertiary)]" />
              </div>
              <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)]">
                Add your clients
              </h1>
              <p className="text-sm text-[var(--app-tertiary)] text-pretty">
                Add them one by one, or import a spreadsheet if you have an existing roster.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push("/clients")}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-text)] py-2.5 text-sm font-semibold text-[var(--app-text-inv)] hover:opacity-90 transition-colors"
              >
                <Users size={14} />
                Add clients
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full text-center text-sm text-[var(--app-muted)] hover:text-[var(--app-tertiary)] transition-colors"
              >
                I&apos;ll do this later
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
