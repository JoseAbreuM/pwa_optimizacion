(() => {
  if (window.PetroDB) return;

  const DB_NAME = 'petrofield-offline';
  const DB_VERSION = 2;
  const STORES = [
    { name: 'metadata', options: { keyPath: 'key' } },
    { name: 'dashboard', options: { keyPath: 'key' } },
    { name: 'pozos', options: { keyPath: 'id' } },
    { name: 'pozo_detalles', options: { keyPath: 'id' } },
    { name: 'parametros', options: { keyPath: 'id' } },
    { name: 'niveles', options: { keyPath: 'id' } },
    { name: 'muestras', options: { keyPath: 'id' } },
    { name: 'bombas', options: { keyPath: 'id' } },
    { name: 'servicios', options: { keyPath: 'id' } },
    { name: 'mapa_pozos', options: { keyPath: 'id' } },
    { name: 'survey', options: { keyPath: 'id' } },
    { name: 'queue', options: { keyPath: 'id', autoIncrement: true } }
  ];

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = event.target.result;

        STORES.forEach((store) => {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, store.options);
          }
        });
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

  async function withStore(storeName, mode, callback) {
    const db = await openDB();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await callback(store);
    await waitTx(tx);
    return result;
  }

  async function put(storeName, value) {
    return withStore(storeName, 'readwrite', (store) => {
      store.put(value);
      return Promise.resolve(value);
    });
  }

  async function putMany(storeName, values = []) {
    if (!Array.isArray(values) || values.length === 0) return [];
    return withStore(storeName, 'readwrite', (store) => {
      values.forEach((value) => store.put(value));
      return Promise.resolve(values);
    });
  }

  async function get(storeName, key) {
    return withStore(storeName, 'readonly', (store) => {
      return new Promise((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    });
  }

  async function getAll(storeName) {
    return withStore(storeName, 'readonly', (store) => {
      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }

  async function deleteEntry(storeName, key) {
    return withStore(storeName, 'readwrite', (store) => {
      store.delete(key);
      return Promise.resolve(true);
    });
  }

  async function clear(storeName) {
    return withStore(storeName, 'readwrite', (store) => {
      store.clear();
      return Promise.resolve(true);
    });
  }

  async function getMetadata(key) {
    const record = await get('metadata', key);
    return record ? record.value : null;
  }

  async function setMetadata(key, value) {
    return put('metadata', { key, value });
  }

  async function addQueueOperation(operation) {
    const payload = {
      ...operation,
      createdAt: operation.createdAt || new Date().toISOString(),
      status: operation.status || 'pending'
    };

    return withStore('queue', 'readwrite', (store) => {
      store.add(payload);
      return Promise.resolve(payload);
    });
  }

  async function getPendingQueue() {
    const all = await getAll('queue');
    return all.filter((item) => item.status !== 'synced');
  }

  async function markQueueOperationSynced(id) {
    const item = await get('queue', id);
    if (!item) return null;
    return put('queue', { ...item, status: 'synced', syncedAt: new Date().toISOString() });
  }

  async function removeQueueOperation(id) {
    return deleteEntry('queue', id);
  }

  window.PetroDB = {
    openDB,
    put,
    putMany,
    get,
    getAll,
    delete: deleteEntry,
    clear,
    getMetadata,
    setMetadata,
    addQueueOperation,
    getPendingQueue,
    markQueueOperationSynced,
    removeQueueOperation
  };
})();
