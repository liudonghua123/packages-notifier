import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import PackageInput, { type SearchHit } from "../PackageInput";
import { Enter } from "../motion-bits";

type Meta = Awaited<ReturnType<typeof api.packageDetail>>["package"];

export default function Query() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async (pkg?: string) => {
    const target = (pkg ?? name).trim();
    if (!target) return;
    setError("");
    setBusy(true);
    try {
      const r = await api.packageDetail(target);
      setMeta(r.package);
      setName(target);
    } catch (e) {
      setMeta(null);
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const onSelect = (hit: SearchHit) => {
    search(hit.name);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1">
          <span className="grad">{t("query.title")}</span>
        </h1>
        <p className="sub">{t("query.sub")}</p>
      </Enter>

      <Enter delay={0.1}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          style={{ marginBottom: 8, gap: 12, maxWidth: 520 }}
        >
          <div className="grow" style={{ minWidth: 0 }}>
            <PackageInput
              id="query-pkg"
              value={name}
              onChange={setName}
              onSelect={onSelect}
              placeholder={t("query.placeholder")}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {t("query.search")}
          </button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 32px" }}>
          {t("query.acHint")}
        </p>
      </Enter>

      {error && <p className="error-text">{error}</p>}

      <AnimatePresence mode="wait">
        {meta && (
          <motion.div
            key={meta.name}
            className="card"
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
              <motion.h2
                className="mono"
                style={{ margin: 0, fontSize: 24, fontWeight: 700, wordBreak: "break-all" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {meta.name}
              </motion.h2>
              <motion.span
                className="pill violet mono"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
              >
                {t("query.latest")} {meta.latest}
              </motion.span>
            </div>

            {meta.description && (
              <p style={{ color: "var(--muted)", margin: "8px 0 24px", fontSize: 16 }}>
                {meta.description}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                padding: "24px 0",
                borderTop: "1px solid var(--rule)",
              }}
            >
              <Fact value={meta.versions_count.toLocaleString()} label={t("query.versions")} delay={0.25} color="var(--accent)" />
              <Fact value={meta.license || "—"} label="license" delay={0.32} color="var(--accent-4)" mono />
              <Fact
                value={meta.latest_published_at ? meta.latest_published_at.slice(0, 10) : "—"}
                label={t("query.modified")}
                delay={0.39}
                color="var(--accent-3)"
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
                      style={{ minHeight: 40, padding: "8px 4px" }}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05, ease: [0.32, 0.72, 0, 1] }}
                    >
                      <span
                        className="pkg-ver"
                        style={{ color: i === 0 ? "var(--positive)" : undefined, fontWeight: i === 0 ? 700 : 400 }}
                      >
                        {v}
                      </span>
                      {i === 0 && (
                        <span className="pill positive" style={{ height: 20, fontSize: 11 }}>
                          latest
                        </span>
                      )}
                    </motion.div>
                  ))}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
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

function Fact({ value, label, delay, color, mono }: { value: string; label: string; delay: number; color: string; mono?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className={`num ${mono ? "mono" : ""}`} style={{ fontSize: 18, fontWeight: 700, color }}>
        {value}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{label}</div>
    </motion.div>
  );
}
