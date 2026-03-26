"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, PlusCircle, BarChart2, Settings } from "lucide-react";

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#3d3d3c] bg-[#141413]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2 pb-safe">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const isLog = href === "/sessions/new";

          if (isLog) {
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-2 -mt-1"
              >
                <div className={`flex items-center justify-center rounded-full size-10 transition-[background-color,transform] active:scale-[0.96] ${
                  active
                    ? "bg-[#f2f1ed]"
                    : "bg-[#262625] hover:bg-[#3d3d3c]"
                }`}>
                  <Icon
                    size={18}
                    strokeWidth={2}
                    className={active ? "text-[#141413]" : "text-[#a3a29f]"}
                  />
                </div>
                <span className={`font-mono text-[10px] font-semibold uppercase tracking-widest ${
                  active ? "text-[#f2f1ed]" : "text-[#5e5e5c]"
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
              className={`relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 active:scale-[0.96] transition-[color,transform] ${
                active
                  ? "text-[#f2f1ed]"
                  : "text-[#5e5e5c] hover:text-[#a3a29f]"
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-px bg-[#f2f1ed] rounded-full" />
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
