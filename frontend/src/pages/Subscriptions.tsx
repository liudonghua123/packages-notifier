import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { Enter } from "../motion-bits";

type Sub = {
  package: string;
  verified: boolean;
  created_at: number;
  last_notified_version: string | null;
};

const DOT_COLORS = ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "var(--accent-4)", "var(--accent-5)"];

export default function Subscriptions() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(() => localStorage.getItem("pn-email") || "");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      const r = await api.mySubscriptions(em);
      setSubs(r.subscriptions);
      localStorage.setItem("pn-email", em);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (pkg: string) => {
    window.location.href = `/unsubscribe?email=${encodeURIComponent(email)}&package=${encodeURIComponent(pkg)}`;
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1" style={{ fontSize: "clamp(30px, 6vw, 48px)" }}>
          <span className="grad">{t("subs.title")}</span>
        </h1>
        <p className="sub">{t("subs.sub")}</p>
      </Enter>

      <Enter delay={0.1}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          style={{ marginBottom: 32, gap: 12 }}
        >
          <input
            type="email"
            className="grow"
            placeholder={t("subs.placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={t("subs.placeholder")}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !email}>
            {t("subs.load")}
          </button>
        </form>
      </Enter>

      {error && <p className="error-text">{error}</p>}

      <AnimatePresence>
        {subs && subs.length === 0 && (
          <motion.div key="empty" className="empty-state card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="big">◌</div>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>{t("subs.none")}</p>
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>{t("subs.noneHint")}</p>
          </motion.div>
        )}

        {subs && subs.length > 0 && (
          <motion.div key="list" className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}>
            <div className="table-head">
              <span>{t("subs.pkg")}</span>
              <span>{t("subs.last")}</span>
              <span>{t("subs.status")}</span>
            </div>
            {subs.map((s, i) => (
              <motion.div
                key={s.package}
                className="pkg-row"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24, height: 0 }}
                transition={{ delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                style={{ flexWrap: "wrap", borderLeft: `3px solid ${DOT_COLORS[i % DOT_COLORS.length]}` }}
              >
                <div className="grow" style={{ minWidth: 160 }}>
                  <div className="pkg-name">{s.package}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {t("subs.since")} {new Date(s.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                <span className="pkg-ver">{s.last_notified_version || "—"}</span>
                <span className={`pill ${s.verified ? "positive" : "warning"}`}>
                  {s.verified ? t("subs.verified") : t("subs.unverified")}
                </span>
                <button className="btn btn-danger" style={{ height: 32, padding: "0 16px", fontSize: 13 }} onClick={() => remove(s.package)}>
                  {t("subs.remove")}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
