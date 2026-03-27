"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      meta?.setAttribute("content", "#141413");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      meta?.setAttribute("content", "#ffffff");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex size-8 items-center justify-center rounded-lg text-[var(--app-muted)] hover:text-[var(--app-text)] active:scale-[0.96] transition-[color,transform]"
    >
      {/* Both icons always in DOM — crossfade via CSS transitions */}
      <Sun
        size={16}
        className="absolute transition-[opacity,transform] duration-150"
        style={{
          opacity: dark ? 1 : 0,
          transform: dark ? "scale(1) rotate(0deg)" : "scale(0.8) rotate(-90deg)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      />
      <Moon
        size={16}
        className="absolute transition-[opacity,transform] duration-150"
        style={{
          opacity: dark ? 0 : 1,
          transform: dark ? "scale(0.8) rotate(90deg)" : "scale(1) rotate(0deg)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      />
    </button>
  );
}
