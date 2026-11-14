"use client";

import { motion, useReducedMotion } from "framer-motion";

/** The big gradient CHAOS CLUB title. Animates in, unless the device asks for reduced motion. */
export function AnimatedWordmark({ name }: { name: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.h1
      initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 120, damping: 14 }}
      className="animate-gradient-shift bg-linear-to-r from-bubblegum via-tangerine to-sunny bg-[length:200%_auto] bg-clip-text pb-2 font-display text-5xl font-bold tracking-tight text-balance text-transparent sm:text-7xl md:text-8xl"
    >
      {name}
    </motion.h1>
  );
}
