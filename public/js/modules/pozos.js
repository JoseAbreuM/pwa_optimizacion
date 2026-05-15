(() => {
  const POZOS_JS_VERSION = 'pozos.js-no-cache-velocidades-2026-05-14-v8';

  console.log(`[POZOS_JS] cargado: ${POZOS_JS_VERSION}`);

  const COL = {
    POZO: 0,
    ESTADO: 1,
    CATEGORIA: 2,
    AREA: 3,
    POTENCIAL: 4,
    VELOCIDADES: 5,
    VARIADOR: 6,
    CABEZAL: 7,
    ACCION: 8
  };

  const FILTER_COLUMNS = [
    COL.ESTADO,
    COL.CATEGORIA,
    COL.AREA,
    COL.VARIADOR,
    COL.CABEZAL
  ];

  let activeMenu = null;
  let pozosTable = null;

  function init() {
    initPozosTable();
    initPotencialButtons();
  }

  function initPozosTable() {
    if (typeof window.DataTable === 'undefined') {
      console.error('DataTables no está cargado. Revisa mainLayout.ejs.');
      return;
    }

    const tableEl = document.getElementById('tabla-pozos');
    if (!tableEl) return;

    if (window.DataTable.isDataTable('#tabla-pozos')) return;

    decorateColumnFilterHeaders('tabla-pozos');

    const baseUrl = tableEl.dataset.source || '/pozos/data';
    const separator = baseUrl.includes('?') ? '&' : '?';
    const ajaxUrl = `${baseUrl}${separator}_=${Date.now()}`;

    console.log('[Pozos] AJAX URL:', ajaxUrl);

    pozosTable = new window.DataTable('#tabla-pozos', {
      ajax: {
        url: ajaxUrl,
        cache: false,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        dataSrc: function (json) {
          if (!json || json.ok === false) {
            showToast(json?.message || 'No se pudo cargar la lista de pozos.', 'error');
            return [];
          }

          const rows = Array.isArray(json.data)
            ? json.data.map(normalizeApiRow)
            : [];

          const rowsWithSpeed = rows
            .filter((row) => hasValue(row._vel_actual) || hasValue(row._vel_operacional))
            .slice(0, 10)
            .map((row) => ({
              codigo: row.codigo,
              vel_actual: row._vel_actual,
              vel_operacional: row._vel_operacional
            }));

          console.log('[Pozos] JS version:', POZOS_JS_VERSION);
          console.log('[Pozos] Service version:', json.serviceVersion || 'SIN_VERSION');
          console.log('[Pozos] Raw total:', json.rawTotal);
          console.log('[Pozos] Total recibido:', rows.length);
          console.log('[Pozos] Pozos con velocidades:', rowsWithSpeed);
          console.log('[Pozos] Muestra API:', json.sample || rows[0] || null);

          return rows;
        },
        error: function (xhr) {
          console.error('[Pozos] Error consultando /pozos/data:', xhr);
          showToast('Error consultando /pozos/data.', 'error');
        }
      },

      processing: true,
      deferRender: true,
      pageLength: 25,
      lengthMenu: [10, 25, 50, 100],
      scrollX: true,
      colReorder: false,
      orderCellsTop: true,
      ordering: true,

      columns: [
        {
          data: null,
          render: function (data, type, row) {
            const pozo = getRow(data, row);

            const id = escapeHtml(pozo.id ?? '');
            const codigo = pozo.codigo || '—';
            const yacimiento = pozo.yacimiento || '';

            if (type !== 'display') {
              return `${codigo} ${yacimiento}`;
            }

            return `
              <div class="min-w-[130px]">
                <a
                  href="/pozos/${id}"
                  class="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >
                  ${escapeHtml(codigo)}
                </a>
                ${
                  yacimiento
                    ? `<div class="mt-0.5 max-w-[220px] truncate text-xs text-slate-500 dark:text-slate-400">${escapeHtml(yacimiento)}</div>`
                    : `<div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sin yacimiento</div>`
                }
              </div>
            `;
          }
        },

        {
          data: null,
          render: function (data, type, row) {
            const pozo = getRow(data, row);
            const estado = getEstado(pozo);

            if (type !== 'display') {
              return estado;
            }

            const color = colorByEstado(estado);

            return `
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                style="background-color: ${escapeHtml(color)}"
              >
                ${escapeHtml(estado)}
              </span>
            `;
          }
        },

        {
          data: null,
          render: function (data, type, row) {
            const pozo = getRow(data, row);

            const value = getFirstValue(pozo, [
              'categoria',
              'cat',
              'categoria_pozo'
            ]);

            if (type !== 'display') {
              return hasValue(value) ? String(value) : '';
            }

            if (!hasValue(value)) return '—';

            return `
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Cat. ${escapeHtml(value)}
              </span>
            `;
          }
        },

        {
          data: null,
          defaultContent: '—',
          render: function (data, type, row) {
            const pozo = getRow(data, row);
            const value = getFirstValue(pozo, ['area', 'zona']);

            if (type !== 'display') {
              return value || '';
            }

            return `
              <span class="text-slate-700 dark:text-slate-300">
                ${escapeHtml(value || '—')}
              </span>
            `;
          }
        },

        {
          data: null,
          render: function (data, type, row) {
            const pozo = getRow(data, row);
            const value = getFirstValue(pozo, ['potencial']);

            if (type !== 'display') {
              return hasValue(value) ? Number(value) || 0 : '';
            }

            const formatted = formatLocalNumber(value, 2);
            const id = escapeHtml(pozo.id ?? '');
            const codigo = escapeHtml(pozo.codigo || '');
            const rawPotencial = hasValue(value) ? value : '';

            return `
              <div class="flex items-center gap-2 whitespace-nowrap">
                <span data-potencial-value class="font-semibold text-slate-900 dark:text-white">
                  ${formatted}
                </span>

                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-[#033F73] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-sky-300"
                  data-edit-potencial
                  data-pozo-id="${id}"
                  data-pozo-codigo="${codigo}"
                  data-potencial="${escapeHtml(rawPotencial)}"
                  title="Editar potencial"
                  aria-label="Editar potencial de ${codigo || 'pozo'}"
                >
                  <i class="fa-solid fa-pen text-[11px]"></i>
                </button>
              </div>
            `;
          }
        },

        {
          data: null,
          className: 'align-middle',
          render: function (data, type, row) {
            const pozo = getRow(data, row);

            const velActual = getVelActual(pozo);
            const velOperacional = getVelOperacional(pozo);

            if (type !== 'display') {
              return [
                hasValue(velActual) ? `Actual ${velActual}` : '',
                hasValue(velOperacional) ? `Operacional ${velOperacional}` : ''
              ].filter(Boolean).join(' ');
            }

            return `
              <div
                class="min-w-[150px] text-xs leading-5 text-slate-700 dark:text-slate-200"
                data-vel-cell
                data-vel-actual="${escapeHtml(velActual ?? '')}"
                data-vel-operacional="${escapeHtml(velOperacional ?? '')}"
              >
                <div class="whitespace-nowrap">
                  <span class="font-semibold text-slate-500 dark:text-slate-400">Actual:</span>
                  <span class="ml-1 font-bold text-slate-900 dark:text-white">
                    ${hasValue(velActual) ? escapeHtml(formatLocalNumber(velActual, 2)) : '—'}
                  </span>
                </div>

                <div class="whitespace-nowrap">
                  <span class="font-semibold text-slate-500 dark:text-slate-400">Operacional:</span>
                  <span class="ml-1 font-bold text-slate-700 dark:text-slate-200">
                    ${hasValue(velOperacional) ? escapeHtml(formatLocalNumber(velOperacional, 2)) : '—'}
                  </span>
                </div>
              </div>
            `;
          }
        },

        {
          data: null,
          defaultContent: '—',
          render: function (data, type, row) {
            const pozo = getRow(data, row);

            const variador = cleanDashValue(getFirstValue(pozo, [
              'variador',
              'vdf',
              'marca_vdf',
              'nombre_vdf',
              'variador_marca'
            ]));

            const capacidad = cleanDashValue(getFirstValue(pozo, [
              'variador_capacidad',
              'capacidad_variador',
              'vdf_capacidad',
              'capacidad_vdf',
              'capacidad'
            ]));

            const potenciaHp = getFirstValue(pozo, [
              'variador_potencia_hp',
              'potencia_hp',
              'vdf_potencia_hp',
              'hp_variador',
              'hp_vdf'
            ]);

            if (type !== 'display') {
              return [
                variador,
                hasValue(capacidad) ? capacidad : '',
                hasValue(potenciaHp) ? `${potenciaHp} HP` : ''
              ].filter(Boolean).join(' ');
            }

            return `
              <div class="min-w-[120px]">
                <div class="text-slate-700 dark:text-slate-300">
                  ${escapeHtml(variador || '—')}
                </div>

                ${
                  hasValue(capacidad) || hasValue(potenciaHp)
                    ? `
                      <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        ${escapeHtml(
                          [
                            hasValue(capacidad) ? capacidad : '',
                            hasValue(potenciaHp) ? `${formatLocalNumber(potenciaHp, 2)} HP` : ''
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        )}
                      </div>
                    `
                    : ''
                }
              </div>
            `;
          }
        },

        {
          data: null,
          defaultContent: '—',
          render: function (data, type, row) {
            const pozo = getRow(data, row);

            const value = cleanDashValue(getFirstValue(pozo, [
              'cabezal',
              'cabezal_nombre',
              'marca_cabezal',
              'motor_cabezal'
            ]));

            if (type !== 'display') {
              return value || '';
            }

            return `
              <span class="text-slate-700 dark:text-slate-300">
                ${escapeHtml(value || '—')}
              </span>
            `;
          }
        },

        {
          data: null,
          orderable: false,
          searchable: false,
          render: function (data, type, row) {
            const pozo = getRow(data, row);
            const id = escapeHtml(pozo.id ?? '');

            if (type !== 'display') return '';

            return `
              <a
                href="/pozos/${id}"
                class="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 font-medium text-[#033F73] transition hover:bg-slate-100 dark:border-slate-700 dark:text-sky-300 dark:hover:bg-slate-800"
              >
                Ver ficha
              </a>
            `;
          }
        }
      ],

      columnDefs: [
        {
          targets: [
            COL.ESTADO,
            COL.CATEGORIA,
            COL.AREA,
            COL.VARIADOR,
            COL.CABEZAL,
            COL.ACCION
          ],
          orderable: false
        },
        {
          targets: COL.ACCION,
          searchable: false
        }
      ],

      language: getSpanishDataTablesLanguage(),

      initComplete: function () {
        bindColumnFilters(pozosTable, 'tabla-pozos');
      }
    });
  }

  function normalizeApiRow(row = {}) {
    const velActual = getRawVelActual(row);
    const velOperacional = getRawVelOperacional(row);
    const estado = getEstado(row);

    return {
      ...row,

      estado,

      estado_color: colorByEstado(estado),
      color_estado_mapa: colorByEstado(estado),

      _vel_actual: velActual,
      _vel_operacional: velOperacional,

      vel_actual: velActual,
      velocidad_actual: velActual,
      rpm: velActual,

      vel_operacional: velOperacional,
      velocidad_operacional: velOperacional
    };
  }

  function initPotencialButtons() {
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-edit-potencial]');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const pozoId = button.dataset.pozoId;
      const pozoCodigo = button.dataset.pozoCodigo || 'pozo';
      const currentValue = button.dataset.potencial || '';

      if (!pozoId) {
        showToast('No se pudo identificar el pozo.', 'error');
        return;
      }

      const input = window.prompt(
        `Nuevo potencial para ${pozoCodigo}:`,
        currentValue
      );

      if (input === null) return;

      const potencial = String(input).trim().replace(',', '.');

      if (potencial === '') {
        showToast('Debes indicar un potencial válido.', 'error');
        return;
      }

      const number = Number(potencial);

      if (!Number.isFinite(number) || number < 0) {
        showToast('El potencial debe ser un número válido mayor o igual a 0.', 'error');
        return;
      }

      await updatePotencial({
        pozoId,
        potencial: number,
        button
      });
    });
  }

  async function updatePotencial({ pozoId, potencial, button }) {
    const originalHtml = button.innerHTML;

    try {
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

      const response = await fetch(`/pozos/${pozoId}/potencial?_=${Date.now()}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        body: JSON.stringify({ potencial })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'No se pudo actualizar el potencial.');
      }

      button.dataset.potencial = String(result.potencial ?? potencial);

      showToast(result.message || 'Potencial actualizado correctamente.', 'success');

      if (pozosTable && pozosTable.ajax) {
        pozosTable.ajax.reload(null, false);
      } else {
        updatePotencialCell(button, result.potencial ?? potencial);
      }
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar el potencial.', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function updatePotencialCell(button, potencial) {
    const row = button.closest('tr');
    if (!row) return;

    const cell = row.children[COL.POTENCIAL];
    if (!cell) return;

    const valueEl = cell.querySelector('[data-potencial-value]');
    const formatted = formatLocalNumber(potencial, 2);

    if (valueEl) {
      valueEl.textContent = formatted;
    }

    if (pozosTable && typeof pozosTable.row === 'function') {
      try {
        pozosTable.row(row).invalidate('dom').draw(false);
      } catch (error) {
        // Evita romper la tabla si la API cambia.
      }
    }
  }

  function decorateColumnFilterHeaders(tableId) {
    const table = document.getElementById(tableId);
    const headers = table?.querySelectorAll('thead tr:first-child th');

    if (!table || !headers?.length) return;

    headers.forEach((th, index) => {
      const title = th.textContent.trim();
      const hasFilter = FILTER_COLUMNS.includes(index);

      th.dataset.columnIndex = String(index);

      if (!hasFilter) {
        th.innerHTML = `<span class="dt-column-title">${escapeHtml(title)}</span>`;
        return;
      }

      th.innerHTML = `
        <div class="dt-column-action-header">
          <span class="dt-column-title">${escapeHtml(title)}</span>

          <button
            type="button"
            class="dt-column-dropdown-toggle"
            aria-label="Filtrar columna ${escapeHtml(title)}"
            data-column-filter-toggle
            data-column-index="${index}"
          >
            <i class="fa-solid fa-filter"></i>
          </button>
        </div>
      `;
    });
  }

  function bindColumnFilters(dataTable, tableId) {
    const table = document.getElementById(tableId);
    if (!table || !dataTable) return;

    document.querySelectorAll('[data-column-filter-toggle]').forEach((toggle) => {
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const columnIndex = Number(toggle.dataset.columnIndex);
        const title =
          toggle.closest('th')?.querySelector('.dt-column-title')?.textContent?.trim() ||
          'Columna';

        openColumnFilterMenu({
          dataTable,
          toggle,
          columnIndex,
          title
        });
      });
    });

    document.addEventListener('click', closeActiveMenu);
    window.addEventListener('resize', closeActiveMenu);
    window.addEventListener('scroll', closeActiveMenu, true);
  }

  function openColumnFilterMenu({ dataTable, toggle, columnIndex, title }) {
    closeActiveMenu();

    const values = getUniqueColumnValues(dataTable, columnIndex);
    const currentSearch = dataTable.column(columnIndex).search();

    const menu = document.createElement('div');
    menu.className = 'dt-floating-filter-menu';
    menu.innerHTML = `
      <div class="dt-floating-filter-title">${escapeHtml(title)}</div>

      <button
        type="button"
        class="dt-floating-filter-option ${!currentSearch ? 'is-active' : ''}"
        data-filter-value=""
      >
        Todos
      </button>

      ${values
        .map((value) => {
          const active = currentSearch === makeExactSearch(value);

          return `
            <button
              type="button"
              class="dt-floating-filter-option ${active ? 'is-active' : ''}"
              data-filter-value="${escapeHtml(value)}"
            >
              ${escapeHtml(value)}
            </button>
          `;
        })
        .join('')}
    `;

    document.body.appendChild(menu);
    positionMenu(menu, toggle);

    menu.addEventListener('click', (event) => {
      event.stopPropagation();

      const button = event.target.closest('[data-filter-value]');
      if (!button) return;

      const value = button.dataset.filterValue || '';

      if (value) {
        dataTable
          .column(columnIndex)
          .search(makeExactSearch(value), true, false)
          .draw();
      } else {
        dataTable
          .column(columnIndex)
          .search('')
          .draw();
      }

      toggle.classList.toggle('is-active', Boolean(value));
      closeActiveMenu();
    });

    activeMenu = menu;
  }

  function getUniqueColumnValues(dataTable, columnIndex) {
    const values = new Set();

    dataTable.column(columnIndex).data().each((cellValue) => {
      const cleanValue = cleanCellValue(cellValue, columnIndex);
      if (cleanValue) values.add(cleanValue);
    });

    return Array.from(values).sort((a, b) => {
      return a.localeCompare(b, 'es', {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  function cleanCellValue(value, columnIndex) {
    if (value && typeof value === 'object') {
      if (columnIndex === COL.ESTADO) {
        return getEstado(value);
      }

      if (columnIndex === COL.CATEGORIA) {
        return String(getFirstValue(value, ['categoria', 'cat']) || '').trim();
      }

      if (columnIndex === COL.AREA) {
        return String(getFirstValue(value, ['area', 'zona']) || '').trim();
      }

      if (columnIndex === COL.VARIADOR) {
        return String(cleanDashValue(getFirstValue(value, ['variador', 'vdf', 'marca_vdf'])) || '').trim();
      }

      if (columnIndex === COL.CABEZAL) {
        return String(cleanDashValue(getFirstValue(value, ['cabezal', 'cabezal_nombre', 'marca_cabezal'])) || '').trim();
      }
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = String(value ?? '');

    let text = wrapper.innerText
      .replace(/\s+/g, ' ')
      .trim();

    if (columnIndex === COL.CATEGORIA) {
      text = text.replace(/^Cat\.\s*/i, '').trim();
    }

    return text;
  }

  function positionMenu(menu, toggle) {
    const rect = toggle.getBoundingClientRect();

    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
    menu.style.zIndex = '9999';
  }

  function closeActiveMenu() {
    if (activeMenu) {
      activeMenu.remove();
      activeMenu = null;
    }
  }

  function showToast(message, type = 'success') {
    let toast = document.getElementById('pozos-toast');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pozos-toast';
      toast.className = [
        'fixed',
        'right-4',
        'top-4',
        'z-[99999]',
        'hidden',
        'rounded-xl',
        'px-4',
        'py-3',
        'text-sm',
        'font-semibold',
        'shadow-lg'
      ].join(' ');

      document.body.appendChild(toast);
    }

    toast.classList.remove(
      'hidden',
      'bg-green-50',
      'text-green-700',
      'bg-red-50',
      'text-red-700',
      'dark:bg-green-900',
      'dark:text-green-200',
      'dark:bg-red-900',
      'dark:text-red-200'
    );

    if (type === 'error') {
      toast.classList.add(
        'bg-red-50',
        'text-red-700',
        'dark:bg-red-900',
        'dark:text-red-200'
      );
    } else {
      toast.classList.add(
        'bg-green-50',
        'text-green-700',
        'dark:bg-green-900',
        'dark:text-green-200'
      );
    }

    toast.textContent = message;

    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  function getRow(data, row) {
    return row || data || {};
  }

  function getEstado(row) {
    return getFirstValue(row, [
      'estado',
      'estado_pozo',
      'nombre_estado',
      'estatus',
      'status'
    ]) || 'Sin estado';
  }

  function getVelActual(row) {
    if (!row || typeof row !== 'object') return null;

    return firstNotEmpty([
      row._vel_actual,
      row.vel_actual,
      row.velocidad_actual,
      row.rpm,
      row.velocidad,
      row.velocidad_rpm,
      row.rpm_actual
    ]);
  }

  function getVelOperacional(row) {
    if (!row || typeof row !== 'object') return null;

    return firstNotEmpty([
      row._vel_operacional,
      row.vel_operacional,
      row.velocidad_operacional,
      row.vo,
      row.v_o,
      row.voperacional,
      row.rpm_operacional
    ]);
  }

  function getRawVelActual(row) {
    if (!row || typeof row !== 'object') return null;

    return firstNotEmpty([
      row.vel_actual,
      row.velocidad_actual,
      row.rpm,
      row.velocidad,
      row.velocidad_rpm,
      row.rpm_actual
    ]);
  }

  function getRawVelOperacional(row) {
    if (!row || typeof row !== 'object') return null;

    return firstNotEmpty([
      row.vel_operacional,
      row.velocidad_operacional,
      row.vo,
      row.v_o,
      row.voperacional,
      row.rpm_operacional
    ]);
  }

  function getFirstValue(row, keys) {
    for (const key of keys) {
      const value = row?.[key];

      if (hasValue(value)) {
        return value;
      }
    }

    return null;
  }

  function firstNotEmpty(values = []) {
    for (const value of values) {
      if (hasValue(value)) return value;
    }

    return null;
  }

  function hasValue(value) {
    return value !== null &&
      value !== undefined &&
      String(value).trim() !== '';
  }

  function cleanDashValue(value) {
    if (!hasValue(value)) return '';

    const clean = String(value).trim();

    if (
      clean === '-' ||
      clean === '.' ||
      clean === ',' ||
      clean.toLowerCase() === 'null' ||
      clean.toLowerCase() === 'undefined' ||
      clean.toLowerCase() === 'sin dato' ||
      clean.toLowerCase() === 'sin datos'
    ) {
      return '';
    }

    return clean;
  }

  function colorByEstado(estado) {
    const clean = normalizeText(estado);

    if (clean.includes('candidato')) return '#ef4444';
    if (clean === 'en servicio') return '#f59e0b';
    if (clean.includes('espera')) return '#64748b';
    if (clean.includes('diferido')) return '#ef4444';
    if (clean.includes('diagnostico')) return '#9333ea';
    if (clean.includes('activo')) return '#22c55e';

    return '#033F73';
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function makeExactSearch(value) {
    return `^${escapeRegex(value)}$`;
  }

  function formatLocalNumber(value, decimals = 2) {
    if (!hasValue(value)) return '—';

    const number = Number(String(value).trim().replace(',', '.'));

    if (!Number.isFinite(number)) {
      return String(value);
    }

    return number.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getSpanishDataTablesLanguage() {
    return {
      processing: 'Cargando pozos...',
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_ registros',
      info: 'Mostrando _START_ a _END_ de _TOTAL_ pozos',
      infoEmpty: 'Mostrando 0 a 0 de 0 pozos',
      infoFiltered: '(filtrado de _MAX_ pozos totales)',
      loadingRecords: 'Cargando...',
      zeroRecords: 'No se encontraron pozos',
      emptyTable: 'No hay pozos disponibles',
      paginate: {
        first: 'Primero',
        previous: 'Anterior',
        next: 'Siguiente',
        last: 'Último'
      }
    };
  }

  window.PetroPozos = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();