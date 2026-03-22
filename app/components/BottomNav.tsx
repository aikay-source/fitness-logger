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
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? "text-[#f2f1ed]"
                  : "text-[#5e5e5c] hover:text-[#a3a29f]"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.75}
                className={active ? "text-[#f2f1ed]" : ""}
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
