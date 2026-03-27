"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Bell, BellOff, Clock, LogOut, Palette, User } from "lucide-react";
import { saveReminderSettings } from "@/app/actions/settings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import ThemeToggle from "@/components/ThemeToggle";

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

  const sectionClass = "rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] divide-y divide-[var(--app-border)]";
  const rowClass = "flex items-center justify-between px-4 py-3.5";
  const labelClass = "font-mono text-xs font-semibold uppercase tracking-widest text-[var(--app-tertiary)]";
  const inputClass =
    "rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1.5 text-sm text-[var(--app-text)] focus:border-[var(--app-tertiary)] focus:outline-none transition-colors";

  return (
    <main id="main-content" className="mx-auto max-w-lg px-4 pt-8 space-y-8">
      <div>
        <p className={labelClass}>Preferences</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[var(--app-text)]">
          Settings
        </h1>
      </div>

      {/* Account */}
      <section className="space-y-2">
        <p className={labelClass}>Account</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <User size={14} className="text-[var(--app-muted)]" />
              <div>
                <p className="text-sm text-[var(--app-text)]">{name || "Coach"}</p>
                <p className="font-mono text-xs text-[var(--app-muted)]">{email}</p>
              </div>
            </div>
          </div>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <LogOut size={14} className="text-[var(--app-muted)]" />
              <p className="text-sm text-[var(--app-text)]">Sign out</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1 font-mono text-xs text-[var(--app-tertiary)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
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
              <Clock size={14} className="text-[var(--app-muted)]" />
              <p className="text-sm text-[var(--app-text)]">Daily reminder</p>
            </div>
            <button
              role="switch"
              aria-checked={reminderEnabled}
              aria-label="Enable daily reminder"
              onClick={() => setReminderEnabled((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                reminderEnabled ? "bg-[var(--app-text)]" : "bg-[var(--app-border)]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block size-3.5 rounded-full bg-[var(--app-bg)] transition-transform ${
                  reminderEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Time picker */}
          {reminderEnabled && (
            <div className={rowClass}>
              <label htmlFor="settings-reminder-time" className="text-sm text-[var(--app-tertiary)]">Reminder time</label>
              <input
                id="settings-reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* Save button */}
          <div className={rowClass}>
            <p className="text-xs text-[var(--app-muted)]">
              {reminderEnabled
                ? `Reminder set for ${reminderTime}`
                : "Reminders are off"}
            </p>
            <button
              onClick={handleSaveReminder}
              disabled={savingReminder}
              className="rounded-lg bg-[var(--app-text)] px-3 py-1 font-mono text-xs font-semibold text-[var(--app-text-inv)] hover:opacity-90 disabled:opacity-50 transition-colors"
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
                <Bell size={14} className="text-[var(--app-muted)]" />
              ) : (
                <BellOff size={14} className="text-[var(--app-muted)]" />
              )}
              <div>
                <p className="text-sm text-[var(--app-text)]">Push notifications</p>
                <p className="font-mono text-xs text-[var(--app-muted)]">
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
                role="switch"
                aria-checked={isPushActive}
                aria-label="Enable push notifications"
                onClick={handlePushToggle}
                disabled={pushLoading}
                className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors disabled:opacity-50 ${
                  isPushActive
                    ? "border-[var(--app-border)] text-[var(--app-tertiary)] hover:border-[var(--app-muted)]"
                    : "border-transparent bg-[var(--app-text)] font-semibold text-[var(--app-text-inv)] hover:opacity-90"
                }`}
              >
                {pushLoading ? "…" : isPushActive ? "Turn off" : "Enable"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-2">
        <p className={labelClass}>Appearance</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <div className="flex items-center gap-3">
              <Palette size={14} className="text-[var(--app-muted)]" />
              <p className="text-sm text-[var(--app-text)]">Theme</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </section>

      {/* Onboarding shortcut */}
      <section className="space-y-2">
        <p className={labelClass}>Setup</p>
        <div className={sectionClass}>
          <div className={rowClass}>
            <p className="text-sm text-[var(--app-text)]">Re-run onboarding</p>
            <a
              href="/onboarding"
              className="rounded-lg border border-[var(--app-border)] px-3 py-1 font-mono text-xs text-[var(--app-tertiary)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)] transition-colors"
            >
              Open
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
