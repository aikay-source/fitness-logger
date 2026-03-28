"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, PlusCircle, BarChart2, Settings } from "lucide-react";
import { softSpring } from "@/lib/motion.config";

const navItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sessions/new", label: "Log", icon: PlusCircle },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--app-border)] bg-[var(--app-bg)] backdrop-blur-sm" style={{ backgroundColor: "color-mix(in srgb, var(--app-bg) 95%, transparent)" }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2 pb-safe">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const isLog = href === "/sessions/new";

          if (isLog) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="relative flex flex-col items-center gap-0.5 px-3 py-2 -mt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)] rounded-lg"
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-px bg-[var(--app-text)] rounded-full"
                    transition={softSpring}
                  />
                )}
                <div className={`flex items-center justify-center rounded-full size-10 transition-[background-color,transform] active:scale-[0.96] ${
                  active
                    ? "bg-[var(--app-accent)]"
                    : "bg-[var(--app-elevated)] hover:bg-[var(--app-border)]"
                }`}>
                  <Icon
                    size={18}
                    strokeWidth={2}
                    className={active ? "text-white" : "text-[var(--app-tertiary)]"}
                  />
                </div>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${
                  active ? "text-[var(--app-text)]" : "text-[var(--app-muted)]"
                }`}>
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 active:scale-[0.96] transition-[color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)] ${
                active
                  ? "text-[var(--app-text)]"
                  : "text-[var(--app-muted)] hover:text-[var(--app-tertiary)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-px bg-[var(--app-text)] rounded-full"
                  transition={softSpring}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.75}
              />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
