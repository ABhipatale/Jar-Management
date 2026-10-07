// Light / dark / auto (follow the phone) appearance, saved per device.
const KEY = 'rws_theme';
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function isDark(theme = getTheme()) {
  return theme === 'dark' || (theme === 'auto' && Boolean(media?.matches));
}

export function applyTheme(theme = getTheme()) {
  const dark = isDark(theme);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0d12' : '#1d45d8');
  window.dispatchEvent(new CustomEvent('rws:theme', { detail: { theme, dark } }));
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked */
  }
  applyTheme(theme);
}

/** Call once at start-up: applies the saved theme and follows the phone setting in "auto". */
export function initTheme() {
  applyTheme();
  media?.addEventListener?.('change', () => getTheme() === 'auto' && applyTheme());
}
