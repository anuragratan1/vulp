import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext.js';

export { useTheme };
export type { ThemeMode };

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const options: { value: ThemeMode; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme selector"
      className="inline-flex items-center p-1 bg-surface-secondary border border-border rounded-full shadow-subtle text-xs font-medium"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            role="radio"
            type="button"
            aria-checked={isActive}
            onClick={() => setTheme(option.value)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all text-xs font-medium ${
              isActive
                ? 'bg-surface-elevated text-text-primary border border-border shadow-sm font-semibold'
                : 'text-text-muted hover:text-text-primary hover:bg-surface/50 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
