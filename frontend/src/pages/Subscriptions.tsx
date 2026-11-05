import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { EcoPill } from "./Subscribe";
import { Enter } from "../motion-bits";
import { CheckIcon } from "../icons";

type Sub = {
  package: string;
  package_type?: string;
  description?: string | null;
  verified: boolean;
  created_at: number;
  last_notified_version: string | null;
  known_version?: string | null;
  version_match: string;
  version_pattern: string | null;
};

export default function Subscriptions() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(() => localStorage.getItem("pn-email") || "");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const [stage, setStage] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = async () => {
    setError("");
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      // inside a valid verification window: load directly, no code
      const st = await api.verifyStatus(em);
      if (st.verified && st.valid_until) {
        setValidUntil(st.valid_until);
        localStorage.setItem("pn-email", em);
        const d = await api.mySubscriptions(em);
        setSubs(d.subscriptions);
        setValidUntil(d.valid_until ?? st.valid_until);
        return;
      }
      const r = await api.subscriptionsRequestCode(em);
      setDevCode(r.dev_code);
      setStage("code");
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError("");
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      const r = await api.subscriptionsVerify(em, code.trim());
      setValidUntil(r.valid_until);
      localStorage.setItem("pn-email", em);
      const d = await api.mySubscriptions(em);
      setSubs(d.subscriptions);
      setValidUntil(d.valid_until ?? r.valid_until);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  // Inside the verification window: confirm dialog + immediate removal.
  // Expired: fall back to the /unsubscribe code flow.
  const remove = async (pkg: string) => {
    const em = email.trim().toLowerCase();
    if (validUntil && validUntil * 1000 > Date.now()) {
      if (!window.confirm(t("subs.removeConfirm", { package: pkg }))) return;
      setBusy(true);
      setError("");
      try {
        await api.unsubscribeDirect(em, pkg);
        const d = await api.mySubscriptions(em);
        setSubs(d.subscriptions);
        setValidUntil(d.valid_until);
      } catch (e) {
        setError(apiErrMessage(e, t));
      } finally {
        setBusy(false);
      }
      return;
    }
    window.location.href = `/unsubscribe?email=${encodeURIComponent(em)}&package=${encodeURIComponent(pkg)}`;
  };

  const removeAll = async () => {
    const em = email.trim().toLowerCase();
    if (validUntil && validUntil * 1000 > Date.now()) {
      if (!window.confirm(t("subs.removeAllConfirm"))) return;
      setBusy(true);
      setError("");
      try {
        await api.unsubscribeDirect(em, "");
        const d = await api.mySubscriptions(em);
        setSubs(d.subscriptions);
        setValidUntil(d.valid_until);
      } catch (e) {
        setError(apiErrMessage(e, t));
      } finally {
        setBusy(false);
      }
      return;
    }
    window.location.href = `/unsubscribe?email=${encodeURIComponent(em)}`;
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1" style={{ fontSize: "clamp(30px, 6vw, 48px)" }}>
          <span className="grad">{t("subs.title")}</span>
        </h1>
        <p className="sub">{t("subs.sub")}</p>
      </Enter>

      {!subs && (
        <Enter delay={0.1}>
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            {stage === "email" ? (
              <>
                <div className="field">
                  <label htmlFor="subs-email">{t("subs.placeholder")}</label>
                  <form
                    className="row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      request();
                    }}
                    style={{ gap: 12 }}
                  >
                    <input
                      id="subs-email"
                      type="email"
                      className="grow"
                      placeholder={t("subs.placeholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-label={t("subs.placeholder")}
                    />
                    <button className="btn btn-primary" type="submit" disabled={busy || !email}>
                      {busy ? t("subs.requesting") : t("subs.request")}
                    </button>
                  </form>
                </div>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{t("subs.verifyHint")}</p>
              </>
            ) : (
              <>
                <p className="ok-text" style={{ marginTop: 0, fontWeight: 600 }}>
                  {t("subscribe.codeSent", { email: email.trim().toLowerCase() })}
                </p>
                <div className="field">
                  <label htmlFor="subs-code">{t("subs.code")}</label>
                  <input
                    id="subs-code"
                    className="code-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="······"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {devCode && (
                  <p style={{ color: "var(--warning)", fontSize: 14 }}>
                    {t("subscribe.devCode")} <span className="mono">{devCode}</span>
                  </p>
                )}
                {error && <p className="error-text" role="alert">{error}</p>}
                <button
                  className="btn btn-primary"
                  onClick={verify}
                  disabled={busy || code.length < 4}
                  style={{ width: "100%" }}
                >
                  {busy ? t("subs.verifying") : t("subs.verify")}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setStage("email")}
                  style={{ width: "100%", marginTop: 12 }}
                >
                  {t("subscribe.back")}
                </button>
              </>
            )}
            {stage === "email" && error && <p className="error-text" role="alert">{error}</p>}
          </motion.div>
        </Enter>
      )}

      <AnimatePresence>
        {subs && (
          <motion.div
            key="list-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {validUntil && (
              <p className="row" style={{ gap: 8, color: "var(--positive)", fontSize: 13, margin: "0 0 16px" }}>
                <CheckIcon size={14} />
                {t("subs.verifiedUntil", {
                  time: new Date(validUntil * 1000).toLocaleString(),
                })}
              </p>
            )}

            {subs.length === 0 && (
              <motion.div key="empty" className="empty-state card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="big">◌</div>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--text)" }}>{t("subs.none")}</p>
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>{t("subs.noneHint")}</p>
              </motion.div>
            )}

            {subs.length > 0 && (
              <motion.div
                key="list"
                className="card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ height: 30, padding: "0 12px", fontSize: 12, color: "var(--negative)" }}
                    onClick={removeAll}
                  >
                    {t("subs.removeAll")}
                  </button>
                </div>
                {subs.map((s, i) => (
                  <motion.div
                    key={s.package}
                    className="pkg-row sub-row"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24, height: 0 }}
                    transition={{ delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                    style={{ flexWrap: "wrap" }}
                  >
                    <div className="grow" style={{ minWidth: 180 }}>
                      <div className="pkg-name" style={{ wordBreak: "break-all" }}>
                        {s.package}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                        <EcoPill type={s.package_type || "npm"} />
                        {(s.known_version || s.last_notified_version) && (
                          <span className="pkg-ver" style={{ fontSize: 12 }}>
                            {s.known_version || s.last_notified_version}
                          </span>
                        )}
                        {s.version_match && s.version_match !== "any" && (
                          <span className="pill violet mono" style={{ height: 20, fontSize: 11 }}>
                            {s.version_match}: {s.version_pattern}
                          </span>
                        )}
                        {!s.verified && (
                          <span className="pill warning" style={{ height: 20, fontSize: 11 }}>
                            {t("subs.unverified")}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                        {t("subs.since")} {new Date(s.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger"
                      style={{ height: 32, padding: "0 16px", fontSize: 13 }}
                      onClick={() => remove(s.package)}
                    >
                      {t("subs.remove")}
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
