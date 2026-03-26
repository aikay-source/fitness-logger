"use client";

import { AnimatePresence, motion } from "framer-motion";

const variants = {
  enter: { y: 12, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -12, opacity: 0 },
};

export default function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
