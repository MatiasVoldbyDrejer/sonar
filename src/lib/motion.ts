export const duration = {
  fast: 0.15,
  normal: 0.2,
} as const;

export const ease = [0.25, 0.1, 0.25, 1.0] as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: duration.fast, ease },
} as const;
