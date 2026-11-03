import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

/** Staggered entrance: heading first, then children rising 16-24px. */
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  style,
  gap = 0.07,
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
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
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

/** Version change badge: old struck through, arrow, new in polarity color. */
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
        transition={{ duration: 0.35 }}
      >
        {to ?? "—"}
      </motion.span>
    </span>
  );
}
