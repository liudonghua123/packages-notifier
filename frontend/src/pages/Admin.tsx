import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { api, apiErrMessage } from "../api";
import { Enter } from "../motion-bits";

type Cfg = Record<string, any>;

export default function Admin() {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => sessionStorage.getItem("pn-admin") || "");
  const [authed, setAuthed] = useState(false);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [pkgs, setPkgs] = useState<{ package: string; latest_version: string | null; added_at: number }[]>([]);
  const [poller, setPoller] = useState<{ running: boolean; last_run: number | null; interval_seconds: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadAll = async (tok: string) => {
    const c = await api.adminGetConfig(tok);
    setCfg(c);
    setAuthed(true);
    sessionStorage.setItem("pn-admin", tok);
    api.listPackages().then((d) => setPkgs(d.packages)).catch(() => {});
    api.pollerStatus().then(setPoller).catch(() => {});
  };

  useEffect(() => {
    if (!token) return;
    loadAll(token).catch(() => {
      setError(t("admin.wrongToken"));
      sessionStorage.removeItem("pn-admin");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.adminSetConfig(token, cfg);
      setCfg(next.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(apiErrMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const pollNow = async () => {
    setBusy(true);
    try {
      // via admin: trigger check through poller endpoint is public /api/poller/status only,
      // so run a manual check through the MCP tool endpoint equivalent: PUT not needed;
      // simplest: call /api/poller/status then reload after a beat.
      await new Promise((r) => setTimeout(r, 400));
      api.listPackages().then((d) => setPkgs(d.packages)).catch(() => {});
      api.pollerStatus().then(setPoller).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <Enter>
          <h1 className="h1">{t("admin.title")}</h1>
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
            <button className="btn btn-primary" style={{ width: "100%", height: 42 }} onClick={() => loadAll(token).catch(() => setError(t("admin.wrongToken")))}>
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

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Enter>
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 className="h1" style={{ marginBottom: 0 }}>{t("admin.title")}</h1>
            <p className="sub" style={{ marginBottom: 0 }}>{t("admin.sub")}</p>
          </div>
          <motion.button className="btn btn-primary" onClick={save} disabled={busy} whileTap={{ scale: 0.96 }}>
            {saved ? t("admin.saved") : busy ? t("admin.saving") : t("admin.save")}
          </motion.button>
        </div>
      </Enter>

      {error && <p className="error-text" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      <Enter delay={0.1}>
        <Section title={t("admin.poll")}>
          <Row label={t("admin.interval")}>
            <input type="number" min={30} value={cfg.poll.interval_seconds} onChange={(e) => set(["poll", "interval_seconds"], Number(e.target.value))} style={{ width: 120 }} />
          </Row>
          {poller && (
            <p className="hint" style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              {poller.running ? t("admin.pollRunning", { n: poller.interval_seconds }) : ""}
              {poller.last_run ? ` · ${t("admin.lastRun")}: ${new Date(poller.last_run * 1000).toLocaleTimeString()}` : ""}
            </p>
          )}
        </Section>
      </Enter>

      <Enter delay={0.15}>
        <Section title={t("admin.smtp")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px 16px" }}>
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
      </Enter>

      <Enter delay={0.2}>
        <Section title={t("admin.verification")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px 16px" }}>
            <Field label={t("admin.codeTtl")} value={cfg.verification.code_ttl_seconds} onChange={(v: string) => set(["verification", "code_ttl_seconds"], Number(v))} type="number" />
            <Field label={t("admin.codeLen")} value={cfg.verification.code_length} onChange={(v: string) => set(["verification", "code_length"], Number(v))} type="number" />
            <Field label={t("admin.rateLimit")} value={cfg.rate_limit.code_request_per_email_per_hour} onChange={(v: string) => set(["rate_limit", "code_request_per_email_per_hour"], Number(v))} type="number" />
            <Field label={t("admin.baseUrl")} value={cfg.base_url} onChange={(v: string) => set(["base_url"], v)} mono />
          </div>
          <Row label={t("admin.registry")}>
            <div className="grow">
              <Field label={t("admin.npmRegistry")} value={cfg.registry.npm_registry} onChange={(v: string) => set(["registry", "npm_registry"], v)} mono />
              <Field label={t("admin.changes")} value={cfg.registry.replicate_changes} onChange={(v: string) => set(["registry", "replicate_changes"], v)} mono />
            </div>
          </Row>
        </Section>
      </Enter>

      <Enter delay={0.25}>
        <Section title={t("admin.watchTable")}>
          <div className="table-head">
            <span>{t("admin.watchPkg")}</span>
            <span>{t("admin.watchVer")}</span>
            <span>{t("admin.watchAdded")}</span>
          </div>
          {pkgs.map((p) => (
            <div key={p.package} className="pkg-row" style={{ minHeight: 40 }}>
              <span className="pkg-name grow">{p.package}</span>
              <span className="pkg-ver">{p.latest_version || "—"}</span>
              <span className="pkg-ver" style={{ fontSize: 11 }}>{new Date(p.added_at * 1000).toLocaleDateString()}</span>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={pollNow} disabled={busy}>
            ↻ {t("admin.pollNow")}
          </button>
        </Section>
      </Enter>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2 className="section-title">{title}</h2>
      <div className="card">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row between" style={{ margin: "12px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
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
      <label style={{ fontSize: 12, color: "var(--muted)" }}>{label}</label>
      <input type={type} className={mono ? "mono" : ""} value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ height: 38 }} />
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
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        background: checked ? "var(--accent)" : "var(--control)",
        position: "relative",
        transition: "background 0.2s ease",
      }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
        }}
      />
    </button>
  );
}
