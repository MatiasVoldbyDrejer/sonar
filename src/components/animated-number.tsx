"use client";

import { useEffect, useRef } from "react";
import { useSpring, useTransform, motion, useReducedMotion } from "framer-motion";

const formatter = new Intl.NumberFormat("da-DK", {
  style: "currency",
  currency: "DKK",
  minimumFractionDigits: 2,
});

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const spring = useSpring(0, { duration: 400, bounce: 0 });
  const display = useTransform(spring, (v) => formatter.format(v));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      if (ref.current) ref.current.textContent = formatter.format(value);
      return;
    }
    spring.set(value);
  }, [value, spring, prefersReducedMotion]);

  if (prefersReducedMotion) {
    return <span ref={ref} className={className}>{formatter.format(value)}</span>;
  }

  return <motion.span className={className}>{display}</motion.span>;
}
