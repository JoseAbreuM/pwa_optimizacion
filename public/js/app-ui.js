if (!window.PetroSync) {
  ['/js/core/ui.js', '/js/offline/sync.js', '/js/modules/pozos.js', '/js/core/app.js'].forEach(src => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  });
}

