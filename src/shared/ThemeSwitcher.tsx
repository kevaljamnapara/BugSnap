import { useState, useEffect } from 'react';
import { ThemeMode, getThemePreference, setThemePreference, applyTheme } from './theme';
import { IconSystem, IconSun, IconMoon } from './icons';

const LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const CYCLE: ThemeMode[] = ['system', 'light', 'dark'];

export function ThemeSwitcher({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
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

  const renderIcon = () => {
    switch (mode) {
      case 'light':
        return <IconSun size={14} />;
      case 'dark':
        return <IconMoon size={14} />;
      case 'system':
      default:
        return <IconSystem size={14} />;
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-secondary btn-sm ${className ?? ''}`}
      onClick={handleCycle}
      aria-label={`Theme: ${LABELS[mode]}`}
      title={`Theme: ${LABELS[mode]}`}
      data-testid="theme-switcher-btn"
    >
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {renderIcon()}
      </span>
      {!iconOnly && <span>{LABELS[mode]}</span>}
    </button>
  );
}

