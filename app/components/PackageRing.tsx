"use client";

import { motion } from "framer-motion";

const SIZE = 40;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ringColor(remaining: number): string {
  if (remaining <= 2) return "#ef4444"; // red
  if (remaining <= 5) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

export default function PackageRing({
  remaining,
  total,
  className,
}: {
  remaining: number;
  total: number;
  className?: string;
}) {
  if (total <= 0) return null;

  const fraction = Math.max(0, Math.min(1, remaining / total));
  const offset = CIRCUMFERENCE * (1 - fraction);
  const color = ringColor(remaining);

  return (
    <div className={`relative flex items-center justify-center ${className ?? ""}`}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#3d3d3c"
          strokeWidth={STROKE}
        />
        {/* Animated progress */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-semibold tabular-nums text-[#f2f1ed]">
        {remaining}
      </span>
    </div>
  );
}
