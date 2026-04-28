(() => {
  const COL = {
    POZO: 0,
    ESTADO: 1,
    CATEGORIA: 2,
    AREA: 3,
    VELOCIDADES: 4,
    VARIADOR: 5,
    CABEZAL: 6,
    ACCION: 7
  };

  const FILTER_COLUMNS = [
    COL.ESTADO,
    COL.CATEGORIA,
    COL.AREA,
    COL.VARIADOR,
    COL.CABEZAL
  ];

  let activeMenu = null;

  function init() {
    initPozosTable();
  }

  function initPozosTable() {
    if (typeof window.DataTable === 'undefined') return;

    const tableEl = document.getElementById('tabla-pozos');
    if (!tableEl) return;

    if (window.DataTable.isDataTable('#tabla-pozos')) return;

    decorateColumnFilterHeaders('tabla-pozos');

    const table = new window.DataTable('#tabla-pozos', {
      pageLength: 25,
      lengthMenu: [10, 25, 50, 100],
      scrollX: true,
      colReorder: false,
      orderCellsTop: true,
      ordering: true,
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
      language: getSpanishDataTablesLanguage()
    });

    bindColumnFilters(table, 'tabla-pozos');
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
        th.innerHTML = `<span class="dt-column-title">${title}</span>`;
        return;
      }

      th.innerHTML = `
        <div class="dt-column-action-header">
          <span class="dt-column-title">${title}</span>

          <button
            type="button"
            class="dt-column-dropdown-toggle"
            aria-label="Filtrar columna ${title}"
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
        const title = toggle.closest('th')?.querySelector('.dt-column-title')?.textContent?.trim() || 'Columna';

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

      <button type="button" class="dt-floating-filter-option ${!currentSearch ? 'is-active' : ''}" data-filter-value="">
        Todos
      </button>

    ${values.map((value) => {
        const active = currentSearch === value;

        return `
          <button type="button" class="dt-floating-filter-option ${active ? 'is-active' : ''}" data-filter-value="${escapeHtml(value)}">
            ${escapeHtml(value)}
          </button>
        `;
      }).join('')}
    `;

    document.body.appendChild(menu);
    positionMenu(menu, toggle);

    menu.addEventListener('click', (event) => {
      event.stopPropagation();

      const button = event.target.closest('[data-filter-value]');
      if (!button) return;

     const value = button.dataset.filterValue || '';

      dataTable
        .column(columnIndex)
        .search(value, false, true)
        .draw();

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

  function getSpanishDataTablesLanguage() {
    return {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_ registros',
      info: 'Mostrando _START_ a _END_ de _TOTAL_ pozos',
      infoEmpty: 'Mostrando 0 a 0 de 0 pozos',
      infoFiltered: '(filtrado de _MAX_ pozos totales)',
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

  document.addEventListener('DOMContentLoaded', init);
})();