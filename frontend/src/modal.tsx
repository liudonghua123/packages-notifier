import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ActiveConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

/**
 * Promise-based styled confirm dialog, rendered in a portal.
 * Replaces window.confirm so dialogs match the app's look.
 *
 * Usage:
 *   const ok = await confirm({ title: "...", danger: true });
 */
let _push: ((c: ActiveConfirm) => void) | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_push) {
      // no provider mounted: fall back to the native dialog
      resolve(window.confirm(opts.message || opts.title));
      return;
    }
    _push({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [active, setActive] = useState<ActiveConfirm | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    _push = (c) => setActive(c);
    return () => {
      _push = null;
    };
  }, []);

  const close = (ok: boolean) => {
    if (!active || busyRef.current) return;
    busyRef.current = true;
    active.resolve(ok);
    setActive(null);
    setTimeout(() => (busyRef.current = false), 200);
  };

  // Escape cancels
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => close(false)}
        >
          <motion.div
            className="modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-label={active.title}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`modal-icon${active.danger ? " danger" : ""}`}>
              {active.danger ? "!" : "?"}
            </div>
            <h3 className="modal-title">{active.title}</h3>
            {active.message && <p className="modal-message">{active.message}</p>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {active.cancelText ?? "Cancel"}
              </button>
              <button
                className={`btn ${active.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => close(true)}
                autoFocus
              >
                {active.confirmText ?? "Confirm"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
