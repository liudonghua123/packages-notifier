import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import PackageInput from "../PackageInput";
import { Enter } from "../motion-bits";
import { CheckIcon } from "../icons";

export default function Subscribe() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [pkg, setPkg] = useState("");
  const [versionMatch, setVersionMatch] = useState("any");
  const [versionPattern, setVersionPattern] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await api.subscribeRequestCode(
        email.trim().toLowerCase(),
        pkg.trim(),
        versionMatch,
        versionPattern.trim()
      );
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
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <Enter>
        <h1 className="h1" style={{ fontSize: "clamp(30px, 6vw, 48px)" }}>
          <span className="grad">{t("subscribe.title")}</span>
        </h1>
        <Steps current={step} />
      </Enter>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            className="card"
            initial={{ opacity: 0, x: -32, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -32, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
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
              <PackageInput
                id="sub-pkg"
                value={pkg}
                onChange={setPkg}
                placeholder={t("subscribe.pkgPlaceholder")}
              />
            </div>
            <div className="field">
              <label htmlFor="sub-vmode">{t("subscribe.versionMatch")}</label>
              <div className="vm-row" role="radiogroup" aria-label={t("subscribe.versionMatch")}>
                {["any", "equals", "startswith", "regexmatch"].map((m) => (
                  <button
                    key={m}
                    id={m === "any" ? "sub-vmode" : undefined}
                    type="button"
                    role="radio"
                    aria-checked={versionMatch === m}
                    className={`vm-chip${versionMatch === m ? " on" : ""}`}
                    onClick={() => {
                      setVersionMatch(m);
                      if (m === "any") setVersionPattern("");
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {versionMatch !== "any" && (
                <input
                  className="mono"
                  style={{ marginTop: 8 }}
                  placeholder={
                    versionMatch === "equals"
                      ? "1.2.3"
                      : versionMatch === "startswith"
                        ? "1.2."
                        : "^2\\.\\d+\\."
                  }
                  value={versionPattern}
                  onChange={(e) => setVersionPattern(e.target.value)}
                  aria-label={t("subscribe.versionPattern")}
                />
              )}
              {versionMatch !== "any" && (
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>
                  {t("subscribe.versionHint")}
                </p>
              )}
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              onClick={sendCode}
              disabled={
                busy ||
                !email ||
                !pkg ||
                (versionMatch !== "any" && !versionPattern.trim())
              }
              style={{ width: "100%" }}
            >
              {busy ? t("subscribe.requesting") : t("subscribe.sendCode")}
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="s2"
            className="card"
            initial={{ opacity: 0, x: 32, filter: "blur(4px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 32, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            <p className="ok-text" style={{ marginTop: 0, fontWeight: 600 }}>
              {t("subscribe.codeSent", { email })}
            </p>
            <div className="field">
              <label htmlFor="sub-code" className="row between">
                <span>{t("subscribe.code")}</span>
                <span className="pill violet mono">{pkg}</span>
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
              {busy ? t("subscribe.verifying") : t("subscribe.verify")}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setStep(1)}
              style={{ width: "100%", marginTop: 12 }}
            >
              {t("subscribe.back")}
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="s3"
            className="card"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ textAlign: "center", padding: 48 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 24px",
                borderRadius: 24,
                background: "linear-gradient(135deg, var(--accent-4), var(--accent))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                boxShadow: "var(--shadow-accent)",
              }}
            >
              <CheckIcon />
            </motion.div>
            <p style={{ margin: "0 0 24px", fontWeight: 700, fontSize: 18 }}>
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
    <div className="row" style={{ gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
      {[t("subscribe.step1"), t("subscribe.step2")].map((label, i) => (
        <div key={label} className="row" style={{ gap: 8 }}>
          {i > 0 && <span style={{ color: "var(--muted)" }}>·</span>}
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: current > i ? "var(--text)" : "var(--muted)",
              borderBottom: current > i ? "2px solid var(--accent)" : "2px solid transparent",
              paddingBottom: 2,
              transition: "all 0.5s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
