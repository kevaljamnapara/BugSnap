import { useState, useEffect } from 'react';
import { ThemeMode, getThemePreference, setThemePreference, applyTheme } from './theme';

const ICONS: Record<ThemeMode, string> = {
  system: '◑',
  light: '☀',
  dark: '☾',
};

const LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const CYCLE: ThemeMode[] = ['system', 'light', 'dark'];

export function ThemeSwitcher({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    getThemePreference().then(setMode);
  }, []);

  const handleCycle = async () => {
    const nextIdx = (CYCLE.indexOf(mode) + 1) % CYCLE.length;
    const next = CYCLE[nextIdx];
    setMode(next);
    applyTheme(next);
    await setThemePreference(next);
  };

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm ${className ?? ''}`}
      onClick={handleCycle}
      aria-label={`Theme: ${LABELS[mode]}. Click to change.`}
      title={`Theme: ${LABELS[mode]}`}
      data-testid="theme-switcher-btn"
    >
      <span aria-hidden="true">{ICONS[mode]}</span>
      <span>{LABELS[mode]}</span>
    </button>
  );
}
