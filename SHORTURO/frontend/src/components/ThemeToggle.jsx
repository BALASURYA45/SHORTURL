import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button.jsx";
import { getTheme, toggleTheme } from "../lib/theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());

  useEffect(() => {
    function onStorage(e) {
      if (e.key === "shorturo_theme") setTheme(getTheme());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function onToggle() {
    setTheme(toggleTheme());
  }

  return (
    <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle theme">
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

