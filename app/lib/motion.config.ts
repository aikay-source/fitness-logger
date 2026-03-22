import type { Transition } from "framer-motion";

/** Snappy spring — buttons, cards, interactive presses */
export const spring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

/** Softer spring — page transitions, larger elements */
export const softSpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

/** Quick ease-out — number rolls, short fades */
export const easeOut: Transition = {
  duration: 0.18,
  ease: "easeOut",
};

/** Stagger container variants */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

/** Stagger child — slide up + fade in */
export const staggerItem = {
  hidden: { y: 8, opacity: 0 },
  show: { y: 0, opacity: 1, transition: easeOut },
};
