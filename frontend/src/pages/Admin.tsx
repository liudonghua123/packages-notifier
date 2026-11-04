import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { EcoPill } from "./Subscribe";
import { Enter } from "../motion-bits";

type Cfg = Record<string, any>;
type Eco = { type: string; label: string; interval_seconds: number };
type Pkg = {
  package: string;
  latest_version: string | null;
  added_at: number;
  package_type?: string;
  description?: string | null;
};

const TABS = ["general", "ecosystems", "smtp", "security", "watched"] as const;
type Tab = (typeof TABS)[number];

export default function Admin() {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => sessionStorage.getItem("pn-admin") || "");
  const [authed, setAuthed] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [savedCfg, setSavedCfg] = useState<Cfg | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [ecos, setEcos] = useState<Eco[]>([]);
  const [poller, setPoller] = useState<{
    running: boolean;
    last_run: number | null;
    last_error: string | null;
    interval_seconds: number;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  const loadAll = async (tok: string) => {
    const c = await api.adminGetConfig(tok);
    setCfg(c);
    setSavedCfg(c);
    setAuthed(true);
    sessionStorage.setItem("pn-admin", tok);
    api.listPackages().then((d) => setPkgs(d.packages)).catch(() => {});
    api.pollerStatus().then(setPoller).catch(() => {});
    api.listEcosystems().then((d) => setEcos(d.ecosystems)).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    loadAll(token).catch(() => {
      setError(t("admin.wrongToken"));
      sessionStorage.removeItem("pn-admin");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => {
    if (!cfg || !savedCfg) return false;
    return JSON.stringify(cfg) !== JSON.stringify(savedCfg);
  }, [cfg, savedCfg]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.adminSetConfig(token, cfg);
      setCfg(next.config);
      setSavedCfg(next.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const checkNow = async () => {
    setBusy(true);
    setCheckMsg("");
    try {
      const r = await api.pollerCheckNow();
      setCheckMsg(t("admin.checkDone", { n: r.updates }));
      api.listPackages().then((d) => setPkgs(d.packages)).catch(() => {});
      api.pollerStatus().then(setPoller).catch(() => {});
      setTimeout(() => setCheckMsg(""), 4000);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <Enter>
          <h1 className="h1" style={{ fontSize: "clamp(30px, 6vw, 48px)" }}>
            <span className="grad">{t("admin.title")}</span>
          </h1>
          <p className="sub">{t("admin.tokenHint")}</p>
          <div className="card">
            <div className="field">
              <label htmlFor="admin-token">{t("admin.token")}</label>
              <input
                id="admin-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadAll(token).catch(() => setError(t("admin.wrongToken")))}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => loadAll(token).catch(() => setError(t("admin.wrongToken")))}>
              {t("admin.login")}
            </button>
          </div>
        </Enter>
      </div>
    );
  }

  if (!cfg) return null;

  const set = (path: string[], value: any) => {
    setCfg((c) => {
      const next = structuredClone(c!);
      let node = next;
      for (const p of path.slice(0, -1)) node = node[p];
      node[path[path.length - 1]] = value;
      return next;
    });
  };

  const smtpOn = !!cfg.smtp?.host;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingBottom: 96 }}>
      <Enter>
        <div className="row between" style={{ flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 className="h1" style={{ fontSize: "clamp(30px, 6vw, 48px)", marginBottom: 0 }}>
              <span className="grad">{t("admin.title")}</span>
            </h1>
            <p className="sub" style={{ marginBottom: 0 }}>{t("admin.sub")}</p>
          </div>
        </div>
      </Enter>

      {/* tabs */}
      <Enter delay={0.08}>
        <div className="admin-tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`admin-tab${tab === id ? " on" : ""}`}
              onClick={() => setTab(id)}
            >
              {id === "ecosystems" && poller?.running && <span className="admin-tab-dot" />}
              {t(`admin.tab${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          ))}
        </div>
      </Enter>

      {error && <p className="error-text" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          style={{ marginTop: 20 }}
        >
          {tab === "general" && (
            <>
              <Section title={t("admin.poll")} color="var(--accent)">
                <Row label={t("admin.interval")}>
                  <input type="number" min={30} value={cfg.poll.interval_seconds} onChange={(e) => set(["poll", "interval_seconds"], Number(e.target.value))} style={{ width: 140 }} />
                </Row>
                {poller && (
                  <div className="admin-status-row">
                    <StatusDot ok={poller.running && !poller.last_error} />
                    <span>
                      {poller.running ? t("admin.pollRunning", { n: poller.interval_seconds }) : "—"}
                      {poller.last_run ? ` · ${t("admin.lastRun")}: ${new Date(poller.last_run * 1000).toLocaleTimeString()}` : ""}
                    </span>
                    <span style={{ marginLeft: "auto", color: poller.last_error ? "var(--negative)" : "var(--muted)", fontSize: 12 }}>
                      {poller.last_error ? `${t("admin.lastError")}: ${poller.last_error}` : t("admin.noError")}
                    </span>
                  </div>
                )}
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn-ghost" onClick={checkNow} disabled={busy}>
                    ↻ {t("admin.pollNow")}
                  </button>
                  {checkMsg && <span style={{ color: "var(--positive)", fontSize: 13 }}>{checkMsg}</span>}
                </div>
              </Section>

              <Section title={t("admin.baseUrl")} color="var(--accent-4)">
                <Field label={t("admin.baseUrl")} value={cfg.base_url} onChange={(v: string) => set(["base_url"], v)} mono />
              </Section>
            </>
          )}

          {tab === "ecosystems" && (
            <Section title={t("admin.ecosystems")} color="var(--accent-5)">
              <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
                {t("admin.ecosystemsHint")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px 24px" }}>
                {(cfg.ecosystems?.interval_overrides ? Object.keys(cfg.ecosystems.interval_overrides) : []).map((eco) => (
                  <Field
                    key={eco}
                    label={`${ecos.find((e) => e.type === eco)?.label || eco}`}
                    value={cfg.ecosystems.interval_overrides[eco]}
                    onChange={(v: string) => set(["ecosystems", "interval_overrides", eco], Number(v))}
                    type="number"
                  />
                ))}
              </div>
            </Section>
          )}

          {tab === "smtp" && (
            <Section title={t("admin.smtp")} color="var(--accent-2)">
              <div className="admin-status-row" style={{ marginBottom: 16 }}>
                <StatusDot ok={smtpOn} />
                <span style={{ color: smtpOn ? "var(--positive)" : "var(--warning)", fontWeight: 600 }}>
                  {smtpOn ? t("admin.smtpOn") : t("admin.smtpOff")}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px 24px" }}>
                <Field label={t("admin.host")} value={cfg.smtp.host} onChange={(v: string) => set(["smtp", "host"], v)} mono />
                <Field label={t("admin.port")} value={cfg.smtp.port} onChange={(v: string) => set(["smtp", "port"], Number(v))} type="number" />
                <Field label={t("admin.user")} value={cfg.smtp.username} onChange={(v: string) => set(["smtp", "username"], v)} />
                <Field label={t("admin.pass")} value={cfg.smtp.password} onChange={(v: string) => set(["smtp", "password"], v)} type="password" />
                <Field label={t("admin.from")} value={cfg.smtp.from_addr} onChange={(v: string) => set(["smtp", "from_addr"], v)} mono />
                <Field label={t("admin.fromName")} value={cfg.smtp.from_name} onChange={(v: string) => set(["smtp", "from_name"], v)} />
              </div>
              <Row label={t("admin.tls")}>
                <Toggle checked={cfg.smtp.use_tls} onChange={(v: boolean) => set(["smtp", "use_tls"], v)} />
              </Row>
            </Section>
          )}

          {tab === "security" && (
            <Section title={t("admin.verification")} color="var(--accent-3)">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px 24px" }}>
                <Field label={t("admin.codeTtl")} value={cfg.verification.code_ttl_seconds} onChange={(v: string) => set(["verification", "code_ttl_seconds"], Number(v))} type="number" />
                <Field label={t("admin.queryVerifyTtl")} value={cfg.verification.query_verify_ttl_seconds} onChange={(v: string) => set(["verification", "query_verify_ttl_seconds"], Number(v))} type="number" />
                <Field label={t("admin.codeLen")} value={cfg.verification.code_length} onChange={(v: string) => set(["verification", "code_length"], Number(v))} type="number" />
                <Field label={t("admin.rateLimit")} value={cfg.rate_limit.code_request_per_email_per_hour} onChange={(v: string) => set(["rate_limit", "code_request_per_email_per_hour"], Number(v))} type="number" />
              </div>
              <Row label={t("admin.registry")}>
                <div className="grow">
                  <Field label={t("admin.npmRegistry")} value={cfg.registry.npm_registry} onChange={(v: string) => set(["registry", "npm_registry"], v)} mono />
                  <Field label={t("admin.changes")} value={cfg.registry.replicate_changes} onChange={(v: string) => set(["registry", "replicate_changes"], v)} mono />
                </div>
              </Row>
            </Section>
          )}

          {tab === "watched" && (
            <Section title={t("admin.watchTable")} color="var(--accent-4)">
              {pkgs.length === 0 && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>—</p>
              )}
              {pkgs.map((p) => (
                <div key={p.package} className="pkg-row" style={{ minHeight: 48, flexWrap: "wrap" }}>
                  <div className="grow" style={{ minWidth: 160 }}>
                    <div className="pkg-name" style={{ wordBreak: "break-all" }}>{p.package}</div>
                    <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      <EcoPill type={p.package_type || "npm"} />
                      {p.description && (
                        <span style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                          {p.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="pkg-ver">{p.latest_version || "—"}</span>
                  <span className="pkg-ver" style={{ fontSize: 12 }}>{new Date(p.added_at * 1000).toLocaleDateString()}</span>
                </div>
              ))}
            </Section>
          )}
        </motion.div>
      </AnimatePresence>

      {/* sticky save bar */}
      <AnimatePresence>
        {(dirty || saved) && (
          <motion.div
            className="admin-savebar"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {saved ? (
              <span style={{ color: "var(--positive)", fontWeight: 700 }}>✓ {t("admin.saved")}</span>
            ) : (
              <>
                <span style={{ color: "var(--warning)", fontWeight: 600, fontSize: 13 }}>● {t("admin.dirty")}</span>
                <motion.button className="btn btn-primary" onClick={save} disabled={busy} whileTap={{ scale: 0.96 }}>
                  {busy ? t("admin.saving") : t("admin.save")}
                </motion.button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className="admin-status-dot"
      style={{
        background: ok ? "var(--positive)" : "var(--warning)",
        boxShadow: `0 0 8px ${ok ? "var(--positive)" : "var(--warning)"}`,
      }}
    />
  );
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color: string }) {
  return (
    <div>
      <h2 className="section-title" style={{ color }}>{title}</h2>
      <div className="card" style={{ borderTop: `3px solid ${color}` }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row between" style={{ margin: "16px 0", flexWrap: "wrap", gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>{label}</label>
      <input type={type} className={mono ? "mono" : ""} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        border: "none",
        background: checked ? "linear-gradient(120deg, var(--accent), var(--accent-2))" : "var(--overlay)",
        position: "relative",
        transition: "background 0.5s cubic-bezier(0.32,0.72,0,1)",
        flex: "none",
      }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        style={{
          position: "absolute",
          top: 4,
          left: checked ? 24 : 4,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      />
    </button>
  );
}
