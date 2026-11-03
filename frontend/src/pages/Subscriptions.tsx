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
    // unsubscribe needs verification; navigate prefilled
    window.location.href = `/unsubscribe?email=${encodeURIComponent(email)}&package=${encodeURIComponent(pkg)}`;
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1">{t("subs.title")}</h1>
        <p className="sub">{t("subs.sub")}</p>
      </Enter>

      <Enter delay={0.1}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          style={{ marginBottom: 24 }}
        >
          <input
            type="email"
            className="grow"
            style={{ height: 42 }}
            placeholder={t("subs.placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label={t("subs.placeholder")}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !email} style={{ height: 42 }}>
            {t("subs.load")}
          </button>
        </form>
      </Enter>

      {error && <p className="error-text">{error}</p>}

      <AnimatePresence>
        {subs && subs.length === 0 && (
          <motion.div key="empty" className="empty-state card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="big">◌</div>
            <p style={{ margin: 0 }}>{t("subs.none")}</p>
            <p className="sub" style={{ margin: "4px 0 0", fontSize: 12 }}>{t("subs.noneHint")}</p>
          </motion.div>
        )}

        {subs && subs.length > 0 && (
          <motion.div key="list" className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="table-head">
              <span>{t("subs.pkg")}</span>
              <span>{t("subs.last")}</span>
              <span>{t("subs.status")}</span>
            </div>
            {subs.map((s, i) => (
              <motion.div
                key={s.package}
                className="pkg-row"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16, height: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ flexWrap: "wrap" }}
              >
                <div className="grow" style={{ minWidth: 160 }}>
                  <div className="pkg-name">{s.package}</div>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>
                    {t("subs.since")} {new Date(s.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                <span className="pkg-ver">{s.last_notified_version || "—"}</span>
                <span className={`pill ${s.verified ? "positive" : "warning"}`}>
                  {s.verified ? t("subs.verified") : t("subs.unverified")}
                </span>
                <button className="btn btn-danger" style={{ height: 28, padding: "0 12px", fontSize: 12 }} onClick={() => remove(s.package)}>
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
