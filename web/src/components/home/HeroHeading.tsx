"use client";

import { motion, useReducedMotion } from "framer-motion";

const LINES = ["Your Friends.", "Your Room.", "Absolute Chaos."];

/** The page headline. The one animated moment on the page: three lines rise in, one after another. */
export function HeroHeading() {
  const reduceMotion = useReducedMotion();

  return (
    <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-7xl">
      {LINES.map((line, index) => (
        <motion.span
          key={line}
          className="block"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.18, type: "spring", stiffness: 120, damping: 16 }}
        >
          {line}
        </motion.span>
      ))}
    </h1>
  );
}
