import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./i18n";
import "./index.css";

// apply saved theme before first paint.
// "system" (the default) follows the OS prefers-color-scheme.
const savedTheme = localStorage.getItem("pn-theme") || "system";
const resolved =
  savedTheme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : savedTheme;
document.documentElement.setAttribute("data-theme", resolved);

// keep following the OS while in system mode
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if ((localStorage.getItem("pn-theme") || "system") !== "system") return;
  document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", e.matches ? "#171719" : "#f4f4f2");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
