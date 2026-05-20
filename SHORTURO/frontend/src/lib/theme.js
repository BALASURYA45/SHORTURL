const THEME_KEY = "shorturo_theme";

export function getTheme() {
  const t = localStorage.getItem(THEME_KEY);
  if (t === "light" || t === "dark") return t;
  return "light";
}

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  document.documentElement.classList.toggle("light", next === "light");
}

export function toggleTheme() {
  const next = getTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}
