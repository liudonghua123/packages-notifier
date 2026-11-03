import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "motion/react";
import Home from "./pages/Home";
import { ThemeLangButtons } from "./controls";

const Query = lazy(() => import("./pages/Query"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  const { t } = useTranslation();

  const navItems = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/query", label: t("nav.query") },
    { to: "/subscriptions", label: t("nav.subscriptions") },
    { to: "/admin", label: t("nav.admin") },
  ];

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="dot">▮</span>
          packages<span style={{ color: "var(--muted)" }}>-</span>notifier
        </NavLink>
        <nav className="row topnav" style={{ gap: 4, marginLeft: 16 }} aria-label="primary">
          {navItems.slice(1).map((item) => (
            <NavLink key={item.to} to={item.to} className="tab" style={{ textDecoration: "none" }}>
              {({ isActive }) => <span className={isActive ? "tab active" : "tab"} style={{ padding: "10px 8px 12px", display: "inline-block" }}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <span className="topbar-spacer" />
        <ThemeLangButtons />
      </header>

      <main className="main">
        <Suspense fallback={<Fall />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/query" element={<Query />} />
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="bottombar" aria-label="mobile">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {({ isActive }) => (
              <span className={isActive ? "active" : ""} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <BottomIcon name={item.to} />
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Fall() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
      <motion.span
        className="mono"
        style={{ color: "var(--muted)", fontSize: 13 }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        loading…
      </motion.span>
    </div>
  );
}

function BottomIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "/":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case "/query":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
    case "/subscriptions":
      return <svg {...common}><path d="M4 5h16M4 12h16M4 19h10" /></svg>;
    case "/admin":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" /></svg>;
    default:
      return null;
  }
}
