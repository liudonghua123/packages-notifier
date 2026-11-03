import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ThemeLangButtons() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark"
      );
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("pn-theme", next);
  };

  const toggleLang = () => {
    const next = i18n.language.startsWith("zh") ? "en" : "zh";
    i18n.changeLanguage(next);
    localStorage.setItem("pn-lang", next);
  };

  return (
    <div className="row" style={{ gap: 4 }}>
      <button className="icon-btn" onClick={toggleLang} aria-label="language" title={t("lang.toggle")}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>{t("lang.toggle")}</span>
      </button>
      <button className="icon-btn" onClick={toggleTheme} aria-label={t("theme.toggle")} title={t("theme.toggle")}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
