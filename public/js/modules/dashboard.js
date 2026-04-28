document.addEventListener('DOMContentLoaded', () => {
  initDashboardChart();
  initDashboardTables();
});

function initDashboardTables() {
  if (typeof window.DataTable === 'undefined') {
    console.warn('DataTables.net no está cargado.');
    return;
  }

  const tables = {};

  if (document.getElementById('tabla-muestreo')) {
    decorateColumnActionHeaders('tabla-muestreo');

    tables.muestreo = new window.DataTable('#tabla-muestreo', {
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      scrollX: true,
      colReorder: true,
      orderCellsTop: true,
      ordering: true,
      language: getSpanishDataTablesLanguage()
    });

    bindColumnActionDropdowns(tables.muestreo, 'tabla-muestreo');
  }

if (document.getElementById('tabla-bombas-criticas')) {
  decorateColumnActionHeaders('tabla-bombas-criticas', {
  sortableOnly: [0, 3, 5],
  filterable: [1, 2, 4]
});

  tables.bombas = new window.DataTable('#tabla-bombas-criticas', {
    pageLength: 5,
    lengthMenu: [5, 10, 25, 50],
    scrollX: true,
    colReorder: true,
    orderCellsTop: true,
    ordering: true,
    order: [
      [4, 'asc'],
      [3, 'desc']
    ],
    columnDefs: [
      {
        targets: 3,
        render: function (data, type) {
          const value = parseInt(String(data || '').replace(/\D/g, ''), 10);
          return type === 'sort' || type === 'type'
            ? (Number.isNaN(value) ? 0 : value)
            : data;
        }
      },
      {
        targets: 4,
        render: function (data, type) {
          const estado = String(data || '').toUpperCase();

          if (type === 'sort' || type === 'type') {
            if (estado.includes('CRITICO')) return 1;
            if (estado.includes('PENDIENTE') || estado.includes('PROXIMO')) return 2;
            return 3;
          }

          return data;
        }
      }
    ],
    createdRow: function (row, data) {
      const tvu = parseInt(String(data[3] || '').replace(/\D/g, ''), 10);
      const estado = String(data[4] || '').toUpperCase();

      if (estado.includes('CRITICO') || tvu >= 365) {
        row.classList.add('bg-red-50', 'dark:bg-red-950/20');
      } else if (
        estado.includes('PENDIENTE') ||
        estado.includes('PROXIMO') ||
        (tvu >= 250 && tvu < 365)
      ) {
        row.classList.add('bg-yellow-50', 'dark:bg-yellow-950/20');
      }
    },
    language: getSpanishDataTablesLanguage()
  });

  bindColumnActionDropdowns(tables.bombas, 'tabla-bombas-criticas');
}

  initDataTableExportButtons(tables);
  initDataTableTabAdjustments(tables);
}

function decorateColumnActionHeaders(tableId, options = {}) {
  const table = document.getElementById(tableId);
  const headers = table?.querySelectorAll('thead tr:first-child th');

  if (!table || !headers?.length) return;

  const sortableOnly = options.sortableOnly || [];
  const filterable = options.filterable || [];

  headers.forEach((th, index) => {
    if (th.dataset.columnActionsReady === 'true') return;

    const title = th.textContent.trim();
    const isSortableOnly = sortableOnly.includes(index);
    const isFilterable = filterable.includes(index);

    th.dataset.columnIndex = String(index);
    th.dataset.columnActionsReady = 'true';

    const filterButton = isFilterable
      ? `
        <button type="button" data-column-filter-values>
          <i class="fa-solid fa-list-check"></i>
          Filtrar valores
        </button>
      `
      : '';

    th.innerHTML = `
      <div class="dt-column-action-header">
        <span class="dt-column-title">${title}</span>

        <div class="dt-column-dropdown" data-column-actions-root>
          <button
            type="button"
            class="dt-column-dropdown-toggle"
            aria-label="Acciones de columna ${title}"
            data-column-actions-toggle
          >
            <i class="fa-solid ${isSortableOnly ? 'fa-sort' : 'fa-filter'}"></i>
          </button>

          <div class="dt-column-dropdown-menu hidden" data-column-actions-menu>
            <button type="button" data-column-sort="asc">
              <i class="fa-solid fa-arrow-up"></i>
              Orden ascendente
            </button>

            <button type="button" data-column-sort="desc">
              <i class="fa-solid fa-arrow-down"></i>
              Orden descendente
            </button>

            ${filterButton}

            <button type="button" data-column-clear-filter class="${isFilterable ? '' : 'hidden'}">
              <i class="fa-solid fa-eraser"></i>
              Limpiar filtro
            </button>

            <button type="button" data-column-move="left">
              <i class="fa-solid fa-arrow-left"></i>
              Mover izquierda
            </button>

            <button type="button" data-column-move="right">
              <i class="fa-solid fa-arrow-right"></i>
              Mover derecha
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

function bindColumnActionDropdowns(dataTable, tableId) {
  const table = document.getElementById(tableId);
  if (!table || !dataTable) return;

  table.querySelectorAll('[data-column-actions-root]').forEach((root) => {
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart'].forEach((eventName) => {
      root.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }, true);
    });
  });

  table.querySelectorAll('[data-column-actions-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const dropdown = toggle.closest('.dt-column-dropdown');
      const menu = dropdown?.querySelector('[data-column-actions-menu]');

      const willOpen = menu?.classList.contains('hidden');

      closeColumnActionMenus();

      if (willOpen) {
        menu.classList.remove('hidden');
      }
    }, true);
  });

  table.querySelectorAll('[data-column-sort]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const th = button.closest('th');
      const visibleIndex = getVisibleColumnIndex(th);
      const order = button.dataset.columnSort;

      dataTable.order([visibleIndex, order]).draw();
      closeColumnActionMenus();
    }, true);
  });

  table.querySelectorAll('[data-column-move]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const th = button.closest('th');
      const visibleIndex = getVisibleColumnIndex(th);
      const direction = button.dataset.columnMove === 'left' ? -1 : 1;
      const newIndex = visibleIndex + direction;

      if (!dataTable.colReorder || newIndex < 0 || newIndex >= dataTable.columns().count()) {
        closeColumnActionMenus();
        return;
      }

      dataTable.colReorder.move(visibleIndex, newIndex);
      dataTable.columns.adjust();

      closeColumnActionMenus();
    }, true);
  });

  document.addEventListener('click', () => {
    closeColumnActionMenus();
  });
}

function openColumnValueFilter(dataTable, columnIndex, th) {
  const menu = th.querySelector('[data-column-actions-menu]');
  if (!menu) return;

  const oldPanel = menu.querySelector('[data-column-filter-panel]');
  if (oldPanel) {
    oldPanel.remove();
    return;
  }

  const values = [];

  dataTable
    .column(columnIndex)
    .data()
    .each((value) => {
      const clean = String(value || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (clean && !values.includes(clean)) values.push(clean);
    });

  values.sort((a, b) => a.localeCompare(b, 'es'));

  const panel = document.createElement('div');
  panel.dataset.columnFilterPanel = 'true';
  panel.className = 'mt-2 max-h-56 overflow-y-auto border-t border-gray-200 pt-2 dark:border-gray-700';

  panel.innerHTML = values.map((value) => `
    <button type="button" class="w-full text-left" data-column-filter-value="${escapeAttribute(value)}">
      ${escapeHtml(value)}
    </button>
  `).join('');

  menu.appendChild(panel);

  panel.querySelectorAll('[data-column-filter-value]').forEach((option) => {
    option.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const selected = option.dataset.columnFilterValue || '';
      const escaped = escapeRegex(selected);

      dataTable.column(columnIndex).search(`^${escaped}$`, true, false).draw();
      closeColumnActionMenus();
    }, true);
  });
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}

function getVisibleColumnIndex(th) {
  if (!th || !th.parentElement) return 0;
  return Array.from(th.parentElement.children).indexOf(th);
}

function closeColumnActionMenus(exceptMenu = null) {
  document.querySelectorAll('[data-column-actions-menu]').forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.classList.add('hidden');
    }
  });
}


function initDataTableExportButtons(tables) {
  document.querySelectorAll('[data-export-table], [data-export-flowbite-table]').forEach((button) => {
    button.addEventListener('click', () => {
      const tableId = button.dataset.exportTable || button.dataset.exportFlowbiteTable;

      const dataTable = tableId === 'tabla-bombas-criticas'
        ? tables.bombas
        : tables.muestreo;

      const filename = tableId === 'tabla-bombas-criticas'
        ? 'bombas_tvu_alertas'
        : 'muestreo_pozos';

      if (!dataTable) return;

      exportDataTableToXLS(dataTable, filename);
    });
  });
}

function exportDataTableToXLS(dataTable, filename) {
  const headers = [];
  const rows = [];

  dataTable.columns().every(function () {
    const header = this.header();
    const cleanHeader = header.querySelector('.dt-column-title')?.textContent.trim()
      || header.textContent.trim();

    headers.push(cleanHeader);
  });

  dataTable.rows({ search: 'applied' }).every(function () {
    const rowNode = this.node();
    const cells = Array.from(rowNode.querySelectorAll('td'));

    rows.push(cells.map((cell) => {
      return cell.innerText.trim().replace(/\s+/g, ' ');
    }));
  });

  const escapeHtml = (value) => {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const tableHtml = `
    <html>
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([tableHtml], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function initDataTableTabAdjustments(tables) {
  document.querySelectorAll('[data-tabs-target]').forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      setTimeout(() => {
        Object.values(tables).forEach((table) => {
          if (table && table.columns) {
            table.columns.adjust();
          }
        });
      }, 150);
    });
  });
}

function getSpanishDataTablesLanguage() {
  return {
    search: 'Buscar:',
    lengthMenu: 'Mostrar _MENU_ registros',
    info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
    infoEmpty: 'Mostrando 0 a 0 de 0 registros',
    infoFiltered: '(filtrado de _MAX_ registros totales)',
    zeroRecords: 'No se encontraron registros',
    emptyTable: 'No hay datos disponibles',
    paginate: {
      first: 'Primero',
      previous: 'Anterior',
      next: 'Siguiente',
      last: 'Último'
    }
  };
}

function initDashboardChart() {
  const dataNode = document.getElementById('dashboard-data');

  let dashboardData = { categorias: [] };

  if (dataNode) {
    try {
      dashboardData = JSON.parse(dataNode.textContent);
    } catch (error) {
      console.error('Error leyendo dashboard-data:', error);
    }
  }

  const categorias = dashboardData.categorias || [];
  const totalPozos = categorias.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

  const chartEl = document.getElementById('pie-chart');
  const legendEl = document.getElementById('pie-legend');

  if (!chartEl || typeof ApexCharts === 'undefined' || !categorias.length) return;

  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const chart = new ApexCharts(chartEl, {
    series: categorias.map(item => Number(item.cantidad || 0)),
    labels: categorias.map(item => `Categoría ${item.categoria || 'S/C'}`),
    colors,
    chart: {
      type: 'pie',
      height: 320,
      width: '100%',
      toolbar: { show: false }
    },
    legend: {
      show: true,
      position: 'bottom',
      fontFamily: 'Inter, sans-serif',
      labels: {
        colors: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
      }
    },
    dataLabels: {
      enabled: true,
      formatter: value => `${value.toFixed(1)}%`
    },
    tooltip: {
      y: {
        formatter: value => {
          const pct = totalPozos ? ((value / totalPozos) * 100).toFixed(1) : 0;
          return `${value} pozos (${pct}%)`;
        }
      }
    }
  });

  chart.render();

  if (legendEl) {
    legendEl.innerHTML = categorias.map((item, index) => {
      const value = Number(item.cantidad || 0);
      const pct = totalPozos ? ((value / totalPozos) * 100).toFixed(1) : 0;

      return `
        <div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700">
          <div class="flex min-w-0 items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" style="background:${colors[index % colors.length]}"></span>
            <span class="truncate text-sm text-gray-700 dark:text-gray-200">Categoría ${item.categoria || 'S/C'}</span>
          </div>
          <span class="text-sm font-semibold text-gray-900 dark:text-white">${value} (${pct}%)</span>
        </div>
      `;
    }).join('');
  }
}

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