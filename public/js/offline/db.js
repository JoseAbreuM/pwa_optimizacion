(() => {
  if (window.PetroOfflineStore) return;

  const dbName = 'petrofield-offline';
  const dbVersion = 1;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);

      request.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('bootstrap')) {
          db.createObjectStore('bootstrap', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function waitTx(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
    });
  }

  async function saveBootstrap(data) {
    const db = await openDb();
    const tx = db.transaction('bootstrap', 'readwrite');
    tx.objectStore('bootstrap').put({ id: 'latest', data, savedAt: Date.now() });
    return waitTx(tx);
  }

  async function getBootstrap() {
    const db = await openDb();
    const tx = db.transaction('bootstrap', 'readonly');
    const store = tx.objectStore('bootstrap');

    return new Promise(resolve => {
      const req = store.get('latest');
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  }

  async function enqueueOperation(operation) {
    const db = await openDb();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ ...operation, createdAt: Date.now() });
    return waitTx(tx);
  }

  async function getQueue() {
    const db = await openDb();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');

    return new Promise(resolve => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function clearQueueItem(id) {
    const db = await openDb();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(id);
    return waitTx(tx);
  }

  window.PetroOfflineStore = {
    saveBootstrap,
    getBootstrap,
    enqueueOperation,
    getQueue,
    clearQueueItem
  };
})();
