document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
});

function initThemeToggle() {
  const themeToggleButton = document.getElementById('theme-toggle');
  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  const lightIcon = document.getElementById('theme-toggle-light-icon');

  if (!themeToggleButton) return;

  const syncIcons = () => {
    const isDark = document.documentElement.classList.contains('dark');

    if (darkIcon) darkIcon.classList.toggle('hidden', isDark);
    if (lightIcon) lightIcon.classList.toggle('hidden', !isDark);
  };

  syncIcons();

  themeToggleButton.addEventListener('click', () => {
    const willUseDark = !document.documentElement.classList.contains('dark');

    document.documentElement.classList.toggle('dark', willUseDark);
    localStorage.setItem('color-theme', willUseDark ? 'dark' : 'light');

    syncIcons();
  });
}