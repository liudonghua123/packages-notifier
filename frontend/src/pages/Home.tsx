import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { api } from "../api";
import { Enter, Stagger, StaggerItem } from "../motion-bits";
import { EcoPill } from "./Subscribe";
import { SearchIcon, MailIcon, CheckIcon } from "../icons";

const RAINBOW = ["var(--accent)", "var(--accent-2)", "var(--accent-3)", "var(--accent-4)", "var(--accent-5)"];

const REGISTRIES = ["npm", "pypi", "crates", "go", "rubygems", "maven", "nuget"];

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
          <span className="grad">{t("home.title")}</span>
          <br />
          <span className="rainbow">{t("home.titleAccent")}</span>
        </h1>
        <p className="sub">{t("home.sub")}</p>
      </Enter>

      <Stagger className="row" style={{ flexWrap: "wrap", gap: 16, marginBottom: 48 }}>
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

      <TaglineReveal
        words={[
          { text: "every", rainbow: true },
          { text: "registry,", rainbow: true },
          { text: "every" },
          { text: "release" },
          { text: "→" },
          { text: "your", rainbow: true },
          { text: "inbox.", rainbow: true },
        ]}
        zhWords={[
          { text: "各大仓库", rainbow: true },
          { text: "一有风吹草动，" },
          { text: "邮件", rainbow: true },
          { text: "立刻到达。", rainbow: true },
        ]}
      />

      {/* registry badge wall */}
      <Enter delay={0.15}>
        <section className="home-section">
          <h2 className="section-title">{t("home.registriesTitle")}</h2>
          <p className="section-sub">{t("home.registriesSub")}</p>
          <div className="home-registries">
            {REGISTRIES.map((r, i) => (
              <motion.span
                key={r}
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 20 }}
              >
                <EcoPill type={r} />
              </motion.span>
            ))}
          </div>
        </section>
      </Enter>

      <Stagger
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginTop: 48,
        }}
      >
        <StatCard value={stats.pkgs} label={t("home.stats.watched")} color="var(--accent)" delay={0} />
        <StatCard value={stats.subs} label={t("home.stats.subscribers")} color="var(--accent-2)" delay={0.08} />
        <StatCard value={stats.notified} label={t("home.stats.notified")} color="var(--accent-3)" delay={0.16} />
      </Stagger>

      {/* feature cards */}
      <Enter delay={0.2}>
        <section className="home-section" style={{ marginTop: 56 }}>
          <h2 className="section-title">{t("home.featuresTitle")}</h2>
          <div className="home-cards">
            {(["multiEco", "rules", "noAccount"] as const).map((k, i) => (
              <motion.div
                key={k}
                className="card home-feature"
                style={{ borderTop: `3px solid ${RAINBOW[i % RAINBOW.length]}` }}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              >
                <h3>{t(`home.features.${i}.title`)}</h3>
                <p>{t(`home.features.${i}.desc`)}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </Enter>

      {/* how it works */}
      <Enter delay={0.25}>
        <section className="home-section" style={{ marginTop: 56 }}>
          <h2 className="section-title">{t("home.stepsTitle")}</h2>
          <div className="home-steps">
            {([SearchIcon, MailIcon, CheckIcon] as const).map((Icon, i) => (
              <motion.div
                key={i}
                className="home-step"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              >
                <span className="home-step-num mono" style={{ color: RAINBOW[i % RAINBOW.length] }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="home-step-icon" style={{ color: RAINBOW[i % RAINBOW.length] }}>
                  <Icon />
                </span>
                <div className="grow">
                  <h3>{t(`home.steps.${i}.title`)}</h3>
                  <p>{t(`home.steps.${i}.desc`)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </Enter>

      {/* live example */}
      <Enter delay={0.3}>
        <div className="card" style={{ marginTop: 48 }}>
          <p className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>
            {t("home.example")}
          </p>
          <div className="pkg-row" style={{ minHeight: 48 }}>
            <span className="pkg-name">vite</span>
            <EcoPill type="npm" />
            <span className="grow" />
            <span className="pill positive mono">8.3.5</span>
          </div>
          <div className="pkg-row" style={{ minHeight: 48 }}>
            <span className="pkg-name">requests</span>
            <EcoPill type="pypi" />
            <span className="grow" />
            <span className="pill positive mono">2.34.2</span>
          </div>
          <div className="pkg-row" style={{ minHeight: 48 }}>
            <span className="pkg-name">serde</span>
            <EcoPill type="crates" />
            <span className="grow" />
            <span className="pill positive mono">1.0.229</span>
          </div>
        </div>
      </Enter>

      {/* MCP callout */}
      <Enter delay={0.35}>
        <div className="card home-mcp" style={{ marginTop: 32 }}>
          <div className="home-mcp-badge mono">MCP</div>
          <div className="grow">
            <h3 style={{ margin: "0 0 6px" }}>{t("home.mcpTitle")}</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>{t("home.mcpDesc")}</p>
          </div>
        </div>
      </Enter>

      <Enter delay={0.4}>
        <p className="sub" style={{ marginTop: 48, fontSize: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
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

/** B11 tagline reveal: words activate one by one as they scroll into view. */
function TaglineReveal({
  words,
  zhWords,
}: {
  words: { text: string; rainbow?: boolean }[];
  zhWords: { text: string; rainbow?: boolean }[];
}) {
  const { i18n } = useTranslation();
  const ref = useRef<HTMLParagraphElement>(null);
  const list = i18n.language.startsWith("zh") ? zhWords : words;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = el.querySelectorAll<HTMLSpanElement>(".w");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          spans.forEach((s, i) => {
            setTimeout(() => s.classList.add("on"), i * 110);
          });
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list]);

  return (
    <p className="tagline" ref={ref} style={{ margin: "64px 0" }}>
      {list.map((w, i) => (
        <span
          key={i}
          className={`w${w.rainbow ? " rainbow" : ""}`}
          style={w.rainbow ? ({ "--w": RAINBOW[i % RAINBOW.length] } as React.CSSProperties) : undefined}
        >
          {w.text}{" "}
        </span>
      ))}
    </p>
  );
}

function StatCard({ value, label, color, delay }: { value: number; label: string; color: string; delay: number }) {
  return (
    <StaggerItem>
      <motion.div
        className="card"
        style={{ padding: 24, borderTop: `3px solid ${color}` }}
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      >
        <motion.div
          className="mono num"
          style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color }}
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.2, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          {value}
        </motion.div>
        <div style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{label}</div>
      </motion.div>
    </StaggerItem>
  );
}
