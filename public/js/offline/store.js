(() => {
  if (window.PetroDB) return;

  const existing = document.querySelector('script[src="/js/offline/db.js"]');
  if (existing) return;

  const script = document.createElement('script');
  script.src = '/js/offline/db.js';
  script.defer = true;
  document.head.appendChild(script);
})();

