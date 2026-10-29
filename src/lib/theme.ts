export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'folio-theme';

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Runs in the document head before paint. Storage may be unavailable in private browsers.
export const themeInitializationScript = `(() => {
  let theme = 'light';
  try {
    if (localStorage.getItem('${THEME_STORAGE_KEY}') === 'dark') theme = 'dark';
  } catch {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
})();`;
