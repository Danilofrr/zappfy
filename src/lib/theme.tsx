import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children, defaultTheme = "dark" }: { children: ReactNode; defaultTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = (localStorage.getItem("lt-theme") as Theme | null) ?? defaultTheme;
    setThemeState(saved);
  }, [defaultTheme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    if (typeof window !== "undefined") localStorage.setItem("lt-theme", theme);
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setThemeState((t) => (t === "dark" ? "light" : "dark")), setTheme: setThemeState }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar tema"
      className={`grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
