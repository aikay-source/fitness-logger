import type { Transition } from "framer-motion";

/** Strong ease-out — starts fast, settles gently */
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Strong ease-in — used for exits; starts slow, leaves fast */
export const EASE_IN: [number, number, number, number] = [0.55, 0, 1, 0.45];

/** Strong ease-in-out — natural acceleration/deceleration */
export const EASE_IN_OUT: [number, number, number, number] = [0.77, 0, 0.175, 1];

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
  ease: EASE_OUT,
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
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: easeOut },
};
