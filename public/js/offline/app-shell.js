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
    const safeDecimals = Number.isFinite(Number(decimals)) ? Number(decimals) : 2;

    if (!Number.isFinite(number)) return '—';

    return number.toLocaleString('es-VE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: safeDecimals
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

  function dateKey(value) {
    if (!value) return '';

    const text = String(value);

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.slice(0, 10);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function fallback(value) {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function debug(message, data = null) {
    console.debug('[OfflineShell]', message, data ?? '');

    const output = document.getElementById('offline-debug-output');
    if (!output) return;

    const line = data
      ? `${message}: ${safeStringify(data)}`
      : String(message);

    output.textContent += `${line}\n`;
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
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

  function setActiveNav(route) {
    $all('[data-offline-route]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.offlineRoute === route);
    });
  }

  function updateUrl(path) {
    if (!path || window.location.pathname === path) return;

    try {
      history.pushState({ offlineRoute: path }, '', path);
    } catch (error) {
      // No bloquea navegación offline si History API falla.
    }
  }

  function setRoute(route, options = {}) {
    state.route = route;
    setActiveNav(route);

    const titles = {
      dashboard: 'Dashboard',
      pozos: 'Pozos',
      diagnostico: 'Datos locales'
    };

    setText('offline-page-title', titles[route] || 'PetroField');

    if (!options.keepUrl) {
      if (route === 'dashboard') updateUrl('/dashboard');
      if (route === 'pozos') updateUrl('/pozos');
      if (route === 'diagnostico') updateUrl('/offline-diagnostico');
    }

    if (route === 'dashboard') renderDashboard();
    if (route === 'pozos') renderPozos();
    if (route === 'diagnostico') renderDiagnostico();
  }

  function getPozoEstado(pozo) {
    return pozo?.estado || pozo?.estado_nombre || pozo?.estado_pozo || '—';
  }

  function getPozoMetodo(pozo) {
    return pozo?.metodo_levantamiento || pozo?.metodo || pozo?.metodo_nombre || '—';
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
    try {
      hideAlert();
      state.route = 'dashboard';
      setActiveNav('dashboard');
      setText('offline-page-title', 'Dashboard');

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
    } catch (error) {
      handleRenderError(error, 'No se pudo cargar el dashboard offline.');
    }
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
    try {
      hideAlert();
      state.route = 'pozos';
      setActiveNav('pozos');
      setText('offline-page-title', 'Pozos');

      const [pozos, options] = await Promise.all([
        getFilteredPozos(),
        window.PetroOfflineStore.getFilterOptions()
      ]);

      els.view.innerHTML = `
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Pozos</h3>
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
    } catch (error) {
      handleRenderError(error, 'No se pudo cargar la lista de pozos offline.');
    }
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
    $('#offline-search-pozos')?.addEventListener('input', debounce((event) => {
      state.filters.search = event.target.value;
      renderPozos();
    }, 180));

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
        const idPozo = button.dataset.offlineOpenPozo;
        updateUrl(`/pozos/${idPozo}`);
        renderPozoDetalle(idPozo);
      });
    });
  }

  function debounce(fn, delay = 150) {
    let timeout = null;

    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function getVelocidades(pozo, ultimoParametro) {
    return {
      operacional:
        ultimoParametro?.vel_operacional ??
        ultimoParametro?.velocidad_operacional ??
        pozo?.vel_operacional ??
        pozo?.velocidad_operacional ??
        null,
      actual:
        ultimoParametro?.vel_actual ??
        ultimoParametro?.velocidad_actual ??
        pozo?.vel_actual ??
        pozo?.velocidad_actual ??
        null
    };
  }

  function buildComparativo(parametros = [], niveles = []) {
    const parametrosByDate = new Map();

    parametros.forEach((row) => {
      const key = dateKey(row.fecha);
      if (!key) return;
      if (!parametrosByDate.has(key)) parametrosByDate.set(key, row);
    });

    return niveles
      .map((nivel) => {
        const key = dateKey(nivel.fecha);
        const parametro = parametrosByDate.get(key);

        if (!key || !parametro) return null;

        const rpmParam = Number(parametro.rpm ?? parametro.vel_actual ?? parametro.vel_operacional);
        const rpmNivel = Number(nivel.rpm);
        const torqueParam = Number(parametro.torque);
        const torqueNivel = Number(nivel.torque);
        const ampParam = Number(parametro.amp);
        const ampNivel = Number(nivel.amp);
        const hpParam = Number(parametro.hp);
        const hpNivel = Number(nivel.hp);
        const casingParam = Number(parametro.presion_casing);
        const casingNivel = Number(nivel.presion_casing);
        const tubingParam = Number(parametro.presion_tubing);
        const tubingNivel = Number(nivel.presion_tubing);

        return {
          fecha: key,
          fecha_nivel: nivel.fecha,
          fecha_parametro: parametro.fecha,
          rpm_parametros: rpmParam,
          rpm_nivel: rpmNivel,
          dif_rpm: safeDiff(rpmParam, rpmNivel),
          torque_parametros: torqueParam,
          torque_nivel: torqueNivel,
          dif_torque: safeDiff(torqueParam, torqueNivel),
          amp_parametros: ampParam,
          amp_nivel: ampNivel,
          dif_amp: safeDiff(ampParam, ampNivel),
          hp_parametros: hpParam,
          hp_nivel: hpNivel,
          dif_hp: safeDiff(hpParam, hpNivel),
          casing_parametros: casingParam,
          casing_nivel: casingNivel,
          dif_presion_casing: safeDiff(casingParam, casingNivel),
          tubing_parametros: tubingParam,
          tubing_nivel: tubingNivel,
          dif_presion_tubing: safeDiff(tubingParam, tubingNivel)
        };
      })
      .filter(Boolean);
  }

  function safeDiff(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return b - a;
  }

  function normalizeFullData(full, idPozo) {
    const pozo = full.pozo || full.detalle || {};
    const parametros = sortByDateDesc(full.parametros || full.timeline?.parametros || []);
    const niveles = sortByDateDesc(full.niveles || full.timeline?.niveles || []);
    const muestras = sortByDateDesc(full.muestras || full.timeline?.muestras || []);
    const bombas = sortByDateDesc(full.bombas || full.historialBombas || [], 'fecha_inst');
    const survey = full.survey || [];

    const ultimoParametro = full.ultimoParametro || parametros[0] || null;
    const ultimoNivel = full.ultimoNivel || niveles[0] || null;
    const bombaActual = full.bombaActual || bombas[0] || null;
    const comparativo = full.timeline?.comparativo || full.comparativo || buildComparativo(parametros, niveles);

    return {
      id: full.id || pozo.id || idPozo,
      pozo,
      velocidades: full.velocidades || getVelocidades(pozo, ultimoParametro),
      bombaActual,
      historialBombas: bombas,
      ultimoParametro,
      ultimoNivel,
      timeline: {
        parametros,
        niveles,
        muestras,
        comparativo
      },
      ultimasMuestras: muestras,
      survey,
      counts: full.counts || {},
      offline: true,
      source: 'indexeddb'
    };
  }

  function sortByDateDesc(rows, field = 'fecha') {
    return [...(rows || [])].sort((a, b) => {
      const dateA = new Date(a?.[field] || a?.fecha || 0).getTime() || 0;
      const dateB = new Date(b?.[field] || b?.fecha || 0).getTime() || 0;
      return dateB - dateA;
    });
  }

  function renderPozoDetalleShell(data, idPozo) {
    const pozo = data.pozo || {};
    const codigoPozo = pozo.codigo || pozo.nombre || `Pozo ${idPozo}`;
    const estadoPozo = getPozoEstado(pozo);
    const colorEstado = pozo.color_estado_mapa || pozo.color_estado || '#033F73';
    const velocidades = data.velocidades || {};

    setText('offline-page-title', codigoPozo);

    els.view.innerHTML = `
      <section class="space-y-6" data-offline-pozo-detail="true">
        ${renderDetalleHeader({ pozo, codigoPozo, estadoPozo, colorEstado, velocidades, bombaActual: data.bombaActual })}

        <div class="border-b border-slate-200 dark:border-slate-700">
          <ul class="-mb-px flex flex-wrap text-center text-sm font-medium" id="pozo-detail-tabs" role="tablist">
            <li class="me-2" role="presentation">
              <button
                class="pozo-tab-btn active inline-block rounded-t-lg border-b-2 border-[#033F73] p-4 text-[#033F73] dark:border-sky-300 dark:text-sky-300"
                type="button" data-tab-target="tab-general">
                Datos generales
              </button>
            </li>

            <li class="me-2" role="presentation">
              <button
                class="pozo-tab-btn inline-block rounded-t-lg border-b-2 border-transparent p-4 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                type="button" data-tab-target="tab-parametros">
                Parámetros y niveles
              </button>
            </li>

            <li class="me-2" role="presentation">
              <button
                class="pozo-tab-btn inline-block rounded-t-lg border-b-2 border-transparent p-4 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                type="button" data-tab-target="tab-muestras">
                Muestras
              </button>
            </li>
          </ul>
        </div>

        <div>
          <div id="tab-general" class="pozo-tab-panel">
            ${renderTabGeneral(data)}
          </div>

          <div id="tab-parametros" class="pozo-tab-panel hidden">
            ${renderTabParametrosNiveles(data)}
          </div>

          <div id="tab-muestras" class="pozo-tab-panel hidden">
            ${renderTabMuestras(data)}
          </div>
        </div>
      </section>
    `;

    $('#offline-back-pozos')?.addEventListener('click', () => {
      updateUrl('/pozos');
      setRoute('pozos');
    });

    window.PetroPozoDetalle?.reinit?.();
  }

  function renderDetalleHeader({ pozo, codigoPozo, estadoPozo, colorEstado, velocidades, bombaActual }) {
    const areaPozo = pozo.area || 'Sin área';
    const yacimientoPozo = pozo.yacimiento || 'Sin yacimiento';
    const categoriaPozo = pozo.categoria || '—';
    const metodoPozo = getPozoMetodo(pozo);
    const potencialPozo = pozo.potencial != null ? formatNumber(pozo.potencial, 2) : '—';
    const tvuBomba = bombaActual?.tvu_dias != null ? `${formatNumber(bombaActual.tvu_dias, 0)} días` : '—';

    return `
      <div id="pozo-detalle-header"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        data-pozo-id="${escapeHTML(pozo.id || '')}"
        data-pozo-codigo="${escapeHTML(codigoPozo)}">

        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button type="button" id="offline-back-pozos" data-pozo-back="pozos"
              class="inline-flex items-center gap-1 text-sm font-semibold text-[#033F73] hover:underline dark:text-sky-300">
              <i class="fa-solid fa-arrow-left text-xs"></i>
              Volver a pozos
            </button>

            <div class="mt-2 flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
                Pozo ${escapeHTML(codigoPozo)}
              </h1>

              <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
                style="background-color: ${escapeHTML(colorEstado)}">
                ${escapeHTML(estadoPozo)}
              </span>

              <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                Datos locales
              </span>
            </div>

            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              ${escapeHTML(areaPozo)} · ${escapeHTML(yacimientoPozo)}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <button type="button" data-pozo-action="editar" data-pozo-id="${escapeHTML(pozo.id || '')}"
              class="inline-flex items-center gap-1.5 rounded-full bg-[#033F73] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#022f56] focus:outline-none focus:ring-2 focus:ring-[#033F73]/40 dark:bg-sky-600 dark:hover:bg-sky-500">
              <i class="fa-solid fa-pen-to-square text-[11px]"></i>
              Editar
            </button>

            <button type="button" data-pozo-action="registrar-dato" data-pozo-id="${escapeHTML(pozo.id || '')}"
              class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <i class="fa-solid fa-plus text-[11px]"></i>
              Registrar dato
            </button>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <div class="flex min-w-max gap-2 pb-1">
            ${compactKpi('Categoría', categoriaPozo)}
            ${compactKpi('Potencial', potencialPozo)}
            ${compactKpi('Vel. operacional', velocidades.operacional != null ? formatNumber(velocidades.operacional, 2) : '—')}
            ${compactKpi('Vel. actual', velocidades.actual != null ? formatNumber(velocidades.actual, 2) : '—')}
            ${compactKpi('Método', metodoPozo)}
            ${compactKpi('TVU bomba', tvuBomba)}
          </div>
        </div>
      </div>
    `;
  }

  function compactKpi(label, value) {
    return `
      <article class="flex min-w-[130px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div class="min-w-0">
          <p class="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(label)}</p>
          <p class="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">${escapeHTML(value)}</p>
        </div>
      </article>
    `;
  }

  function infoCard(label, value) {
    return `
      <div class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(label)}</p>
        <p class="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">${escapeHTML(fallback(value))}</p>
      </div>
    `;
  }

  function renderTabGeneral(data) {
    const pozo = data.pozo || {};
    const bombaActual = data.bombaActual;
    const historialBombas = data.historialBombas || [];
    const survey = data.survey || [];
    const variadorNombre = pozo.marca_vdf || pozo.variador || pozo.vdf || pozo.vdf_nombre || pozo.variador_nombre_original;
    const cabezalNombre = pozo.cabezal || pozo.cabezal_nombre || pozo.cabezal_nombre_original;

    return `
      <div class="space-y-4">
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Datos generales</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Información base registrada para el pozo y equipos actualmente asignados.</p>
            </div>

            <button type="button" data-pozo-action="editar-datos" data-pozo-id="${escapeHTML(pozo.id || '')}"
              class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <i class="fa-solid fa-pen-to-square text-[11px]"></i>
              Editar datos
            </button>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            ${infoCard('Código', pozo.codigo)}
            ${infoCard('Área', pozo.area)}
            ${infoCard('Estado', getPozoEstado(pozo))}
            ${infoCard('Categoría', pozo.categoria)}
            ${infoCard('Yacimiento', pozo.yacimiento)}
            ${infoCard('Método', getPozoMetodo(pozo))}
            ${infoCard('Fecha arranque', formatDate(pozo.fecha_arranque))}
            ${infoCard('Potencial', pozo.potencial != null ? formatNumber(pozo.potencial, 2) : '—')}
          </div>

          <div class="mt-4 grid gap-3 lg:grid-cols-2">
            <article class="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Variador asignado</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Datos actuales del VSD/VDF asociado al pozo.</p>
              <div class="mt-3 grid gap-2 sm:grid-cols-2">
                ${infoCard('Equipo', variadorNombre)}
                ${infoCard('Potencia / capacidad', pozo.capacidad_vdf || pozo.potencia_variador || pozo.potencia_vsd)}
              </div>
            </article>

            <article class="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Cabezal / motores</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Configuración vigente del cabezal y motores del pozo.</p>
              <div class="mt-3 grid gap-2 sm:grid-cols-3">
                ${infoCard('Cabezal', cabezalNombre)}
                ${infoCard('Configuración', pozo.configuracion_motor_stg || pozo.configuracion_motor || pozo.motores_cabezal)}
                ${infoCard('HP motor', pozo.hp_motor || pozo.hp_motor_cabezal || pozo.cabezal_hp_motor)}
              </div>
            </article>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Bomba actualmente instalada</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Se toma como bomba actual la más nueva registrada para este pozo.</p>
            </div>

            <button type="button" data-pozo-open-modal="modal-historial-bombas"
              class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <i class="fa-solid fa-clock-rotate-left text-[11px]"></i>
              Ver histórico
            </button>
          </div>

          ${bombaActual ? `
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
              ${infoCard('Método', bombaActual.metodo || bombaActual.id_metodo)}
              ${infoCard('Marca', bombaActual.marca)}
              ${infoCard('Modelo', bombaActual.modelo)}
              ${infoCard('Serial', bombaActual.serial || bombaActual.serial_rotor || bombaActual.serial_estator)}
              ${infoCard('Instalación', formatDate(bombaActual.fecha_inst || bombaActual.fecha_instalacion))}
              ${infoCard('TVU', bombaActual.tvu_dias != null ? `${formatNumber(bombaActual.tvu_dias, 0)} días` : '—')}
              ${infoCard('Estatus', bombaActual.estatus || bombaActual.estado)}
            </div>
          ` : `
            <div class="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
              No hay bomba registrada para este pozo.
            </div>
          `}
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Datos de completación</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Diagrama mecánico, survey y trayectoria del pozo.</p>
            </div>
          </div>

          <div class="grid gap-4 xl:grid-cols-2">
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Diagrama mecánico</h3>
              <div class="mt-3 flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center dark:border-slate-600 dark:bg-slate-900">
                <p class="text-sm text-slate-500 dark:text-slate-400">Diagrama mecánico pendiente para uso offline.</p>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Trayectoria / Survey</h3>
              <script type="application/json" id="survey-data-json">${jsonScript(survey)}</script>
              <div id="chart-survey-pozo" class="mt-3 min-h-[320px] rounded-xl border border-dashed border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900">
                ${!survey.length ? chartEmpty('Gráfica de survey pendiente.') : ''}
              </div>
            </div>
          </div>

          ${renderSurveyTable(survey)}
        </section>

        ${renderBombasModal(historialBombas, pozo.codigo)}
        ${renderSurveyModal(pozo)}
      </div>
    `;
  }

  function chartEmpty(message) {
    return `
      <div class="flex min-h-[300px] items-center justify-center">
        <p class="text-sm text-slate-500 dark:text-slate-400">${escapeHTML(message)}</p>
      </div>
    `;
  }

  function jsonScript(value) {
    return escapeHTML(JSON.stringify(value || [])).replaceAll('&quot;', '"');
  }

  function renderSurveyTable(survey) {
    return `
      <div class="mt-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div class="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Tabla de survey</h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">MD, TVD, offsets y azimut calculado automáticamente.</p>
          </div>
          <button type="button" data-pozo-open-modal="modal-survey-pozo"
            class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <i class="fa-solid fa-table text-[11px]"></i>
            Pegar / actualizar survey
          </button>
        </div>

        <div class="p-2">
          <table id="tabla-survey-pozo" class="w-full text-left text-[11px] text-slate-500 dark:text-slate-400">
            <thead class="bg-slate-50 text-[10px] uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th class="whitespace-nowrap px-2 py-1.5">#</th>
                <th class="whitespace-nowrap px-2 py-1.5">MD</th>
                <th class="whitespace-nowrap px-2 py-1.5">TVD</th>
                <th class="whitespace-nowrap px-2 py-1.5">X Offset</th>
                <th class="whitespace-nowrap px-2 py-1.5">Y Offset</th>
                <th class="whitespace-nowrap px-2 py-1.5">ΔX</th>
                <th class="whitespace-nowrap px-2 py-1.5">ΔY</th>
                <th class="whitespace-nowrap px-2 py-1.5">Azimut</th>
              </tr>
            </thead>
            <tbody>
              ${survey.length ? survey.map((row, index) => `
                <tr class="border-b bg-white text-[11px] dark:border-slate-700 dark:bg-slate-900">
                  <td class="whitespace-nowrap px-2 py-1 text-slate-400">${escapeHTML(row.fila_orden || index + 1)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.md, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.tvd, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.x_offset, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.y_offset, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.delta_x, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1">${formatNumber(row.delta_y, 2)}</td>
                  <td class="whitespace-nowrap px-2 py-1 font-semibold text-slate-700 dark:text-slate-200">${formatNumber(row.azimut, 2)}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="8" class="px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">Survey pendiente por cargar.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderTabParametrosNiveles(data) {
    const pozo = data.pozo || {};
    const parametros = data.timeline?.parametros || [];
    const niveles = data.timeline?.niveles || [];
    const comparativo = data.timeline?.comparativo || [];
    const ultimoParametro = data.ultimoParametro;
    const ultimoNivel = data.ultimoNivel;
    const ultimoComparativo = comparativo[0] || null;
    const codigoPozo = pozo.codigo || 'pozo';

    return `
      <div id="tab-parametros-niveles" class="space-y-5 rounded-2xl bg-slate-50 p-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-4">
        ${renderResumenParametros(ultimoParametro)}
        ${renderGraficaParametros(parametros, codigoPozo)}
        ${renderResumenNiveles(ultimoNivel)}
        ${renderGraficaNiveles(niveles, codigoPozo)}
        ${renderComparativo(comparativo, ultimoComparativo, codigoPozo)}
        ${renderParametrosModal(parametros, codigoPozo)}
        ${renderNivelesModal(niveles, codigoPozo)}
        ${renderComparativoModal(comparativo, codigoPozo)}
      </div>
    `;
  }

  function renderResumenParametros(row) {
    return `
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/70">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Último registro operativo</h2>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Parámetros diarios del pozo.</p>
            </div>
            <button type="button" data-pozo-open-modal="modal-historial-parametros" class="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/40">Histórico</button>
          </div>
        </div>
        <div class="p-3">
          ${row ? `
            <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-10">
              ${chip('Fecha', formatDate(row.fecha))}
              ${chip('Torque', formatNumber(row.torque, 2))}
              ${chip('AMP', formatNumber(row.amp, 2))}
              ${chip('Freq', formatNumber(row.freq, 2))}
              ${chip('Volts', formatNumber(row.volts, 2))}
              ${chip('HP', formatNumber(row.hp, 2))}
              ${chip('VO', formatNumber(row.vel_operacional, 2))}
              ${chip('Vel. actual', formatNumber(row.vel_actual, 2))}
              ${chip('P. casing', formatNumber(row.presion_casing, 2))}
              ${chip('P. tubing', formatNumber(row.presion_tubing, 2))}
            </div>
          ` : emptyBox('No hay parámetros registrados para este pozo.')}
        </div>
      </section>
    `;
  }

  function renderResumenNiveles(row) {
    return `
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/70">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">Última toma de nivel</h2>
              <p class="text-[11px] text-slate-500 dark:text-slate-400">Registro más reciente cargado desde la base de niveles.</p>
            </div>
            <button type="button" data-pozo-open-modal="modal-historial-niveles" class="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40">Histórico</button>
          </div>
        </div>
        <div class="p-3">
          ${row ? `
            <div class="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-12">
              ${chip('Fecha', formatDate(row.fecha))}
              ${chip('NF pies', formatNumber(row.nf_pies, 2))}
              ${chip('SUM', formatNumber(row.sumergencia, 2))}
              ${chip('% Liq', formatNumber(row.porcentaje_liq, 2))}
              ${chip('PIP', formatNumber(row.pip, 2))}
              ${chip('PBHP', formatNumber(row.pbhp, 2))}
              ${chip('Casing', formatNumber(row.presion_casing, 2))}
              ${chip('Tubing', formatNumber(row.presion_tubing, 2))}
              ${chip('RPM', formatNumber(row.rpm, 2))}
              ${chip('Torque', formatNumber(row.torque, 2))}
              ${chip('AMP', formatNumber(row.amp, 2))}
              ${chip('HP', formatNumber(row.hp, 2))}
            </div>
          ` : emptyBox('No hay tomas de nivel registradas para este pozo.')}
        </div>
      </section>
    `;
  }

  function chip(label, value) {
    return `
      <div class="inline-flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <span class="shrink-0 font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(label)}</span>
        <span class="min-w-0 truncate text-right font-bold text-slate-900 dark:text-white">${escapeHTML(value)}</span>
      </div>
    `;
  }

  function emptyBox(message) {
    return `<div class="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">${escapeHTML(message)}</div>`;
  }

  function checkbox(name, value, label, checked = false) {
    return `
      <label class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
        <input type="checkbox" name="${escapeHTML(name)}" value="${escapeHTML(value)}" ${checked ? 'checked' : ''}>
        ${escapeHTML(label)}
      </label>
    `;
  }

  function renderGraficaParametros(parametros, codigoPozo) {
    return `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Gráfica inteligente de parámetros</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Selecciona uno o varios parámetros y un periodo para visualizar sus tendencias.</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select id="parametros-periodo" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <option value="7">1 semana</option>
              <option value="30" selected>1 mes</option>
              <option value="90">3 meses</option>
              <option value="180">6 meses</option>
              <option value="all">Todo</option>
            </select>
            <button type="button" data-export-chart="chart-parametros-pozo" data-export-name="parametros-${escapeHTML(codigoPozo)}" data-export-pozo="${escapeHTML(codigoPozo)}" data-export-kind="parametros" class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">Exportar PNG</button>
          </div>
        </div>
        <div class="mb-4 flex flex-wrap gap-2">
          ${checkbox('parametro-chart-field', 'torque', 'Torque', true)}
          ${checkbox('parametro-chart-field', 'amp', 'AMP')}
          ${checkbox('parametro-chart-field', 'freq', 'Freq')}
          ${checkbox('parametro-chart-field', 'volts', 'Volts')}
          ${checkbox('parametro-chart-field', 'hp', 'HP')}
          ${checkbox('parametro-chart-field', 'vel_operacional', 'VO')}
          ${checkbox('parametro-chart-field', 'vel_actual', 'Vel. actual')}
          ${checkbox('parametro-chart-field', 'presion_casing', 'P. casing')}
          ${checkbox('parametro-chart-field', 'presion_tubing', 'P. tubing')}
        </div>
        <script type="application/json" id="parametros-data-json">${jsonScript(parametros)}</script>
        <div id="chart-parametros-pozo" class="min-h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-950">
          ${!parametros.length ? chartEmpty('Gráfica de parámetros pendiente.') : ''}
        </div>
      </section>
    `;
  }

  function renderGraficaNiveles(niveles, codigoPozo) {
    return `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Gráfica de niveles</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Selecciona uno o varios datos y cuántas tomas quieres considerar.</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select id="niveles-limite" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <option value="3">Últimas 3</option>
              <option value="5" selected>Últimas 5</option>
              <option value="10">Últimas 10</option>
              <option value="all">Todas</option>
            </select>
            <button type="button" data-export-chart="chart-niveles-pozo" data-export-name="niveles-${escapeHTML(codigoPozo)}" data-export-pozo="${escapeHTML(codigoPozo)}" data-export-kind="niveles" class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">Exportar PNG</button>
          </div>
        </div>
        <div class="mb-4 flex flex-wrap gap-2">
          ${checkbox('nivel-chart-field', 'nf_pies', 'NF pies', true)}
          ${checkbox('nivel-chart-field', 'sumergencia', 'Sumergencia')}
          ${checkbox('nivel-chart-field', 'porcentaje_liq', '% Liq')}
          ${checkbox('nivel-chart-field', 'pip', 'PIP')}
          ${checkbox('nivel-chart-field', 'pbhp', 'PBHP')}
          ${checkbox('nivel-chart-field', 'presion_casing', 'P. casing')}
          ${checkbox('nivel-chart-field', 'presion_tubing', 'P. tubing')}
          ${checkbox('nivel-chart-field', 'rpm', 'RPM')}
          ${checkbox('nivel-chart-field', 'torque', 'Torque')}
          ${checkbox('nivel-chart-field', 'amp', 'AMP')}
          ${checkbox('nivel-chart-field', 'hp', 'HP')}
        </div>
        <script type="application/json" id="niveles-data-json">${jsonScript(niveles)}</script>
        <div id="chart-niveles-pozo" class="min-h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-950">
          ${!niveles.length ? chartEmpty('Gráfica de niveles pendiente.') : ''}
        </div>
      </section>
    `;
  }

  function renderComparativo(comparativo, ultimoComparativo, codigoPozo) {
    return `
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Comparativa parámetros vs niveles</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Selecciona una toma de nivel para comparar sus valores contra los parámetros del mismo día.</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select id="comparativo-fecha-select" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              ${comparativo.length ? comparativo.map((row, index) => {
                const fecha = row.fecha_nivel || row.fecha;
                return `<option value="${escapeHTML(dateKey(fecha))}" ${index === 0 ? 'selected' : ''}>${escapeHTML(formatDate(fecha))}</option>`;
              }).join('') : '<option value="">Sin fechas</option>'}
            </select>
            <button type="button" data-pozo-open-modal="modal-comparativo-parametros-niveles" class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Ver histórico</button>
            <button type="button" data-export-chart="chart-comparativa-pozo" data-export-name="comparativo-${escapeHTML(codigoPozo)}" data-export-pozo="${escapeHTML(codigoPozo)}" data-export-kind="comparativo" class="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700">Exportar PNG</button>
          </div>
        </div>

        <script type="application/json" id="comparativo-parametros-niveles-json">${jsonScript(comparativo)}</script>

        ${ultimoComparativo ? `
          <div class="mb-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
            ${summaryCard('Fecha', formatDate(ultimoComparativo.fecha_nivel || ultimoComparativo.fecha), 'comparativo-resumen-fecha')}
            ${summaryCard('Dif. RPM', formatNumber(ultimoComparativo.dif_rpm, 2), 'comparativo-resumen-dif-rpm')}
            ${summaryCard('Dif. Torque', formatNumber(ultimoComparativo.dif_torque, 2), 'comparativo-resumen-dif-torque')}
            ${summaryCard('Dif. AMP', formatNumber(ultimoComparativo.dif_amp, 2), 'comparativo-resumen-dif-amp')}
            ${summaryCard('Dif. HP', formatNumber(ultimoComparativo.dif_hp, 2), 'comparativo-resumen-dif-hp')}
            ${summaryCard('Dif. Casing', formatNumber(ultimoComparativo.dif_presion_casing, 2), 'comparativo-resumen-dif-casing')}
            ${summaryCard('Dif. Tubing', formatNumber(ultimoComparativo.dif_presion_tubing, 2), 'comparativo-resumen-dif-tubing')}
          </div>
        ` : emptyBox('No hay registros comparables entre parámetros y niveles para este pozo.')}

        <div id="chart-comparativa-pozo" class="min-h-[300px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-950">
          ${!comparativo.length ? chartEmpty('Gráfica comparativa pendiente.') : ''}
        </div>
      </section>
    `;
  }

  function summaryCard(label, value, id) {
    return `
      <div class="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <p class="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHTML(label)}</p>
        <p id="${escapeHTML(id)}" class="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">${escapeHTML(value)}</p>
      </div>
    `;
  }

  function renderTabMuestras(data) {
    const pozo = data.pozo || {};
    const muestras = data.ultimasMuestras || [];
    const codigoPozo = pozo.codigo || 'pozo';

    return `
      <section class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Muestras de fluido</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Marca las muestras representativas para incluirlas en la tendencia de % AyS.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" data-pozo-action="nueva-muestra" data-pozo-id="${escapeHTML(pozo.id || '')}" class="inline-flex items-center gap-2 rounded-lg bg-[#033F73] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#022f56]">Nueva muestra</button>
              <button type="button" data-export-chart="chart-muestras-pozo" data-export-name="muestras-${escapeHTML(codigoPozo)}" data-export-pozo="${escapeHTML(codigoPozo)}" data-export-kind="muestras" class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Exportar PNG</button>
            </div>
          </div>

          <script type="application/json" id="muestras-data-json">${jsonScript(muestras)}</script>

          <div id="chart-muestras-pozo" class="mb-4 min-h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-950">
            ${!muestras.length ? chartEmpty('Gráfica de muestras pendiente.') : ''}
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table id="tabla-muestras-pozo" class="min-w-[920px] w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th class="px-4 py-3">Fecha</th>
                  <th class="px-4 py-3">% AyS</th>
                  <th class="px-4 py-3">% Liq</th>
                  <th class="px-4 py-3">API</th>
                  <th class="px-4 py-3">Representativa</th>
                  <th class="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${muestras.length ? muestras.map((muestra) => renderMuestraRow(muestra, pozo.id)).join('') : `
                  <tr>
                    <td colspan="6" class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">No hay muestras registradas.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }

  function renderMuestraRow(muestra, pozoId) {
    const id = muestra.id || muestra.id_muestra || muestra.id_muestras || muestra.muestra_id || '';
    const fecha = dateKey(muestra.fecha);
    const ays = muestra.ays ?? muestra.porcentaje_ays ?? muestra.porcentaje_agua_sedimentos ?? '';
    const representativa = normalizeBoolean(muestra.representativa ?? muestra.es_representativa ?? muestra.muestra_representativa);

    return `
      <tr class="border-b bg-white dark:border-slate-800 dark:bg-slate-900">
        <td class="whitespace-nowrap px-4 py-3" data-order="${escapeHTML(fecha)}">${escapeHTML(formatDate(muestra.fecha))}</td>
        <td class="whitespace-nowrap px-4 py-3" data-order="${escapeHTML(ays)}">${formatNumber(ays, 2)}</td>
        <td class="whitespace-nowrap px-4 py-3">${formatNumber(muestra.porcentaje_liq, 2)}</td>
        <td class="whitespace-nowrap px-4 py-3">${formatNumber(muestra.api, 2)}</td>
        <td class="whitespace-nowrap px-4 py-3">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" class="peer sr-only" data-muestra-representativa="true" data-muestra-id="${escapeHTML(id)}" data-pozo-id="${escapeHTML(pozoId || muestra.id_pozo || muestra.pozo_id || '')}" data-fecha="${escapeHTML(fecha)}" data-ays="${escapeHTML(ays)}" ${representativa ? 'checked' : ''}>
            <span class="h-5 w-9 rounded-full bg-slate-300 after:mt-0.5 after:ml-0.5 after:block after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-4 dark:bg-slate-700"></span>
            <span data-muestra-switch-label class="min-w-[18px] text-left text-xs font-semibold ${representativa ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}">${representativa ? 'Sí' : 'No'}</span>
          </label>
        </td>
        <td class="whitespace-nowrap px-4 py-3">
          <button type="button" data-pozo-action="editar-muestra" data-muestra-id="${escapeHTML(id)}" class="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Editar</button>
        </td>
      </tr>
    `;
  }

  function normalizeBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    const text = normalizeText(value);
    return text === '1' || text === 'true' || text === 'si' || text === 'yes' || text === 'representativa';
  }

  function renderParametrosModal(parametros, codigoPozo) {
    return renderGenericModal({
      id: 'modal-historial-parametros',
      title: `Histórico de parámetros - ${codigoPozo}`,
      tableId: 'tabla-historial-parametros-pozo',
      minWidth: '1200px',
      columns: [
        ['Fecha', (row) => formatDate(row.fecha)],
        ['Torque', (row) => formatNumber(row.torque, 2)],
        ['AMP', (row) => formatNumber(row.amp, 2)],
        ['Freq', (row) => formatNumber(row.freq, 2)],
        ['Volts', (row) => formatNumber(row.volts, 2)],
        ['HP', (row) => formatNumber(row.hp, 2)],
        ['VO', (row) => formatNumber(row.vel_operacional, 2)],
        ['Vel. actual', (row) => formatNumber(row.vel_actual, 2)],
        ['P. casing', (row) => formatNumber(row.presion_casing, 2)],
        ['P. tubing', (row) => formatNumber(row.presion_tubing, 2)],
        ['Observación', (row) => fallback(row.observacion)],
        ['Recomendación', (row) => fallback(row.recomendaciones_completas || row.recomendacion || row.recomendaciones)]
      ],
      rows: parametros
    });
  }

  function renderNivelesModal(niveles, codigoPozo) {
    return renderGenericModal({
      id: 'modal-historial-niveles',
      title: `Histórico de niveles - ${codigoPozo}`,
      tableId: 'tabla-historial-niveles-pozo',
      minWidth: '1320px',
      columns: [
        ['Fecha', (row) => formatDate(row.fecha)],
        ['NF pies', (row) => formatNumber(row.nf_pies, 2)],
        ['SUM', (row) => formatNumber(row.sumergencia, 2)],
        ['% Liq', (row) => formatNumber(row.porcentaje_liq, 2)],
        ['PIP', (row) => formatNumber(row.pip, 2)],
        ['PBHP', (row) => formatNumber(row.pbhp, 2)],
        ['P. casing', (row) => formatNumber(row.presion_casing, 2)],
        ['P. tubing', (row) => formatNumber(row.presion_tubing, 2)],
        ['RPM', (row) => formatNumber(row.rpm, 2)],
        ['Torque', (row) => formatNumber(row.torque, 2)],
        ['AMP', (row) => formatNumber(row.amp, 2)],
        ['HP', (row) => formatNumber(row.hp, 2)],
        ['Diagnóstico', (row) => fallback(row.diagnostico)],
        ['Recomendación ejecutada', (row) => fallback(row.recomendacion_ejecutada || row.recomendacion)]
      ],
      rows: niveles
    });
  }

  function renderComparativoModal(comparativo, codigoPozo) {
    return renderGenericModal({
      id: 'modal-comparativo-parametros-niveles',
      title: `Comparativo parámetros vs niveles - ${codigoPozo}`,
      tableId: 'tabla-comparativo-parametros-niveles',
      minWidth: '1600px',
      columns: [
        ['Fecha nivel', (row) => formatDate(row.fecha_nivel || row.fecha)],
        ['Fecha param', (row) => row.fecha_parametro ? formatDate(row.fecha_parametro) : '—'],
        ['RPM param', (row) => formatNumber(row.rpm_parametros, 2)],
        ['RPM nivel', (row) => formatNumber(row.rpm_nivel, 2)],
        ['Dif RPM', (row) => formatNumber(row.dif_rpm, 2)],
        ['Torque param', (row) => formatNumber(row.torque_parametros, 2)],
        ['Torque nivel', (row) => formatNumber(row.torque_nivel, 2)],
        ['Dif torque', (row) => formatNumber(row.dif_torque, 2)],
        ['AMP param', (row) => formatNumber(row.amp_parametros, 2)],
        ['AMP nivel', (row) => formatNumber(row.amp_nivel, 2)],
        ['Dif AMP', (row) => formatNumber(row.dif_amp, 2)],
        ['HP param', (row) => formatNumber(row.hp_parametros, 2)],
        ['HP nivel', (row) => formatNumber(row.hp_nivel, 2)],
        ['Dif HP', (row) => formatNumber(row.dif_hp, 2)],
        ['Casing param', (row) => formatNumber(row.casing_parametros, 2)],
        ['Casing nivel', (row) => formatNumber(row.casing_nivel, 2)],
        ['Dif casing', (row) => formatNumber(row.dif_presion_casing, 2)],
        ['Tubing param', (row) => formatNumber(row.tubing_parametros, 2)],
        ['Tubing nivel', (row) => formatNumber(row.tubing_nivel, 2)],
        ['Dif tubing', (row) => formatNumber(row.dif_presion_tubing, 2)]
      ],
      rows: comparativo
    });
  }

  function renderBombasModal(bombas, codigoPozo) {
    return renderGenericModal({
      id: 'modal-historial-bombas',
      title: `Historial de bombas - ${codigoPozo}`,
      tableId: 'tabla-historial-bombas-pozo',
      minWidth: '980px',
      columns: [
        ['Método', (row) => fallback(row.metodo || row.id_metodo)],
        ['Marca', (row) => fallback(row.marca)],
        ['Modelo', (row) => fallback(row.modelo)],
        ['Serial', (row) => fallback(row.serial || row.serial_rotor || row.serial_estator)],
        ['Instalación', (row) => formatDate(row.fecha_inst || row.fecha_instalacion)],
        ['Falla', (row) => formatDate(row.fecha_falla)],
        ['TVU', (row) => row.tvu_dias != null ? `${formatNumber(row.tvu_dias, 0)} días` : '—'],
        ['Estatus', (row) => fallback(row.estatus || row.estado)],
        ['Observaciones', (row) => fallback(row.observaciones || row.observacion)]
      ],
      rows: bombas
    });
  }

  function renderGenericModal({ id, title, tableId, minWidth, columns, rows }) {
    return `
      <div id="${escapeHTML(id)}" class="fixed inset-0 z-50 hidden bg-slate-900/60 p-0 sm:p-4" role="dialog" aria-modal="true" data-pozo-modal>
        <div class="flex min-h-dvh w-full items-end justify-center sm:min-h-full sm:items-center" data-pozo-modal-backdrop="true">
          <div class="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:max-h-[90vh] sm:max-w-7xl sm:rounded-2xl">
            <div class="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">${escapeHTML(title)}</h3>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Registros locales asociados a este pozo.</p>
                </div>
                <button type="button" data-pozo-close-modal="${escapeHTML(id)}" aria-label="Cerrar modal" class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white">
                  <i class="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:p-4">
              <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table id="${escapeHTML(tableId)}" style="min-width:${escapeHTML(minWidth)}" class="w-full text-left text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                  <thead class="bg-slate-50 text-[10px] uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:text-xs">
                    <tr>
                      ${columns.map(([label]) => `<th class="whitespace-nowrap px-3 py-3 sm:px-4">${escapeHTML(label)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${rows.length ? rows.map((row, index) => `
                      <tr class="${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/80 dark:bg-slate-800/50'}">
                        ${columns.map(([, getter]) => `<td class="whitespace-nowrap px-3 py-3 sm:px-4">${escapeHTML(getter(row))}</td>`).join('')}
                      </tr>
                    `).join('') : `
                      <tr>
                        <td colspan="${columns.length}" class="px-4 py-6 text-center text-slate-500 dark:text-slate-400">Sin registros locales.</td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:hidden">
              <button type="button" data-pozo-close-modal="${escapeHTML(id)}" class="inline-flex w-full items-center justify-center rounded-full bg-[#033F73] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#022f56]">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSurveyModal(pozo) {
    return `
      <div id="modal-survey-pozo" class="fixed inset-0 z-50 hidden bg-slate-900/60 p-0 sm:p-4" role="dialog" aria-modal="true" data-pozo-modal>
        <div class="flex min-h-dvh w-full items-end justify-center sm:min-h-full sm:items-center" data-pozo-modal-backdrop="true">
          <div class="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:max-h-[90vh] sm:max-w-5xl sm:rounded-2xl">
            <div class="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">Pegar survey - ${escapeHTML(pozo.codigo || 'pozo')}</h3>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Pega una tabla desde Excel con columnas MD, TVD, x-offset y y-offset.</p>
                </div>
                <button type="button" data-pozo-close-modal="modal-survey-pozo" aria-label="Cerrar carga de survey" class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white">
                  <i class="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>
            </div>
            <form id="form-survey-pozo" data-pozo-id="${escapeHTML(pozo.id || '')}" class="min-h-0 flex-1 overflow-y-auto p-4">
              <label class="mb-2 block text-sm font-medium text-slate-900 dark:text-white">Tabla de survey</label>
              <textarea name="survey_text" rows="14" class="min-h-[320px] w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 focus:border-[#033F73] focus:ring-[#033F73] dark:border-slate-600 dark:bg-slate-800 dark:text-white" placeholder="MD&#9;TVD&#9;x-offset&#9;y-offset"></textarea>
              <div id="survey-form-message" class="mt-3 hidden rounded-lg p-3 text-sm"></div>
              <div class="mt-4 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:justify-end">
                <button type="button" data-pozo-close-modal="modal-survey-pozo" class="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:py-1.5 sm:text-xs">Cancelar</button>
                <button type="submit" class="inline-flex items-center justify-center rounded-full bg-[#033F73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#022f56] sm:py-1.5 sm:text-xs">Guardar survey</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  async function renderPozoDetalle(idPozo) {
    try {
      hideAlert();
      state.route = 'pozo-detalle';
      setActiveNav('');

      setText('offline-page-title', 'Cargando pozo...');

      els.view.innerHTML = `
        <div class="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
              <span class="animate-pulse text-xl">🛢️</span>
            </div>
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Cargando ficha desde datos locales...</p>
          </div>
        </div>
      `;

      debug('Abriendo pozo offline', { idPozo });

      const full = await window.PetroOfflineStore.getPozoFull(idPozo);
      const data = normalizeFullData(full || {}, idPozo);
      const pozo = data.pozo || {};

      debug('Datos reconstruidos', {
        pozo: pozo.codigo || pozo.id,
        counts: {
          parametros: data.timeline.parametros.length,
          niveles: data.timeline.niveles.length,
          muestras: data.timeline.muestras.length,
          bombas: data.historialBombas.length,
          survey: data.survey.length
        }
      });

      if (!pozo || !pozo.id) {
        throw new Error('El pozo no existe en IndexedDB o no se descargó en el snapshot offline.');
      }

      renderPozoDetalleShell(data, idPozo);

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      handleRenderError(error, 'No se pudo abrir la ficha del pozo desde los datos locales.');
    }
  }

  async function renderDiagnostico() {
    try {
      hideAlert();
      state.route = 'diagnostico';
      setActiveNav('diagnostico');
      setText('offline-page-title', 'Datos locales');

      const diagnostics = await window.PetroOfflineStore.getDiagnostics();
      const syncDiagnostics = window.PetroSync?.getDiagnostics
        ? await window.PetroSync.getDiagnostics()
        : null;

      els.view.innerHTML = `
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Diagnóstico local</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Conteos guardados en IndexedDB.</p>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            ${Object.entries(diagnostics.counts || {}).map(([key, value]) => card(key, value)).join('')}
          </div>

          <pre class="mt-4 max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">${escapeHTML(JSON.stringify({
            boot: window.PETRO_OFFLINE_BOOT || null,
            store: diagnostics,
            sync: syncDiagnostics,
            online: navigator.onLine,
            path: window.location.pathname
          }, null, 2))}</pre>
        </section>
      `;
    } catch (error) {
      handleRenderError(error, 'No se pudo cargar el diagnóstico offline.');
    }
  }

  function handleRenderError(error, message) {
    console.error('[OfflineShell]', error);
    debug('Error', {
      message: error?.message || String(error),
      stack: error?.stack || null
    });

    showAlert(`${message} ${error?.message || ''}`.trim(), 'error');

    if (els.view) {
      els.view.innerHTML = `
        <section class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
          <h3 class="text-base font-bold">No se pudo cargar la vista offline</h3>
          <p class="mt-2 text-sm">${escapeHTML(error?.message || message)}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" id="offline-retry-current" class="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Reintentar</button>
            <button type="button" id="offline-go-pozos" class="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40">Ir a pozos locales</button>
          </div>
        </section>
      `;

      $('#offline-retry-current')?.addEventListener('click', () => routeFromInitialPath());
      $('#offline-go-pozos')?.addEventListener('click', () => {
        updateUrl('/pozos');
        setRoute('pozos');
      });
    }
  }

  function updateHeaderStatus() {
    const online = navigator.onLine;

    setText('offline-network-state', online ? 'Con conexión' : 'Sin conexión');
    setText('offline-status-label', online ? 'Datos locales disponibles' : 'Usando datos locales');

    window.PetroOfflineStore.getSnapshotInfo()
      .then((info) => {
        setText('offline-last-sync', info.lastSnapshotAt ? `Última sync: ${formatDate(info.lastSnapshotAt)}` : 'Última sync: —');
      })
      .catch(() => {});
  }

  async function routeFromInitialPath() {
    const initialPath = window.location.pathname;
    const pozoMatch = initialPath.match(/^\/pozos\/(\d+)\/?$/);

    debug('Ruta inicial', { initialPath });

    if (pozoMatch) {
      await renderPozoDetalle(pozoMatch[1]);
      return;
    }

    if (initialPath === '/pozos' || initialPath === '/pozos/') {
      setRoute('pozos', { keepUrl: true });
      return;
    }

    setRoute('dashboard', { keepUrl: true });
  }

  async function bootstrap() {
    els.view = $('#offline-view');
    els.alert = $('#offline-alert');

    try {
      debug('Bootstrap offline iniciado', window.PETRO_OFFLINE_BOOT || null);

      if (!els.view) {
        throw new Error('No existe #offline-view en offline-app.html.');
      }

      if (!window.PetroDB && !window.PetroOfflineDB) {
        throw new Error('No se cargó el módulo de IndexedDB. Verifica /js/offline/db.js en caché.');
      }

      if (!window.PetroOfflineStore) {
        throw new Error('No se cargó PetroOfflineStore. Verifica /js/offline/store.js en caché.');
      }

      const info = await window.PetroOfflineStore.getSnapshotInfo();

      debug('Snapshot info', info);

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
          await routeFromInitialPath();
        } catch (error) {
          showAlert(error.message || 'No se pudo sincronizar.', 'error');
        }
      });

      document.addEventListener('click', (event) => {
        const routeBtn = event.target.closest('[data-offline-route]');
        if (!routeBtn) return;

        event.preventDefault();
        setRoute(routeBtn.dataset.offlineRoute);
      });

      window.addEventListener('online', updateHeaderStatus);
      window.addEventListener('offline', updateHeaderStatus);
      window.addEventListener('popstate', () => routeFromInitialPath());

      window.PetroOfflineShell = {
        goToPozos() {
          updateUrl('/pozos');
          setRoute('pozos');
        },
        openPozo(idPozo) {
          updateUrl(`/pozos/${idPozo}`);
          return renderPozoDetalle(idPozo);
        },
        routeFromInitialPath,
        renderPozoDetalle
      };

      updateHeaderStatus();
      await routeFromInitialPath();
    } catch (error) {
      handleRenderError(error, 'No se pudo inicializar el shell offline.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();