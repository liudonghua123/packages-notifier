import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { Enter } from "../motion-bits";

type Meta = Awaited<ReturnType<typeof api.packageDetail>>["package"];

export default function Query() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    if (!name.trim()) return;
    setError("");
    setBusy(true);
    try {
      const r = await api.packageDetail(name.trim());
      setMeta(r.package);
    } catch (e) {
      setMeta(null);
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1">{t("query.title")}</h1>
        <p className="sub">{t("query.sub")}</p>
      </Enter>

      <Enter delay={0.1}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          style={{ marginBottom: 24 }}
        >
          <input
            className="mono grow"
            style={{ height: 42 }}
            placeholder={t("query.placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t("query.placeholder")}
          />
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ height: 42 }}>
            {t("query.search")}
          </button>
        </form>
      </Enter>

      {error && <p className="error-text">{error}</p>}

      <AnimatePresence mode="wait">
        {meta && (
          <motion.div
            key={meta.name}
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
              <motion.h2
                className="mono"
                style={{ margin: 0, fontSize: 20, fontWeight: 700, wordBreak: "break-all" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {meta.name}
              </motion.h2>
              <motion.span
                className="pill positive mono"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
              >
                {t("query.latest")} {meta.latest}
              </motion.span>
            </div>

            {meta.description && (
              <p style={{ color: "var(--muted)", margin: "8px 0 16px", fontSize: 14 }}>
                {meta.description}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                padding: "16px 0",
                borderTop: "1px solid var(--rule)",
              }}
            >
              <Fact value={meta.versions_count.toLocaleString()} label={t("query.versions")} delay={0.25} />
              <Fact value={meta.license || "—"} label="license" delay={0.32} mono />
              <Fact
                value={meta.latest_published_at ? meta.latest_published_at.slice(0, 10) : "—"}
                label={t("query.modified")}
                delay={0.39}
                mono
              />
            </div>

            {meta.recent_versions.length > 0 && (
              <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
                {meta.recent_versions
                  .slice()
                  .reverse()
                  .map((v, i) => (
                    <motion.div
                      key={v}
                      className="pkg-row"
                      style={{ minHeight: 36, padding: "6px 0" }}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                    >
                      <span className="pkg-ver" style={{ color: i === 0 ? "var(--positive)" : undefined }}>
                        {v}
                      </span>
                      {i === 0 && (
                        <span className="pill positive" style={{ height: 18, fontSize: 10 }}>
                          latest
                        </span>
                      )}
                    </motion.div>
                  ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <a
                href={`/subscribe?package=${encodeURIComponent(meta.name)}`}
                className="btn btn-primary"
                style={{ textDecoration: "none" }}
              >
                {t("query.watch")} →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fact({ value, label, delay, mono }: { value: string; label: string; delay: number; mono?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <div className={`num ${mono ? "mono" : ""}`} style={{ fontSize: 16, fontWeight: 600 }}>
        {value}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 11 }}>{label}</div>
    </motion.div>
  );
}
