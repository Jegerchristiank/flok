import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function SuccessPing() {
  const reduce = useReducedMotion();
  if (reduce) return <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-emerald-500" />;
  return (
    <motion.span
      aria-hidden
      initial={{ scale: 0.8, opacity: 0.0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, duration: 0.3 }}
      className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"
    />
  );
}

