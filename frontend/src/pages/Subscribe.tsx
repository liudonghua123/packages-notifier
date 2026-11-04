import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import PackageInput, { type SearchHit } from "../PackageInput";
import { Enter } from "../motion-bits";
import { CheckIcon, GearIcon, EcoIcon } from "../icons";

type PkgItem = {
  key: string;
  name: string;
  type: string;
  version: string | null;
  versionMatch: string;
  versionPattern: string;
};

const VMODES = ["any", "equals", "startswith", "regexmatch"] as const;

const vmPlaceholder = (m: string) =>
  m === "equals" ? "1.2.3" : m === "startswith" ? "1.2." : "^2\\.\\d+\\.";

/* per-ecosystem accent colors for the type pills */
const ECO_STYLE: Record<string, { bg: string; fg: string }> = {
  npm: { bg: "rgba(203, 51, 51, 0.15)", fg: "#e05d5d" },
  pypi: { bg: "rgba(55, 118, 171, 0.16)", fg: "#6ba3d6" },
  crates: { bg: "rgba(222, 120, 51, 0.15)", fg: "#e08c4f" },
  go: { bg: "rgba(0, 172, 191, 0.15)", fg: "#4fc3d4" },
  rubygems: { bg: "rgba(156, 57, 57, 0.16)", fg: "#d96a6a" },
  maven: { bg: "rgba(196, 100, 36, 0.15)", fg: "#d68a4a" },
  nuget: { bg: "rgba(74, 66, 156, 0.18)", fg: "#9d94e8" },
};

export function EcoPill({ type, label }: { type: string; label?: string }) {
  const s = ECO_STYLE[type] || { bg: "var(--raised)", fg: "var(--muted)" };
  return (
    <span
      className="eco-pill"
      style={{ background: s.bg, color: s.fg }}
      title={label || type}
    >
      <EcoIcon type={type} />
      {label || type}
    </span>
  );
}

export default function Subscribe() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [pkgInput, setPkgInput] = useState("");
  const [items, setItems] = useState<PkgItem[]>([]);
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [eco, setEco] = useState("npm");
  const [ecos, setEcos] = useState<{ type: string; label: string }[]>([]);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [firstPkg, setFirstPkg] = useState("");

  useEffect(() => {
    api
      .listEcosystems()
      .then((d) => setEcos(d.ecosystems))
      .catch(() => setEcos([{ type: "npm", label: "npm" }]));
  }, []);

  const dup = useMemo(
    () => items.some((it) => it.name.toLowerCase() === pkgInput.trim().toLowerCase()),
    [items, pkgInput]
  );

  const addItem = (name?: string, version?: string | null) => {
    const n = (name ?? pkgInput).trim();
    if (!n) return;
    if (items.some((it) => it.name.toLowerCase() === n.toLowerCase())) {
      setPkgInput("");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: `${n}-${Date.now()}`,
        name: n,
        type: eco,
        version: version ?? null,
        versionMatch: "any",
        versionPattern: "",
      },
    ]);
    setPkgInput("");
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    if (openSettings === key) setOpenSettings(null);
  };

  const patchItem = (key: string, patch: Partial<PkgItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const canSend =
    !!email.trim() &&
    items.length > 0 &&
    items.every(
      (it) => it.versionMatch === "any" || it.versionPattern.trim().length > 0
    );

  const sendCode = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await api.subscribeRequestCodeBatch(
        email.trim().toLowerCase(),
        items.map((it) => ({
          package: it.name,
          ...(it.versionMatch !== "any"
            ? { version_match: it.versionMatch, version_pattern: it.versionPattern.trim() }
            : {}),
        })),
        eco
      );
      setDevCode(r.dev_code);
      setFirstPkg(items[0]?.name || "");
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
      await api.subscribeVerify(email.trim().toLowerCase(), "", code.trim());
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
              <label htmlFor="sub-eco">{t("subscribe.ecosystem")}</label>
              <select
                id="sub-eco"
                value={eco}
                onChange={(e) => setEco(e.target.value)}
                className="eco-select"
              >
                {ecos.map((e) => (
                  <option key={e.type} value={e.type}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sub-pkg">{t("subscribe.package")}</label>
              <div className="sub-add-row">
                <div className="grow" style={{ minWidth: 0 }}>
                  <PackageInput
                    id="sub-pkg"
                    value={pkgInput}
                    onChange={setPkgInput}
                    onSelect={(hit: SearchHit) => addItem(hit.name, hit.version)}
                    placeholder={t("subscribe.pkgPlaceholder")}
                    type={eco}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary sub-add-btn"
                  onClick={() => addItem()}
                  disabled={!pkgInput.trim() || dup}
                >
                  {t("subscribe.add")}
                </button>
              </div>
              {dup && (
                <p style={{ margin: 0, color: "var(--warning)", fontSize: 12 }}>
                  {t("subscribe.alreadyAdded")}
                </p>
              )}
            </div>

            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.div
                  key={it.key}
                  className="sub-item"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <div className="row between" style={{ gap: 8, minWidth: 0 }}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="pkg-name" style={{ wordBreak: "break-all" }}>
                        {it.name}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <EcoPill type={it.type} />
                        {it.version && <span className="pkg-ver" style={{ fontSize: 12 }}>{it.version}</span>}
                        {it.versionMatch !== "any" && (
                          <span className="pill violet mono" style={{ height: 20, fontSize: 11 }}>
                            {it.versionMatch}: {it.versionPattern}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`sub-gear${openSettings === it.key ? " on" : ""}`}
                      aria-label={t("subscribe.settings")}
                      aria-expanded={openSettings === it.key}
                      title={t("subscribe.settings")}
                      onClick={() =>
                        setOpenSettings((s) => (s === it.key ? null : it.key))
                      }
                    >
                      <GearIcon />
                    </button>
                    <button
                      type="button"
                      className="sub-x"
                      aria-label={t("subs.remove")}
                      title={t("subs.remove")}
                      onClick={() => removeItem(it.key)}
                    >
                      ×
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {openSettings === it.key && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ paddingTop: 12 }}>
                          <div className="vm-row" role="radiogroup" aria-label={t("subscribe.versionMatch")}>
                            {VMODES.map((m) => (
                              <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={it.versionMatch === m}
                                className={`vm-chip${it.versionMatch === m ? " on" : ""}`}
                                onClick={() =>
                                  patchItem(it.key, {
                                    versionMatch: m,
                                    ...(m === "any" ? { versionPattern: "" } : {}),
                                  })
                                }
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          {it.versionMatch !== "any" && (
                            <input
                              className="mono"
                              style={{ marginTop: 8 }}
                              placeholder={vmPlaceholder(it.versionMatch)}
                              value={it.versionPattern}
                              onChange={(e) =>
                                patchItem(it.key, { versionPattern: e.target.value })
                              }
                              aria-label={t("subscribe.versionPattern")}
                            />
                          )}
                          {it.versionMatch !== "any" && (
                            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 12 }}>
                              {t("subscribe.versionHint")}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>

            {error && <p className="error-text" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              onClick={sendCode}
              disabled={busy || !canSend}
              style={{ width: "100%" }}
            >
              {busy
                ? t("subscribe.requesting")
                : t("subscribe.sendCodeN", { count: items.length })}
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
                <span className="pill violet mono">{firstPkg}</span>
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
              {items.length > 1
                ? t("subscribe.successMulti", { count: items.length })
                : t("subscribe.success", { package: firstPkg })}
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
