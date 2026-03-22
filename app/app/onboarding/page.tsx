"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Check, ChevronRight } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { saveReminderSettings } from "@/app/actions/settings";
import { toast } from "sonner";

type Step = 1 | 2;

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
      router.push("/dashboard");
    } else {
      toast.error("Permission denied — you can enable this later in Settings.");
    }
  }

  function handleSkip() {
    saveReminderSettings(null, false).catch(() => null);
    router.push("/dashboard");
  }

  const inputClass =
    "w-full rounded-lg border border-[#3d3d3c] bg-[#1e1e1d] px-3 py-2.5 text-sm text-[#f2f1ed] focus:border-[#a3a29f] focus:outline-none transition-colors";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {([1, 2] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                s <= step ? "bg-[#f2f1ed]" : "bg-[#3d3d3c]"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Reminder time */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#1e1e1d]">
                <Clock size={18} className="text-[#a3a29f]" />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#f2f1ed]">
                When do you finish training?
              </h1>
              <p className="text-sm text-[#a3a29f]">
                We&apos;ll remind you to log sessions at this time each day.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]">
                Daily reminder time
              </label>
              <input
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Next"}
                {!saving && <ChevronRight size={14} />}
              </button>
              <button
                onClick={handleSkip}
                className="w-full text-center text-sm text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
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
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#1e1e1d]">
                <Bell size={18} className="text-[#a3a29f]" />
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#f2f1ed]">
                Stay on top of your clients
              </h1>
              <p className="text-sm text-[#a3a29f]">
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
              <p className="text-sm text-[#a3a29f]">
                Push notifications aren&apos;t supported in this browser. Install
                the app on your home screen for the best experience.
              </p>
            )}

            <div className="space-y-3">
              {pushState !== "granted" && pushState !== "unsupported" && (
                <button
                  onClick={handleEnableNotifications}
                  disabled={pushLoading || pushState === "denied"}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
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
                  onClick={() => router.push("/dashboard")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f2f1ed] py-2.5 text-sm font-semibold text-[#141413] hover:bg-white transition-colors"
                >
                  <Check size={14} />
                  Go to dashboard
                </button>
              )}

              <button
                onClick={() => router.push("/dashboard")}
                className="w-full text-center text-sm text-[#5e5e5c] hover:text-[#a3a29f] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
