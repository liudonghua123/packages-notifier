import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type SearchHit = {
  name: string;
  version: string;
  description: string;
};

/** Package autocomplete input with debounced per-ecosystem search dropdown. */
export default function PackageInput({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  type = "npm",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (hit: SearchHit) => void;
  placeholder?: string;
  id?: string;
  type?: string;
}) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounced search (re-runs when the ecosystem changes too)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`
        );
        const d = await r.json();
        setHits(d.results || []);
        setOpen(true);
        setSel(-1);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, type]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (hit: SearchHit) => {
    onChange(hit.name);
    setOpen(false);
    onSelect?.(hit);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s <= 0 ? hits.length - 1 : s - 1));
    } else if (e.key === "Enter" && sel >= 0) {
      e.preventDefault();
      pick(hits[sel]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="ac-wrap" ref={wrapRef}>
      <input
        id={id}
        className="mono"
        role="combobox"
        aria-expanded={open}
        aria-controls="pkg-ac-list"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        onKeyDown={onKey}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            id="pkg-ac-list"
            role="listbox"
            className="ac-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            {loading && hits.length === 0 && (
              <div style={{ padding: 12 }}>
                <div className="skel" style={{ height: 20, marginBottom: 8 }} />
                <div className="skel" style={{ height: 20, marginBottom: 8 }} />
                <div className="skel" style={{ height: 20 }} />
              </div>
            )}
            {!loading && hits.length === 0 && (
              <div className="ac-empty">No packages found for “{value}”</div>
            )}
            {hits.map((hit, i) => (
              <button
                key={hit.name}
                type="button"
                role="option"
                aria-selected={i === sel}
                className={`ac-item${i === sel ? " sel" : ""}`}
                onClick={() => pick(hit)}
                onMouseEnter={() => setSel(i)}
              >
                <span className="nm">{hit.name}</span>
                <span className="ds">{hit.description}</span>
                <span className="vr">{hit.version}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
