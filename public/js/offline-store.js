if (!window.PetroOfflineStore) {
  const script = document.createElement('script');
  script.src = '/js/offline/db.js';
  script.defer = true;
  document.head.appendChild(script);
}

