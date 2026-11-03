import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

const FLUID: [number, number, number, number] = [0.32, 0.72, 0, 1];

/** Heavy fade-up entrance with blur, fluid easing. */
export function Enter({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay, ease: FLUID }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  style,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap } },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: FLUID },
  },
};

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/** Version change: old struck through, arrow, new in polarity color. */
export function VersionFlip({ from, to }: { from?: string | null; to?: string | null }) {
  return (
    <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {from && <span className="pkg-ver old">{from}</span>}
      {from && <span style={{ color: "var(--accent)" }}>→</span>}
      <motion.span
        key={to ?? ""}
        className="pkg-ver new"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: FLUID }}
      >
        {to ?? "—"}
      </motion.span>
    </span>
  );
}
