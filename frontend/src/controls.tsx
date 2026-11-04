import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SunIcon, MoonIcon, SystemIcon } from "./icons";

type ThemeMode = "system" | "dark" | "light";
const KEY = "pn-theme";
const ORDER: ThemeMode[] = ["system", "dark", "light"];

function apply(mode: ThemeMode) {
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#171719" : "#f4f4f2");
}

function currentMode(): ThemeMode {
  return (localStorage.getItem(KEY) as ThemeMode) || "system";
}

export function ThemeLangButtons() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<ThemeMode>(currentMode);

  // sync across tabs / re-mounts
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMode(currentMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const cycleTheme = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    localStorage.setItem(KEY, next);
    apply(next);
  };

  const toggleLang = () => {
    const next = i18n.language.startsWith("zh") ? "en" : "zh";
    i18n.changeLanguage(next);
    localStorage.setItem("pn-lang", next);
  };

  const label =
    mode === "system" ? t("theme.system") : mode === "dark" ? t("theme.dark") : t("theme.light");

  return (
    <div className="row" style={{ gap: 4 }}>
      <button className="icon-btn" onClick={toggleLang} aria-label="language" title={t("lang.toggle")}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>{t("lang.toggle")}</span>
      </button>
      <button
        className="icon-btn theme-cycle"
        onClick={cycleTheme}
        aria-label={t("theme.toggle")}
        title={`${t("theme.toggle")}: ${label}`}
        data-mode={mode}
      >
        {mode === "system" ? <SystemIcon /> : mode === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}
