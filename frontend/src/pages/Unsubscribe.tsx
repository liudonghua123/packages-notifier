import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { Enter } from "../motion-bits";

export default function Unsubscribe() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(params.get("email") || "");
  const [pkg, setPkg] = useState(params.get("package") || "");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await api.unsubscribeRequestCode(email.trim().toLowerCase(), pkg.trim());
      setDevCode(r.dev_code);
      setStep(2);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setError("");
    setBusy(true);
    try {
      await api.unsubscribeVerify(email.trim().toLowerCase(), pkg.trim(), code.trim());
      setStep(3);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1">{t("unsubscribe.title")}</h1>
      </Enter>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="u1" className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }}>
            <div className="field">
              <label htmlFor="un-email">{t("subscribe.email")}</label>
              <input id="un-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label htmlFor="un-pkg">{t("subscribe.package")}</label>
              <input id="un-pkg" className="mono" value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="@cloudflare/vite-plugin" />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="btn btn-danger" onClick={sendCode} disabled={busy || !email || !pkg} style={{ width: "100%", height: 42 }}>
              {t("unsubscribe.request")}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="u2" className="card" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
            <div className="field">
              <label htmlFor="un-code">{t("subscribe.code")}</label>
              <input
                id="un-code"
                className="code-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="······"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {devCode && (
              <p style={{ color: "var(--warning)", fontSize: 12 }}>
                {t("subscribe.devCode")} <span className="mono">{devCode}</span>
              </p>
            )}
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="btn btn-danger" onClick={confirm} disabled={busy || code.length < 4} style={{ width: "100%", height: 42 }}>
              {t("unsubscribe.confirm")}
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="u3" className="card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontWeight: 600, margin: "0 0 16px" }}>{t("unsubscribe.success", { package: pkg })}</p>
            <a href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>{t("nav.home")}</a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
