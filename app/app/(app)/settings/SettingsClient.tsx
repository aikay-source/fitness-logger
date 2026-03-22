"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Bell, BellOff, Clock, LogOut, User } from "lucide-react";
import { saveReminderSettings } from "@/app/actions/settings";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type Props = {
  name: string;
  email: string;
  reminderTime: string;
  reminderEnabled: boolean;
  hasPushSubscription: boolean;
};

export default function SettingsClient({
  name,
  email,
  reminderTime: initialReminderTime,
  reminderEnabled: initialReminderEnabled,
  hasPushSubscription,
}: Props) {
  const [reminderTime, setReminderTime] = useState(initialReminderTime);
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderEnabled);
  const [savingReminder, setSavingReminder] = useState(false);

  const { state: pushState, loading: pushLoading, subscribe, unsubscribe } =
    usePushNotifications();

  const isPushActive =
    hasPushSubscription && (pushState === "granted" || pushState === "default");

  async function handleSaveReminder() {
    setSavingReminder(true);
    try {
      await saveReminderSettings(
        reminderEnabled ? reminderTime : null,
        reminderEnabled
      );
      toast.success("Reminder saved.");
    } catch {
      toast.error("Failed to save reminder.");
    } finally {
      setSavingReminder(false);
    }
  }

  async function handlePushToggle() {
    if (isPushActive) {
      await unsubscribe();
      toast.success("Notifications turned off.");
    } else {
      const ok = await subscribe();
      if (ok) toast.success("Notifications enabled!");
      else toast.error("Could not enable notifications.");
    }
  }

  const sectionClass = "rounded-xl border border-[#3d3d3c] bg-[#1e1e1d] divide-y divide-[#3d3d3c]";
  const rowClass = "flex items-center justify-between px-4 py-3.5";
  const labelClass = "font-mono text-xs font-semibold uppercase tracking-widest text-[#a3a29f]";
  const inputClass =
    "rounded-lg border border-[#3d3d3c] bg-[#141413] px-3 py-1.5 text-sm text-[#f2f1ed] focus:border-[#a3a29f] focus:outline-none transition-colors";

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 space-y-8">
      <div>
        <p className={labelClass}>Preferences</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#f2f1ed]">
          Settings
        </h1>
      </div>

      {/* Account */}
      <section className="space-y-2">
        <p className={labelClass}>Account</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <User size={14} className="text-[#5e5e5c]" />
              <div>
                <p className="text-sm text-[#f2f1ed]">{name || "Coach"}</p>
                <p className="font-mono text-xs text-[#5e5e5c]">{email}</p>
              </div>
            </div>
          </div>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <LogOut size={14} className="text-[#5e5e5c]" />
              <p className="text-sm text-[#f2f1ed]">Sign out</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-[#3d3d3c] px-3 py-1 font-mono text-xs text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      {/* Reminders */}
      <section className="space-y-2">
        <p className={labelClass}>Daily reminder</p>
        <div className={sectionClass}>
          {/* Toggle enabled */}
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Clock size={14} className="text-[#5e5e5c]" />
              <p className="text-sm text-[#f2f1ed]">Daily reminder</p>
            </div>
            <button
              onClick={() => setReminderEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                reminderEnabled ? "bg-[#f2f1ed]" : "bg-[#3d3d3c]"
              }`}
            >
              <span
                className={`inline-block size-3.5 rounded-full bg-[#141413] transition-transform ${
                  reminderEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Time picker */}
          {reminderEnabled && (
            <div className={rowClass}>
              <p className="text-sm text-[#a3a29f]">Reminder time</p>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* Save button */}
          <div className={rowClass}>
            <p className="text-xs text-[#5e5e5c]">
              {reminderEnabled
                ? `Reminder set for ${reminderTime}`
                : "Reminders are off"}
            </p>
            <button
              onClick={handleSaveReminder}
              disabled={savingReminder}
              className="rounded-lg bg-[#f2f1ed] px-3 py-1 font-mono text-xs font-semibold text-[#141413] hover:bg-white disabled:opacity-50 transition-colors"
            >
              {savingReminder ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* Push notifications */}
      <section className="space-y-2">
        <p className={labelClass}>Notifications</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              {isPushActive ? (
                <Bell size={14} className="text-[#5e5e5c]" />
              ) : (
                <BellOff size={14} className="text-[#5e5e5c]" />
              )}
              <div>
                <p className="text-sm text-[#f2f1ed]">Push notifications</p>
                <p className="font-mono text-xs text-[#5e5e5c]">
                  {pushState === "denied"
                    ? "Blocked in browser — check site settings"
                    : isPushActive
                    ? "Active on this device"
                    : "Not enabled"}
                </p>
              </div>
            </div>
            {pushState !== "denied" && pushState !== "unsupported" && (
              <button
                onClick={handlePushToggle}
                disabled={pushLoading}
                className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors disabled:opacity-50 ${
                  isPushActive
                    ? "border-[#3d3d3c] text-[#a3a29f] hover:border-[#5e5e5c]"
                    : "border-transparent bg-[#f2f1ed] font-semibold text-[#141413] hover:bg-white"
                }`}
              >
                {pushLoading ? "…" : isPushActive ? "Turn off" : "Enable"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Onboarding shortcut */}
      <section className="space-y-2">
        <p className={labelClass}>Setup</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <p className="text-sm text-[#f2f1ed]">Re-run onboarding</p>
            <a
              href="/onboarding"
              className="rounded-lg border border-[#3d3d3c] px-3 py-1 font-mono text-xs text-[#a3a29f] hover:border-[#5e5e5c] hover:text-[#f2f1ed] transition-colors"
            >
              Open
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
