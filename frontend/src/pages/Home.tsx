import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { api } from "../api";
import { Enter, Stagger, StaggerItem } from "../motion-bits";

export default function Home() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ pkgs: 0, subs: 0, notified: 0 });

  useEffect(() => {
    api
      .listPackages()
      .then((d) => setStats((s) => ({ ...s, pkgs: d.packages.length })))
      .catch(() => {});
  }, []);

  return (
    <div>
      <Enter>
        <h1 className="h1">
          {t("home.title")}
          <br />
          <span style={{ color: "var(--accent)" }}>{t("home.titleAccent")}</span>
        </h1>
        <p className="sub" style={{ maxWidth: 560 }}>
          {t("home.sub")}
        </p>
      </Enter>

      <Stagger className="row" style={{ flexWrap: "wrap", gap: 12, marginBottom: 32 }}>
        <StaggerItem>
          <Link to="/subscribe" className="btn btn-primary" style={{ textDecoration: "none" }}>
            {t("home.cta")} →
          </Link>
        </StaggerItem>
        <StaggerItem>
          <Link to="/query" className="btn btn-ghost" style={{ textDecoration: "none" }}>
            {t("home.queryCta")}
          </Link>
        </StaggerItem>
      </Stagger>

      <Stagger
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <StatCard value={stats.pkgs} label={t("home.stats.watched")} delay={0} />
        <StatCard value={stats.subs} label={t("home.stats.subscribers")} delay={0.08} />
        <StatCard value={stats.notified} label={t("home.stats.notified")} delay={0.16} />
      </Stagger>

      <Enter delay={0.3}>
        <div className="card" style={{ marginTop: 24 }}>
          <p className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>
            {t("home.example")}
          </p>
          <div className="pkg-row" style={{ borderBottom: "none", minHeight: 44 }}>
            <span className="pkg-name">@cloudflare/vite-plugin</span>
            <span className="grow" />
            <span className="pill positive mono">v1.67.0</span>
          </div>
        </div>
      </Enter>

      <Enter delay={0.4}>
        <p
          className="sub"
          style={{ marginTop: 32, fontSize: 12, display: "flex", gap: 16, flexWrap: "wrap" }}
        >
          <span>{t("footer.made")}</span>
          <span>·</span>
          <span>{t("footer.mcp")}</span>
          <span>·</span>
          <a href="https://replicate.npmjs.com/registry/_changes" target="_blank" rel="noreferrer">
            replicate.npmjs.com
          </a>
        </p>
      </Enter>
    </div>
  );
}

function StatCard({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <StaggerItem>
      <motion.div
        className="card"
        style={{ padding: 16 }}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <motion.div
          className="mono"
          style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.2, duration: 0.4 }}
        >
          {value}
        </motion.div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      </motion.div>
    </StaggerItem>
  );
}
