import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SunIcon, MoonIcon } from "./icons";

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
