// Runs before the app bundle so the page never flashes the wrong theme.
// Kept out of index.html because the Content-Security-Policy forbids inline scripts.
try {
  var stored = localStorage.getItem('ph-theme') || 'system';
  var dark = stored === 'dark' || (stored === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {
  /* private window or blocked storage: the default light theme is fine */
}
