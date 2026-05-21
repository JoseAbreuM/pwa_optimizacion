(() => {
  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.badge = $('sync-status-badge');
    els.dot = $('sync-status-dot');
    els.label = $('sync-status-label');
    els.percent = $('sync-status-percent');
    els.progressWrap = $('sync-status-progress-wrap');
    els.progress = $('sync-status-progress');
  }

  function clampProgress(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(0, Math.min(100, number));
  }

  function setClasses(state) {
    if (!els.badge || !els.dot) return;

    els.badge.className = 'inline-flex max-w-[170px] items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold sm:max-w-none sm:px-3';
    els.dot.className = 'h-2.5 w-2.5 shrink-0 rounded-full';

    if (state === 'ready') {
      els.badge.classList.add(
        'border-emerald-200',
        'bg-emerald-50',
        'text-emerald-700',
        'dark:border-emerald-900',
        'dark:bg-emerald-950',
        'dark:text-emerald-300'
      );
      els.dot.classList.add('bg-emerald-500');
      return;
    }

    if (state === 'loading' || state === 'saving' || state === 'syncing-queue' || state === 'busy' || state === 'online' || state === 'idle-online') {
      els.badge.classList.add(
        'border-sky-200',
        'bg-sky-50',
        'text-sky-700',
        'dark:border-sky-900',
        'dark:bg-sky-950',
        'dark:text-sky-300'
      );
      els.dot.classList.add('bg-sky-500', 'animate-pulse');
      return;
    }

    if (state === 'offline') {
      els.badge.classList.add(
        'border-yellow-200',
        'bg-yellow-50',
        'text-yellow-800',
        'dark:border-yellow-900',
        'dark:bg-yellow-950',
        'dark:text-yellow-300'
      );
      els.dot.classList.add('bg-yellow-500');
      return;
    }

    if (state === 'error') {
      els.badge.classList.add(
        'border-red-200',
        'bg-red-50',
        'text-red-700',
        'dark:border-red-900',
        'dark:bg-red-950',
        'dark:text-red-300'
      );
      els.dot.classList.add('bg-red-500');
      return;
    }

    els.badge.classList.add(
      'border-slate-200',
      'bg-slate-50',
      'text-slate-700',
      'dark:border-slate-700',
      'dark:bg-slate-800',
      'dark:text-slate-200'
    );
    els.dot.classList.add('bg-slate-400');
  }

  function getLabel(detail = {}) {
    const state = detail.state;

    if (state === 'ready') return 'Listo offline';
    if (state === 'loading') return 'Descargando';
    if (state === 'saving') return 'Guardando';
    if (state === 'syncing-queue') return 'Sincronizando';
    if (state === 'offline') return 'Sin conexión';
    if (state === 'error') return 'Error sync';
    if (state === 'queued') return 'Pendiente';
    if (state === 'busy') return 'Sincronizando';
    if (state === 'online') return 'Con conexión';
    if (state === 'idle-online') return 'Preparando';

    return navigator.onLine ? 'Online' : 'Offline';
  }

  function updateProgress(progressValue) {
    const progress = clampProgress(progressValue);

    if (!els.progressWrap || !els.progress || !els.percent) return;

    if (progress === null) {
      els.progressWrap.classList.add('hidden');
      els.percent.classList.add('hidden');
      els.progress.style.width = '0%';
      return;
    }

    els.progressWrap.classList.remove('hidden');
    els.percent.classList.remove('hidden');
    els.percent.textContent = `${Math.round(progress)}%`;
    els.progress.style.width = `${progress}%`;

    if (progress >= 100) {
      window.setTimeout(() => {
        els.progressWrap?.classList.add('hidden');
        els.percent?.classList.add('hidden');
      }, 4000);
    }
  }

  function updateStatus(detail = {}) {
    if (!els.badge) cacheElements();

    if (!els.badge || !els.label) return;

    const state = detail.state || (navigator.onLine ? 'online' : 'offline');

    setClasses(state);

    els.label.textContent = getLabel(detail);

    updateProgress(detail.progress);

    try {
      localStorage.setItem('petro-topbar-sync-status', JSON.stringify({
        state,
        label: els.label.textContent,
        progress: detail.progress ?? null,
        message: detail.message || '',
        updatedAt: new Date().toISOString()
      }));
    } catch (error) {
      // No bloquear si localStorage falla.
    }
  }

  function restoreLastStatus() {
    try {
      const raw = localStorage.getItem('petro-topbar-sync-status');

      if (!raw) {
        updateStatus({
          state: navigator.onLine ? 'online' : 'offline',
          progress: navigator.onLine ? null : 100
        });
        return;
      }

      const parsed = JSON.parse(raw);

      updateStatus({
        state: navigator.onLine ? parsed.state : 'offline',
        progress: parsed.progress,
        message: parsed.message
      });
    } catch (error) {
      updateStatus({
        state: navigator.onLine ? 'online' : 'offline'
      });
    }
  }

  function init() {
    cacheElements();
    restoreLastStatus();

    window.addEventListener('petro:offline-status', (event) => {
      updateStatus(event.detail || {});
    });

    window.addEventListener('petro:offline-updated', (event) => {
      updateStatus({
        state: 'ready',
        progress: 100,
        counts: event.detail?.counts
      });
    });

    window.addEventListener('petro:offline-queue-updated', (event) => {
      const queueLength = event.detail?.queueLength || 0;

      if (queueLength > 0) {
        updateStatus({
          state: 'queued',
          progress: 100,
          message: `Pendientes: ${queueLength}`
        });
      }
    });

    window.addEventListener('online', () => {
      updateStatus({
        state: 'online',
        progress: 5,
        message: 'Conexión recuperada.'
      });
    });

    window.addEventListener('offline', () => {
      updateStatus({
        state: 'offline',
        progress: 100,
        message: 'Usando datos locales.'
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();