// Apply the saved theme before first paint to avoid a flash of the wrong theme.
try {
  var t = localStorage.getItem('hub-theme');
  var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
