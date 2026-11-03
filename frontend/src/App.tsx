import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "motion/react";
import Home from "./pages/Home";
import { ThemeLangButtons } from "./controls";
import { HomeIcon, SearchIcon, ListIcon, GearIcon } from "./icons";

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
      <div className="aurora" aria-hidden="true">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
        <span className="a4" />
      </div>

      <header className="topbar">
        <NavLink to="/" className="brand">
          <Logo />
          packages-notifier
        </NavLink>
        <nav className="topnav" aria-label="primary">
          {navItems.slice(1).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {({ isActive }) => (
                <span className={isActive ? "active" : ""} style={{ display: "block" }}>
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
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
              <>
                {isActive && <span className="nav-dot" />}
                <span
                  className={isActive ? "active" : ""}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <BottomIcon name={item.to} />
                  {item.label}
                </span>
              </>
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
        style={{ color: "var(--muted)", fontSize: 14 }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        loading…
      </motion.span>
    </div>
  );
}

/* Animated logo: a package box emitting notification pulse rings.
   Gradient stroke follows the brand spectrum; box gently bobs,
   rings ripple outward, dot blinks like a live notification. */
function Logo() {
  return (
    <svg className="logo" width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lg-stroke" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="0.5" stopColor="#ff6c9d" />
          <stop offset="1" stopColor="#ffb84d" />
        </linearGradient>
      </defs>
      {/* ripple rings */}
      <circle className="logo-ring r1" cx="19" cy="7" r="4" stroke="url(#lg-stroke)" strokeWidth="1.4" />
      <circle className="logo-ring r2" cx="19" cy="7" r="4" stroke="url(#lg-stroke)" strokeWidth="1.4" />
      {/* notification dot */}
      <circle className="logo-dot" cx="19" cy="7" r="2.2" fill="#ff6c9d" />
      {/* package box */}
      <g className="logo-box">
        <path d="M4 9.5 11 6l7 3.5v7L11 20l-7-3.5v-7Z" stroke="url(#lg-stroke)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M4 9.5 11 13l7-3.5M11 13v7" stroke="url(#lg-stroke)" strokeWidth="1.8" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function BottomIcon({ name }: { name: string }) {
  switch (name) {
    case "/":
      return <HomeIcon />;
    case "/query":
      return <SearchIcon />;
    case "/subscriptions":
      return <ListIcon />;
    case "/admin":
      return <GearIcon />;
    default:
      return null;
  }
}
