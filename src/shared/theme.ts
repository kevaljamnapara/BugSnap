export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'bugsnap_theme';

/** Resolve the effective theme (light or dark) from a ThemeMode preference. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

/** Read the persisted theme preference. Falls back to 'system'. */
export async function getThemePreference(): Promise<ThemeMode> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const value = result[STORAGE_KEY];
      if (value === 'light' || value === 'dark' || value === 'system') return value;
    }
  } catch {
    // fall through to localStorage
  }
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // storage unavailable
  }
  return 'system';
}

/** Persist the theme preference. */
export async function setThemePreference(mode: ThemeMode): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: mode });
    }
  } catch {
    // fall through
  }
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // storage unavailable
  }
}

/** Apply the resolved theme to the document root. */
export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
}

/** Initialize theme on page load — call once from entry point. */
export async function initTheme(): Promise<ThemeMode> {
  const pref = await getThemePreference();
  applyTheme(pref);

  // Listen for system changes when set to 'system'
  if (pref === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mql.addEventListener('change', handler);
  }

  return pref;
}
