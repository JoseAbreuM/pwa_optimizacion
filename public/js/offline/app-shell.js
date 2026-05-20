(() => {
  const state = {
    route: 'dashboard',
    pozos: [],
    filters: {
      search: '',
      area: '',
      estado: '',
      categoria: ''
    }
  };

  const els = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return String(value ?? '—')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function formatNumber(value, decimals = 2) {
    const number = Number(value);

    if (!Number.isFinite(number)) return '—';

    return number.toLocaleString('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  function formatDate(value) {
    if (!value) return '—';

    const text = String(value);

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      const [year, month, day] = text.slice(0, 10).split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toLocaleDateString('es-VE');
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString('es-VE');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showAlert(message, type = 'info') {
    if (!els.alert) return;

    const classes = {
      info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
      warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
      error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
    };

    els.alert.className = `mb-4 rounded-2xl border p-4 text-sm ${classes[type] || classes.info}`;
    els.alert.textContent = message;
    els.alert.classList.remove('hidden');
  }

  function hideAlert() {
    els.alert?.classList.add('hidden');
  }

  function setRoute(route) {
    state.route = route;

    $all('[data-offline-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.offlineRoute === route);
    });

    const titles = {
      dashboard: 'Dashboard',
      pozos: 'Pozos',
      diagnostico: 'Datos locales'
    };

    setText('offline-page-title', titles[route] || 'PetroField');

    if (route === 'dashboard') renderDashboard();
    if (route === 'pozos') renderPozos();
    if (route === 'diagnostico') renderDiagnostico();
  }

  function getPozoEstado(pozo) {
    return pozo.estado || pozo.estado_nombre || pozo.estado_pozo || '—';
  }

  function getPozoMetodo(pozo) {
    return pozo.metodo_levantamiento || pozo.metodo || pozo.metodo_nombre || '—';
  }

  function isActivo(pozo) {
    const estado = normalizeText(getPozoEstado(pozo));
    return estado === 'activo' || estado.includes('activo');
  }

  function getDashboardKpis(pozos) {
    const total = pozos.length;
    const activos = pozos.filter(isActivo).length;

    const espera = pozos.filter((pozo) => {
      const estado = normalizeText(getPozoEstado(pozo));
      return estado.includes('espera');
    }).length;

    const servicio = pozos.filter((pozo) => {
      const estado = normalizeText(getPozoEstado(pozo));
      return estado.includes('servicio');
    }).length;

    const potencial = pozos
      .filter(isActivo)
      .reduce((sum, pozo) => sum + (Number(pozo.potencial) || 0), 0);

    return {
      total,
      activos,
      espera,
      servicio,
      potencial
    };
  }

  function card(title, value, subtitle = '') {
    return `
      <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(title)}</p>
        <p class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">${escapeHTML(value)}</p>
        ${subtitle ? `<p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${escapeHTML(subtitle)}</p>` : ''}
      </article>
    `;
  }

  async function renderDashboard() {
    hideAlert();

    const resumen = await window.PetroOfflineStore.getResumen();
    const pozos = resumen.pozos || [];
    const kpis = getDashboardKpis(pozos);

    const byArea = pozos.reduce((acc, pozo) => {
      const area = pozo.area || 'Sin área';
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {});

    const areaRows = Object.entries(byArea)
      .sort((a, b) => b[1] - a[1])
      .map(([area, count]) => `
        <tr class="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
          <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white">${escapeHTML(area)}</td>
          <td class="px-4 py-3 text-right text-slate-600 dark:text-slate-300">${count}</td>
        </tr>
      `)
      .join('');

    els.view.innerHTML = `
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        ${card('Total pozos', kpis.total)}
        ${card('Activos', kpis.activos)}
        ${card('En espera', kpis.espera)}
        ${card('En servicio', kpis.servicio)}
        ${card('Potencial activo', formatNumber(kpis.potencial, 2))}
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Resumen offline</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Datos leídos desde IndexedDB.</p>
            </div>

            <button type="button" data-offline-route="pozos"
              class="rounded-full bg-[#033F73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#022f56]">
              Ver pozos
            </button>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            ${card('Parámetros', resumen.counts?.parametros || 0, 'Registros locales')}
            ${card('Niveles', resumen.counts?.niveles || 0, 'Tomas locales')}
            ${card('Bombas', resumen.counts?.bombas || 0, 'Historial local')}
            ${card('Pendientes', resumen.pendientesSync || 0, 'Por sincronizar')}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Pozos por área</h3>

          <div class="max-h-[320px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th class="px-4 py-3 text-left">Área</th>
                  <th class="px-4 py-3 text-right">Pozos</th>
                </tr>
              </thead>
              <tbody>
                ${areaRows || `
                  <tr>
                    <td colspan="2" class="px-4 py-6 text-center text-slate-500">Sin datos locales.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  async function getFilteredPozos() {
    const query = state.filters.search;
    const filters = {
      area: state.filters.area,
      estado: state.filters.estado,
      categoria: state.filters.categoria
    };

    return window.PetroOfflineStore.findPozos(query, filters);
  }

  function optionList(values, selectedValue) {
    return values.map((value) => `
      <option value="${escapeHTML(value)}" ${String(value) === String(selectedValue) ? 'selected' : ''}>
        ${escapeHTML(value)}
      </option>
    `).join('');
  }

  async function renderPozos() {
    hideAlert();

    const [pozos, options] = await Promise.all([
      getFilteredPozos(),
      window.PetroOfflineStore.getFilterOptions()
    ]);

    els.view.innerHTML = `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Pozos offline</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              ${pozos.length} pozo(s) encontrados en datos locales.
            </p>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input id="offline-search-pozos" type="search"
              value="${escapeHTML(state.filters.search)}"
              placeholder="Buscar pozo..."
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />

            <select id="offline-filter-area"
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todas las áreas</option>
              ${optionList(options.areas || [], state.filters.area)}
            </select>

            <select id="offline-filter-estado"
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos los estados</option>
              ${optionList(options.estados || [], state.filters.estado)}
            </select>

            <select id="offline-filter-categoria"
              class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todas las categorías</option>
              ${optionList(options.categorias || [], state.filters.categoria)}
            </select>
          </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="min-w-[900px] w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th class="px-4 py-3">Pozo</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Categoría</th>
                <th class="px-4 py-3">Área</th>
                <th class="px-4 py-3">Método</th>
                <th class="px-4 py-3 text-right">Potencial</th>
                <th class="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${pozos.map(renderPozoRow).join('') || `
                <tr>
                  <td colspan="7" class="px-4 py-6 text-center text-slate-500">
                    No hay pozos con estos filtros.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;

    bindPozosEvents();
  }

  function renderPozoRow(pozo) {
    return `
      <tr class="border-b bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/80">
        <td class="whitespace-nowrap px-4 py-3">
          <div class="font-bold text-slate-900 dark:text-white">${escapeHTML(pozo.codigo)}</div>
          <div class="text-xs text-slate-500">${escapeHTML(pozo.yacimiento)}</div>
        </td>
        <td class="whitespace-nowrap px-4 py-3">${escapeHTML(getPozoEstado(pozo))}</td>
        <td class="whitespace-nowrap px-4 py-3">${escapeHTML(pozo.categoria)}</td>
        <td class="whitespace-nowrap px-4 py-3">${escapeHTML(pozo.area)}</td>
        <td class="whitespace-nowrap px-4 py-3">${escapeHTML(getPozoMetodo(pozo))}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right font-semibold">${formatNumber(pozo.potencial, 2)}</td>
        <td class="whitespace-nowrap px-4 py-3 text-right">
          <button type="button" data-offline-open-pozo="${escapeHTML(pozo.id)}"
            class="rounded-full bg-[#033F73] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#022f56]">
            Ver ficha
          </button>
        </td>
      </tr>
    `;
  }

  function bindPozosEvents() {
    $('#offline-search-pozos')?.addEventListener('input', (event) => {
      state.filters.search = event.target.value;
      renderPozos();
    });

    $('#offline-filter-area')?.addEventListener('change', (event) => {
      state.filters.area = event.target.value;
      renderPozos();
    });

    $('#offline-filter-estado')?.addEventListener('change', (event) => {
      state.filters.estado = event.target.value;
      renderPozos();
    });

    $('#offline-filter-categoria')?.addEventListener('change', (event) => {
      state.filters.categoria = event.target.value;
      renderPozos();
    });

    $all('[data-offline-open-pozo]').forEach((button) => {
      button.addEventListener('click', () => {
        renderPozoDetalle(button.dataset.offlineOpenPozo);
      });
    });
  }

  function infoCard(label, value) {
    return `
      <div class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(label)}</p>
        <p class="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">${escapeHTML(value)}</p>
      </div>
    `;
  }

  function historyTable(title, rows, columns) {
    return `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">${escapeHTML(title)}</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table class="min-w-[900px] w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                ${columns.map((column) => `<th class="px-4 py-3">${escapeHTML(column.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 10).map((row) => `
                <tr class="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
                  ${columns.map((column) => `
                    <td class="whitespace-nowrap px-4 py-3">
                      ${escapeHTML(column.format ? column.format(row[column.key], row) : row[column.key])}
                    </td>
                  `).join('')}
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="${columns.length}" class="px-4 py-6 text-center text-slate-500">
                    Sin registros locales.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  async function renderPozoDetalle(idPozo) {
    const full = await window.PetroOfflineStore.getPozoFull(idPozo);
    const pozo = full.pozo || {};

    if (!pozo) {
      showAlert('No se pudo abrir la ficha offline del pozo.', 'error');
      return;
    }

    setText('offline-page-title', `Ficha offline - ${pozo.codigo || idPozo}`);

    els.view.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button type="button" id="offline-back-pozos"
            class="mb-2 inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            ← Volver a pozos
          </button>

          <h3 class="text-2xl font-bold text-slate-900 dark:text-white">${escapeHTML(pozo.codigo || idPozo)}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            ${escapeHTML(pozo.area)} · ${escapeHTML(getPozoEstado(pozo))} · Cat. ${escapeHTML(pozo.categoria)}
          </p>
        </div>

        <span class="rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200">
          Lectura offline
        </span>
      </div>

      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Datos generales</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${infoCard('Área', pozo.area)}
          ${infoCard('Estado', getPozoEstado(pozo))}
          ${infoCard('Categoría', pozo.categoria)}
          ${infoCard('Yacimiento', pozo.yacimiento)}
          ${infoCard('Método', getPozoMetodo(pozo))}
          ${infoCard('Cabezal', pozo.cabezal)}
          ${infoCard('Variador', pozo.variador)}
          ${infoCard('Potencial', formatNumber(pozo.potencial, 2))}
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Último parámetro</h3>
          <div class="grid gap-2">
            ${infoCard('Fecha', formatDate(full.ultimoParametro?.fecha))}
            ${infoCard('Torque', formatNumber(full.ultimoParametro?.torque, 2))}
            ${infoCard('AMP', formatNumber(full.ultimoParametro?.amp, 2))}
            ${infoCard('P. casing', formatNumber(full.ultimoParametro?.presion_casing, 2))}
            ${infoCard('P. tubing', formatNumber(full.ultimoParametro?.presion_tubing, 2))}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Último nivel</h3>
          <div class="grid gap-2">
            ${infoCard('Fecha', formatDate(full.ultimoNivel?.fecha))}
            ${infoCard('NF pies', formatNumber(full.ultimoNivel?.nf_pies, 2))}
            ${infoCard('SUM', formatNumber(full.ultimoNivel?.sumergencia, 2))}
            ${infoCard('PIP', formatNumber(full.ultimoNivel?.pip, 2))}
            ${infoCard('PBHP', formatNumber(full.ultimoNivel?.pbhp, 2))}
          </div>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Bomba actual</h3>
          <div class="grid gap-2">
            ${infoCard('Marca', full.bombaActual?.marca)}
            ${infoCard('Modelo', full.bombaActual?.modelo)}
            ${infoCard('Serial', full.bombaActual?.serial)}
            ${infoCard('Instalación', formatDate(full.bombaActual?.fecha_inst))}
            ${infoCard('TVU', full.bombaActual?.tvu_dias ? `${formatNumber(full.bombaActual.tvu_dias, 0)} días` : '—')}
          </div>
        </article>
      </section>

      ${historyTable('Histórico de parámetros', full.parametros || [], [
        { key: 'fecha', label: 'Fecha', format: formatDate },
        { key: 'torque', label: 'Torque', format: formatNumber },
        { key: 'amp', label: 'AMP', format: formatNumber },
        { key: 'freq', label: 'Freq', format: formatNumber },
        { key: 'presion_casing', label: 'P. casing', format: formatNumber },
        { key: 'presion_tubing', label: 'P. tubing', format: formatNumber }
      ])}

      ${historyTable('Histórico de niveles', full.niveles || [], [
        { key: 'fecha', label: 'Fecha', format: formatDate },
        { key: 'nf_pies', label: 'NF pies', format: formatNumber },
        { key: 'sumergencia', label: 'SUM', format: formatNumber },
        { key: 'pip', label: 'PIP', format: formatNumber },
        { key: 'pbhp', label: 'PBHP', format: formatNumber }
      ])}

      ${historyTable('Histórico de bombas', full.bombas || [], [
        { key: 'fecha_inst', label: 'Instalación', format: formatDate },
        { key: 'marca', label: 'Marca' },
        { key: 'modelo', label: 'Modelo' },
        { key: 'serial', label: 'Serial' },
        { key: 'estatus', label: 'Estatus' },
        { key: 'tvu_dias', label: 'TVU', format: (value) => value ? `${formatNumber(value, 0)} días` : '—' }
      ])}
    `;

    $('#offline-back-pozos')?.addEventListener('click', () => {
      setRoute('pozos');
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function renderDiagnostico() {
    hideAlert();

    const diagnostics = await window.PetroOfflineStore.getDiagnostics();
    const syncDiagnostics = window.PetroSync?.getDiagnostics
      ? await window.PetroSync.getDiagnostics()
      : null;

    els.view.innerHTML = `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Diagnóstico local</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Conteos guardados en IndexedDB.
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${Object.entries(diagnostics.counts || {}).map(([key, value]) => card(key, value)).join('')}
        </div>

        <pre class="mt-4 max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">${escapeHTML(JSON.stringify({
          store: diagnostics,
          sync: syncDiagnostics
        }, null, 2))}</pre>
      </section>
    `;
  }

  function updateHeaderStatus() {
    const online = navigator.onLine;

    setText('offline-network-state', online ? 'Con conexión' : 'Sin conexión');

    window.PetroOfflineStore.getSnapshotInfo()
      .then((info) => {
        setText('offline-last-sync', info.lastSnapshotAt ? `Última sync: ${formatDate(info.lastSnapshotAt)}` : 'Última sync: —');
      })
      .catch(() => {});
  }

  async function bootstrap() {
    els.view = $('#offline-view');
    els.alert = $('#offline-alert');

    if (!window.PetroDB || !window.PetroOfflineStore) {
      showAlert('No se pudo iniciar IndexedDB. Abre la app con internet e intenta de nuevo.', 'error');
      return;
    }

    const info = await window.PetroOfflineStore.getSnapshotInfo();

    if (!info.hasSnapshot) {
      showAlert('No hay datos locales guardados. Entra con internet a PetroField para preparar el modo offline.', 'warning');
    }

    $all('[data-offline-route]').forEach((button) => {
      button.addEventListener('click', () => {
        setRoute(button.dataset.offlineRoute);
      });
    });

    $('#offline-refresh-btn')?.addEventListener('click', async () => {
      if (!navigator.onLine) {
        showAlert('No hay conexión. Se mantienen los datos locales actuales.', 'warning');
        return;
      }

      showAlert('Sincronizando datos offline...', 'info');

      try {
        await window.PetroSync?.syncNow?.({ force: true });
        showAlert('Datos offline actualizados.', 'success');
        updateHeaderStatus();
        setRoute(state.route);
      } catch (error) {
        showAlert(error.message || 'No se pudo sincronizar.', 'error');
      }
    });

    document.addEventListener('click', (event) => {
      const routeBtn = event.target.closest('[data-offline-route]');
      if (!routeBtn) return;

      setRoute(routeBtn.dataset.offlineRoute);
    });

    window.addEventListener('online', updateHeaderStatus);
    window.addEventListener('offline', updateHeaderStatus);

    updateHeaderStatus();
    setRoute('dashboard');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();