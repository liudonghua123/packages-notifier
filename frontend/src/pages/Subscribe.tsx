import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { Enter } from "../motion-bits";

export default function Subscribe() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await api.subscribeRequestCode(email.trim().toLowerCase(), pkg.trim());
      setDevCode(r.dev_code);
      setStep(2);
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
      await api.subscribeVerify(email.trim().toLowerCase(), pkg.trim(), code.trim());
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
        <h1 className="h1">{t("subscribe.title")}</h1>
        <Steps current={step} />
      </Enter>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            className="card"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="field">
              <label htmlFor="sub-email">{t("subscribe.email")}</label>
              <input
                id="sub-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="sub-pkg">{t("subscribe.package")}</label>
              <input
                id="sub-pkg"
                className="mono"
                placeholder="@cloudflare/vite-plugin"
                value={pkg}
                onChange={(e) => setPkg(e.target.value)}
              />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              onClick={sendCode}
              disabled={busy || !email || !pkg}
              style={{ width: "100%", height: 42 }}
            >
              {busy ? t("subscribe.requesting") : t("subscribe.sendCode")}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="s2"
            className="card"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="ok-text" style={{ marginTop: 0 }}>
              {t("subscribe.codeSent", { email })}
            </p>
            <div className="field">
              <label htmlFor="sub-code" className="row between">
                <span>{t("subscribe.code")}</span>
                <span className="pill mono">{pkg}</span>
              </label>
              <input
                id="sub-code"
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
              <p className="hint" style={{ color: "var(--warning)", fontSize: 12 }}>
                {t("subscribe.devCode")} <span className="mono">{devCode}</span>
              </p>
            )}
            {error && <p className="error-text" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              onClick={verify}
              disabled={busy || code.length < 4}
              style={{ width: "100%", height: 42 }}
            >
              {busy ? t("subscribe.verifying") : t("subscribe.verify")}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setStep(1)}
              style={{ width: "100%", height: 42, marginTop: 8 }}
            >
              {t("subscribe.back")}
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="s3"
            className="card"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{ textAlign: "center", padding: 40 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }}
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 16px",
                borderRadius: "50%",
                background: "var(--pill-positive-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--pill-positive-ink)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </motion.div>
            <p style={{ margin: "0 0 20px", fontWeight: 600 }}>
              {t("subscribe.success", { package: pkg })}
            </p>
            <a href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>
              {t("nav.home")}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const { t } = useTranslation();
  return (
    <div className="row" style={{ gap: 8, marginBottom: 24 }}>
      {[t("subscribe.step1"), t("subscribe.step2")].map((label, i) => (
        <div key={label} className="row" style={{ gap: 8 }}>
          {i > 0 && <span style={{ color: "var(--muted)" }}>—</span>}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: current > i ? "var(--text)" : "var(--muted)",
              borderBottom: current > i ? "1px solid var(--accent)" : "1px solid transparent",
              paddingBottom: 2,
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
