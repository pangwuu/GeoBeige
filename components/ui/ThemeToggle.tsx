"use client";

import { Sun, Moon } from "lucide-react";
import { cn } from "@/components/ui";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-xl bg-surface border border-surface-border backdrop-blur-md hover:border-primary/50 transition-all flex items-center justify-center text-muted hover:text-primary shadow-xl",
        className
      )}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
