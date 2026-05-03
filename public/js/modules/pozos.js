(() => {
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
    if (typeof window.DataTable === 'undefined') return;

    const tableEl = document.getElementById('tabla-pozos');
    if (!tableEl) return;

    if (window.DataTable.isDataTable('#tabla-pozos')) return;

    decorateColumnFilterHeaders('tabla-pozos');

    pozosTable = new window.DataTable('#tabla-pozos', {
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

    bindColumnFilters(pozosTable, 'tabla-pozos');
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

      const response = await fetch(`/pozos/${pozoId}/potencial`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ potencial })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'No se pudo actualizar el potencial.');
      }

      updatePotencialCell(button, result.potencial ?? potencial);

      button.dataset.potencial = String(result.potencial ?? potencial);

      showToast(result.message || 'Potencial actualizado correctamente.', 'success');
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

    /**
     * Si DataTables está activo, invalidamos la fila para que
     * búsqueda/ordenamiento usen el nuevo HTML actualizado.
     */
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
        th.innerHTML = `<span class="dt-column-title">${title}</span>`;
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
          const active = currentSearch === value;

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

  function formatLocalNumber(value, decimals = 2) {
    const number = Number(value);

    if (!Number.isFinite(number)) return '—';

    return number.toLocaleString('es-VE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
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