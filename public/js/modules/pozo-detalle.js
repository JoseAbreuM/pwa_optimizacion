(() => {
  let parametrosChart = null;
  let nivelesChart = null;
  let comparativoChart = null;
  let surveyChart = null;
  let muestrasChart = null;

  function init() {
    initTabs();
    initModals();
    initDetalleTables();
    initSurveyForm();

    initSurveyChart();
    initParametrosChart();
    initNivelesChart();
    initComparativoChart();
    initMuestrasTable();
    initMuestrasChart();
    initChartExports();
  }

  function initTabs() {
    const buttons = document.querySelectorAll('.pozo-tab-btn');
    const panels = document.querySelectorAll('.pozo-tab-panel');

    if (!buttons.length || !panels.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.tabTarget;
        if (!targetId) return;

        buttons.forEach((btn) => setInactiveButton(btn));
        panels.forEach((panel) => panel.classList.add('hidden'));

        setActiveButton(button);

        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.remove('hidden');
        }

        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));

          safeResizeChart(parametrosChart);
          safeResizeChart(nivelesChart);
          safeResizeChart(comparativoChart);
          safeResizeChart(surveyChart);
          safeResizeChart(muestrasChart);

          adjustVisibleDataTables();
        }, 100);
      });
    });
  }

  function safeResizeChart(chart) {
    if (!chart) return;

    try {
      if (typeof chart.resize === 'function') {
        chart.resize();
        return;
      }

      if (typeof chart.updateOptions === 'function') {
        chart.updateOptions({}, false, true);
        return;
      }

      if (typeof chart.render === 'function') {
        chart.render();
      }
    } catch (error) {
      console.warn('No se pudo redimensionar la gráfica:', error);
    }
  }

  function setActiveButton(button) {
    button.classList.add(
      'active',
      'border-[#033F73]',
      'text-[#033F73]',
      'dark:border-sky-300',
      'dark:text-sky-300'
    );

    button.classList.remove(
      'border-transparent',
      'text-slate-500',
      'dark:text-slate-400'
    );
  }

  function setInactiveButton(button) {
    button.classList.remove(
      'active',
      'border-[#033F73]',
      'text-[#033F73]',
      'dark:border-sky-300',
      'dark:text-sky-300'
    );

    button.classList.add(
      'border-transparent',
      'text-slate-500',
      'dark:text-slate-400'
    );
  }

  function initModals() {
    document.querySelectorAll('[data-pozo-open-modal]').forEach((button) => {
      button.addEventListener('click', () => {
        openModal(button.dataset.pozoOpenModal);
      });
    });

    document.querySelectorAll('[data-pozo-close-modal]').forEach((button) => {
      button.addEventListener('click', () => {
        closeModal(button.dataset.pozoCloseModal);
      });
    });

    document.querySelectorAll('[role="dialog"]').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          closeModal(modal.id);
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;

      document.querySelectorAll('[role="dialog"]:not(.hidden)').forEach((modal) => {
        closeModal(modal.id);
      });
    });
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');

    setTimeout(() => {
      adjustVisibleDataTables();
    }, 150);
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');

    const openModals = document.querySelectorAll('[role="dialog"]:not(.hidden)');
    if (!openModals.length) {
      document.body.classList.remove('overflow-hidden');
    }
  }

  function initDetalleTables() {
    initHistorialBombasTable();
    initSurveyTable();

    initDataTable('#tabla-historial-parametros-pozo', {
      scrollY: '380px',
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 12
    });

    initDataTable('#tabla-historial-niveles-pozo', {
      scrollY: '380px',
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 14
    });

    initDataTable('#tabla-comparativo-parametros-niveles', {
      scrollY: '380px',
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 20
    });
  }

  function initHistorialBombasTable() {
    initDataTable('#tabla-historial-bombas-pozo', {
      scrollY: '360px',
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 9
    });
  }

  function initMuestrasTable() {
    const selector = '#tabla-muestras-pozo';

    initDataTable(selector, {
      scrollY: null,
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 6,
      order: [[0, 'desc']]
    });

    document.querySelectorAll('[data-muestra-representativa]').forEach((input) => {
      const label = input.closest('label');
      const text = label?.querySelector('span:last-child');

      input.addEventListener('change', async () => {
        const previousValue = !input.checked;

        updateMuestraSwitchLabel(input, text);

        try {
          await updateMuestraRepresentativa(input);
          renderMuestrasChart();
        } catch (error) {
          input.checked = previousValue;
          updateMuestraSwitchLabel(input, text);
          renderMuestrasChart();

          console.error(error);
          showToast(error.message || 'No se pudo actualizar la muestra.', 'error');
        }
      });
    });
  }

  function updateMuestraSwitchLabel(input, textEl) {
    if (!textEl) return;

    textEl.textContent = input.checked ? 'Sí' : 'No';

    textEl.classList.toggle('text-emerald-700', input.checked);
    textEl.classList.toggle('dark:text-emerald-300', input.checked);
  }

  async function updateMuestraRepresentativa(input) {
    const muestraId = input.dataset.muestraId;
    const pozoId = input.dataset.pozoId;
    const representativa = Boolean(input.checked);

    if (!muestraId || !pozoId) {
      throw new Error('No se pudo identificar la muestra.');
    }

    const response = await fetch(`/pozos/${pozoId}/muestras/${muestraId}/representativa`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        representativa
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.ok === false) {
      throw new Error(result.message || 'No se pudo actualizar la muestra.');
    }

    showToast(
      representativa
        ? 'Muestra añadida a la gráfica.'
        : 'Muestra quitada de la gráfica.',
      'success'
    );
  }

  function initMuestrasChart() {
    const chartEl = document.getElementById('chart-muestras-pozo');

    if (!chartEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    renderMuestrasChart();
  }

  function renderMuestrasChart() {
    const chartEl = document.getElementById('chart-muestras-pozo');

    if (!chartEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    const rows = getMuestrasRowsFromTable()
      .filter((row) => row.representativa && row.fecha && Number.isFinite(row.ays))
      .sort((a, b) => {
        const dateA = parseDateKey(a.fecha)?.getTime() || 0;
        const dateB = parseDateKey(b.fecha)?.getTime() || 0;

        return dateA - dateB;
      });

    if (!rows.length) {
      renderChartMessage(
        chartEl,
        'Marca una o más muestras como representativas para graficar % AyS.'
      );
      destroyChart('muestras');
      return;
    }

    const data = rows.map((row) => ({
      x: normalizeDateLabel(row.fecha),
      y: row.ays
    }));

    chartEl.innerHTML = '';

    const theme = getChartTheme();

    const options = {
      chart: {
        id: 'muestras',
        type: 'line',
        height: 320,
        foreColor: theme.foreColor,
        background: 'transparent',
        zoom: { enabled: true },
        toolbar: { show: true }
      },
      theme: {
        mode: theme.mode
      },
      series: [
        {
          name: '% AyS',
          data
        }
      ],
      stroke: {
        curve: 'smooth',
        width: 3
      },
      markers: {
        size: 5
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4
      },
      xaxis: {
        type: 'category',
        labels: {
          rotate: -45,
          style: {
            colors: theme.foreColor
          }
        },
        axisBorder: {
          color: theme.gridColor
        },
        axisTicks: {
          color: theme.gridColor
        }
      },
      yaxis: {
        title: {
          text: '% AyS',
          style: {
            color: theme.foreColor
          }
        },
        labels: {
          style: {
            colors: theme.foreColor
          },
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? `${number.toFixed(1)}%` : value;
          }
        }
      },
      tooltip: {
        theme: theme.mode,
        shared: true,
        intersect: false,
        y: {
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? `${number.toFixed(2)}%` : value;
          }
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        labels: {
          colors: theme.foreColor
        }
      },
      noData: {
        text: 'Sin datos',
        style: {
          color: theme.foreColor
        }
      }
    };

    destroyChart('muestras');

    muestrasChart = new window.ApexCharts(chartEl, options);
    muestrasChart.render();
  }

  function getMuestrasRowsFromTable() {
    return Array.from(document.querySelectorAll('[data-muestra-representativa]'))
      .map((input) => ({
        id: input.dataset.muestraId,
        pozoId: input.dataset.pozoId,
        fecha: input.dataset.fecha,
        ays: parseChartNumber(input.dataset.ays),
        representativa: input.checked
      }))
      .filter((row) => row.id && row.fecha);
  }

  function initSurveyTable() {
    const selector = '#tabla-survey-pozo';

    if (!canInitDataTable(selector)) return;
    if (!tableHasValidBodyRows(selector, 8)) return;

    new window.DataTable(selector, {
      searching: false,
      ordering: false,
      paging: false,
      info: false,
      lengthChange: false,
      scrollX: true,
      scrollY: '170px',
      scrollCollapse: true,
      autoWidth: false,
      columnDefs: [
        {
          targets: '_all',
          orderable: false
        }
      ],
      language: getSpanishDataTablesLanguage(),
      initComplete: function () {
        compactSurveyDataTable(selector);
      }
    });

    setTimeout(() => {
      compactSurveyDataTable(selector);
    }, 80);
  }

  function initDataTable(selector, options = {}) {
    if (!canInitDataTable(selector)) return;

    const expectedColumns =
      options.expectedColumns || document.querySelectorAll(`${selector} thead th`).length;

    if (!tableHasValidBodyRows(selector, expectedColumns)) return;

    new window.DataTable(selector, {
      pageLength: options.pageLength || 10,
      lengthMenu: options.lengthMenu || [5, 10, 25, 50, 100],
      searching: options.searching ?? true,
      ordering: options.ordering ?? true,
      paging: options.paging ?? true,
      info: options.info ?? true,
      scrollX: options.scrollX ?? true,
      scrollY: options.scrollY || null,
      scrollCollapse: true,
      autoWidth: false,
      order: options.order || [],
      columnDefs: [
        {
          targets: '_all',
          defaultContent: '—'
        }
      ],
      language: getSpanishDataTablesLanguage()
    });
  }

  function tableHasValidBodyRows(selector, expectedColumns) {
    const tableEl = document.querySelector(selector);
    if (!tableEl) return false;

    const bodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
    if (!bodyRows.length) return false;

    const validRows = bodyRows.filter((row) => {
      const cells = Array.from(row.children);

      const hasColspan = cells.some((cell) => Number(cell.getAttribute('colspan') || 1) > 1);
      if (hasColspan) return false;

      return cells.length === expectedColumns;
    });

    return validRows.length > 0;
  }

  function canInitDataTable(selector) {
    if (typeof window.DataTable === 'undefined') return false;

    const tableEl = document.querySelector(selector);
    if (!tableEl) return false;

    if (typeof window.DataTable.isDataTable === 'function') {
      return !window.DataTable.isDataTable(selector);
    }

    if (window.jQuery && window.jQuery.fn?.DataTable?.isDataTable) {
      return !window.jQuery.fn.DataTable.isDataTable(tableEl);
    }

    return true;
  }

  function adjustVisibleDataTables() {
    if (!window.jQuery || !window.jQuery.fn?.dataTable) return;

    try {
      window.jQuery.fn.dataTable
        .tables({ visible: true, api: true })
        .columns.adjust();
    } catch (error) {
      // Evita romper la ficha si DataTables no expone esa API.
    }
  }

  function compactSurveyDataTable(selector) {
    const tableEl = document.querySelector(selector);
    if (!tableEl) return;

    const wrapper =
      tableEl.closest('.dt-container') ||
      tableEl.closest('.dataTables_wrapper');

    if (!wrapper) return;

    const scrollBody =
      wrapper.querySelector('.dt-scroll-body') ||
      wrapper.querySelector('.dataTables_scrollBody');

    const scrollHead =
      wrapper.querySelector('.dt-scroll-head') ||
      wrapper.querySelector('.dataTables_scrollHead');

    if (scrollBody) {
      scrollBody.style.maxHeight = '170px';
      scrollBody.style.borderRadius = '0 0 0.75rem 0.75rem';
    }

    if (scrollHead) {
      scrollHead.style.borderRadius = '0.75rem 0.75rem 0 0';
    }

    wrapper.querySelectorAll('table').forEach((table) => {
      table.classList.add('text-[11px]');
      table.style.marginBottom = '0';
    });

    wrapper.querySelectorAll('th, td').forEach((cell) => {
      cell.style.padding = '0.35rem 0.5rem';
      cell.style.whiteSpace = 'nowrap';
    });
  }

  function initSurveyForm() {
    const form = document.getElementById('form-survey-pozo');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const pozoId = form.dataset.pozoId;
      const formData = new FormData(form);
      const surveyText = String(formData.get('survey_text') || '').trim();

      if (!pozoId) {
        showSurveyMessage('No se pudo identificar el pozo.', 'error');
        return;
      }

      if (!surveyText) {
        showSurveyMessage('Debes pegar una tabla de survey.', 'error');
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent;

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Guardando...';
        }

        const response = await fetch(`/pozos/${pozoId}/survey`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            survey_text: surveyText
          })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'No se pudo guardar el survey.');
        }

        showSurveyMessage(result.message || 'Survey actualizado correctamente.', 'success');

        setTimeout(() => {
          window.location.reload();
        }, 700);
      } catch (error) {
        showSurveyMessage(error.message || 'No se pudo guardar el survey.', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText || 'Guardar survey';
        }
      }
    });
  }

  function showSurveyMessage(message, type) {
    const box = document.getElementById('survey-form-message');
    if (!box) return;

    box.className = 'mt-3 rounded-lg p-3 text-sm';

    if (type === 'success') {
      box.classList.add(
        'bg-green-50',
        'text-green-700',
        'dark:bg-green-900/20',
        'dark:text-green-300'
      );
    } else {
      box.classList.add(
        'bg-red-50',
        'text-red-700',
        'dark:bg-red-900/20',
        'dark:text-red-300'
      );
    }

    box.textContent = message;
  }

  function initSurveyChart() {
    const chartEl = document.getElementById('chart-survey-pozo');
    const dataEl = document.getElementById('survey-data-json');

    if (!chartEl || !dataEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    const survey = readJsonData(dataEl, []);

    if (!Array.isArray(survey) || !survey.length) {
      renderChartMessage(chartEl, 'Gráfica de survey pendiente.');
      return;
    }

    const seriesData = survey
      .map((row) => ({
        x: Number(row.x_offset),
        y: Number(row.y_offset),
        md: row.md,
        tvd: row.tvd,
        azimut: row.azimut
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (!seriesData.length) {
      renderChartMessage(chartEl, 'El survey no tiene X Offset / Y Offset válidos para graficar.');
      return;
    }

    chartEl.innerHTML = '';

    const theme = getChartTheme();

    const options = {
      chart: {
        id: 'survey-pozo',
        type: 'line',
        height: 320,
        foreColor: theme.foreColor,
        background: 'transparent',
        zoom: { enabled: true },
        toolbar: { show: true }
      },
      theme: {
        mode: theme.mode
      },
      series: [
        {
          name: 'Trayectoria',
          data: seriesData
        }
      ],
      stroke: {
        curve: 'straight',
        width: 3
      },
      markers: {
        size: 4
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4
      },
      xaxis: {
        type: 'numeric',
        title: { text: 'X Offset' },
        labels: {
          formatter: (value) => Number(value).toFixed(0)
        }
      },
      yaxis: {
        title: { text: 'Y Offset' },
        labels: {
          formatter: (value) => Number(value).toFixed(0)
        }
      },
      tooltip: {
        theme: theme.mode,
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const point = w.config.series[seriesIndex].data[dataPointIndex];

          return `
            <div class="px-3 py-2 text-xs">
              <div><strong>X:</strong> ${point.x}</div>
              <div><strong>Y:</strong> ${point.y}</div>
              <div><strong>MD:</strong> ${point.md ?? '—'}</div>
              <div><strong>TVD:</strong> ${point.tvd ?? '—'}</div>
              <div><strong>Azimut:</strong> ${point.azimut ?? '—'}</div>
            </div>
          `;
        }
      }
    };

    surveyChart = new window.ApexCharts(chartEl, options);
    surveyChart.render();
  }

  function initParametrosChart() {
    const chartEl = document.getElementById('chart-parametros-pozo');
    const dataEl = document.getElementById('parametros-data-json');

    if (!chartEl || !dataEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    const parametros = readJsonData(dataEl, []);

    const render = () => {
      renderMultiSeriesChart({
        chartEl,
        chartRefName: 'parametros',
        rows: parametros,
        selectedFields: getCheckedValues('parametro-chart-field'),
        daysLimit: getSelectValue('parametros-periodo'),
        fieldLabels: getParametroLabels(),
        emptyMessage: 'No hay datos de parámetros para graficar.'
      });
    };

    document.querySelectorAll('input[name="parametro-chart-field"]').forEach((input) => {
      input.addEventListener('change', render);
    });

    const periodoSelect = document.getElementById('parametros-periodo');
    if (periodoSelect) {
      periodoSelect.addEventListener('change', render);
    }

    render();
  }

  function initNivelesChart() {
    const chartEl = document.getElementById('chart-niveles-pozo');
    const dataEl = document.getElementById('niveles-data-json');

    if (!chartEl || !dataEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    const niveles = readJsonData(dataEl, []);

    const render = () => {
      const limit = getSelectValue('niveles-limite');
      const orderedRows = sortRowsByDateAsc(niveles);
      const limitedRows = limit === 'all'
        ? orderedRows
        : orderedRows.slice(Math.max(orderedRows.length - Number(limit), 0));

      renderMultiSeriesChart({
        chartEl,
        chartRefName: 'niveles',
        rows: limitedRows,
        selectedFields: getCheckedValues('nivel-chart-field'),
        daysLimit: 'all',
        fieldLabels: getNivelLabels(),
        emptyMessage: 'No hay datos de niveles para graficar.'
      });
    };

    document.querySelectorAll('input[name="nivel-chart-field"]').forEach((input) => {
      input.addEventListener('change', render);
    });

    const limiteSelect = document.getElementById('niveles-limite');
    if (limiteSelect) {
      limiteSelect.addEventListener('change', render);
    }

    render();
  }

  function initComparativoChart() {
    const chartEl = document.getElementById('chart-comparativa-pozo');
    const dataEl = document.getElementById('comparativo-parametros-niveles-json');
    const fechaSelect = document.getElementById('comparativo-fecha-select');

    if (!chartEl || !dataEl) return;

    if (typeof window.ApexCharts === 'undefined') {
      renderChartMessage(chartEl, 'ApexCharts no está cargado en el layout.');
      return;
    }

    const comparativo = readJsonData(dataEl, []);

    if (!Array.isArray(comparativo) || !comparativo.length) {
      renderChartMessage(chartEl, 'No hay datos comparables para graficar.');
      destroyChart('comparativo');
      return;
    }

    syncComparativoFechaSelect(fechaSelect, comparativo);

    const render = () => {
      const selectedDate = fechaSelect?.value || getComparativoDateKey(comparativo[0]);
      const selectedRow =
        getComparativoRowByDate(comparativo, selectedDate) ||
        comparativo[0];

      updateComparativoResumen(selectedRow);
      renderComparativoChartByRow(chartEl, selectedRow);
    };

    if (fechaSelect) {
      fechaSelect.addEventListener('change', render);
    }

    render();
  }

  function syncComparativoFechaSelect(select, rows) {
    if (!select || !Array.isArray(rows) || !rows.length) return;

    const existingOptions = Array.from(select.options).filter((option) => option.value);

    if (existingOptions.length) return;

    rows.forEach((row, index) => {
      const dateKey = getComparativoDateKey(row);
      if (!dateKey) return;

      const option = document.createElement('option');
      option.value = dateKey;
      option.textContent = normalizeDateLabel(row.fecha_nivel || row.fecha);

      if (index === 0) {
        option.selected = true;
      }

      select.appendChild(option);
    });
  }

  function getComparativoDateKey(row) {
    if (!row) return '';

    const rawDate = row.fecha_nivel || row.fecha;
    const date = parseDateKey(rawDate);

    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function getComparativoRowByDate(rows, selectedDate) {
    if (!Array.isArray(rows) || !selectedDate) return null;

    return rows.find((row) => getComparativoDateKey(row) === selectedDate) || null;
  }

  function updateComparativoResumen(row) {
    if (!row) return;

    setTextById(
      'comparativo-resumen-fecha',
      normalizeDateLabel(row.fecha_nivel || row.fecha)
    );

    setTextById(
      'comparativo-resumen-dif-rpm',
      formatChartValue(row.dif_rpm)
    );

    setTextById(
      'comparativo-resumen-dif-torque',
      formatChartValue(row.dif_torque)
    );

    setTextById(
      'comparativo-resumen-dif-amp',
      formatChartValue(row.dif_amp)
    );

    setTextById(
      'comparativo-resumen-dif-hp',
      formatChartValue(row.dif_hp)
    );

    setTextById(
      'comparativo-resumen-dif-casing',
      formatChartValue(row.dif_presion_casing)
    );

    setTextById(
      'comparativo-resumen-dif-tubing',
      formatChartValue(row.dif_presion_tubing)
    );
  }

  function setTextById(id, value) {
    const element = document.getElementById(id);
    if (!element) return;

    const text = value === null || value === undefined || value === '' ? '—' : String(value);

    element.textContent = text;
    element.setAttribute('title', text);
  }

  function formatChartValue(value) {
    const number = parseChartNumber(value);
    return Number.isFinite(number) ? number.toFixed(2) : '—';
  }

  function renderComparativoChartByRow(chartEl, row) {
    if (!row) {
      renderChartMessage(chartEl, 'No hay datos comparables para la fecha seleccionada.');
      destroyChart('comparativo');
      return;
    }

    const labels = getComparativoLabels();

    const fields = [
      'dif_rpm',
      'dif_torque',
      'dif_amp',
      'dif_hp',
      'dif_presion_casing',
      'dif_presion_tubing'
    ];

    const data = fields
      .map((field) => ({
        x: labels[field] || field,
        y: parseChartNumber(row[field])
      }))
      .filter((point) => Number.isFinite(point.y));

    if (!data.length) {
      renderChartMessage(chartEl, 'No hay diferencias válidas para la fecha seleccionada.');
      destroyChart('comparativo');
      return;
    }

    chartEl.innerHTML = '';

    const theme = getChartTheme();

    const options = {
      chart: {
        id: 'comparativo',
        type: 'bar',
        height: 320,
        foreColor: theme.foreColor,
        background: 'transparent',
        toolbar: { show: true }
      },
      theme: {
        mode: theme.mode
      },
      series: [
        {
          name: `Diferencias ${normalizeDateLabel(row.fecha_nivel || row.fecha)}`,
          data
        }
      ],
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '48%',
          distributed: false
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (value) => {
          const number = Number(value);
          return Number.isFinite(number) ? number.toFixed(2) : value;
        }
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4
      },
      xaxis: {
        type: 'category',
        labels: {
          rotate: -20,
          trim: true
        }
      },
      yaxis: {
        labels: {
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number.toFixed(0) : value;
          }
        }
      },
      tooltip: {
        theme: theme.mode,
        y: {
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number.toFixed(2) : value;
          }
        }
      },
      legend: {
        show: false
      },
      noData: {
        text: 'Sin datos',
        style: {
          color: theme.foreColor
        }
      }
    };

    destroyChart('comparativo');

    comparativoChart = new window.ApexCharts(chartEl, options);
    comparativoChart.render();
  }

  function renderMultiSeriesChart({
    chartEl,
    chartRefName,
    rows,
    selectedFields,
    daysLimit,
    fieldLabels,
    emptyMessage
  }) {
    if (!Array.isArray(rows) || !rows.length) {
      renderChartMessage(chartEl, emptyMessage);
      destroyChart(chartRefName);
      return;
    }

    const fields = selectedFields.length ? selectedFields : [];

    if (!fields.length) {
      renderChartMessage(chartEl, 'Selecciona al menos un dato para graficar.');
      destroyChart(chartRefName);
      return;
    }

    const filteredRows = filterRowsByDays(rows, daysLimit);
    const orderedRows = sortRowsByDateAsc(filteredRows);

    const series = fields
      .map((field) => {
        const data = orderedRows
          .map((row) => ({
            x: normalizeDateLabel(row.fecha),
            y: parseChartNumber(row[field])
          }))
          .filter((point) => point.x && Number.isFinite(point.y));

        return {
          name: fieldLabels[field] || field,
          data
        };
      })
      .filter((serie) => serie.data.length);

    if (!series.length) {
      renderChartMessage(chartEl, 'No hay valores válidos para los datos seleccionados.');
      destroyChart(chartRefName);
      return;
    }

    chartEl.innerHTML = '';

    const theme = getChartTheme();

    const options = {
      chart: {
        id: chartRefName,
        type: 'line',
        height: 320,
        foreColor: theme.foreColor,
        background: 'transparent',
        zoom: { enabled: true },
        toolbar: { show: true }
      },
      theme: {
        mode: theme.mode
      },
      series,
      stroke: {
        curve: 'smooth',
        width: 3
      },
      markers: {
        size: 4
      },
      grid: {
        borderColor: theme.gridColor,
        strokeDashArray: 4
      },
      xaxis: {
        type: 'category',
        labels: {
          rotate: -45
        }
      },
      yaxis: {
        labels: {
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number.toFixed(0) : value;
          }
        }
      },
      tooltip: {
        theme: theme.mode,
        shared: true,
        intersect: false,
        y: {
          formatter: (value) => {
            const number = Number(value);
            return Number.isFinite(number) ? number.toFixed(2) : value;
          }
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        labels: {
          colors: theme.foreColor
        }
      },
      noData: {
        text: 'Sin datos',
        style: {
          color: theme.foreColor
        }
      }
    };

    destroyChart(chartRefName);

    const chart = new window.ApexCharts(chartEl, options);
    chart.render();

    if (chartRefName === 'parametros') {
      parametrosChart = chart;
    }

    if (chartRefName === 'niveles') {
      nivelesChart = chart;
    }

    if (chartRefName === 'comparativo') {
      comparativoChart = chart;
    }
  }

  function getChartTheme() {
    const isDark = document.documentElement.classList.contains('dark');

    return {
      isDark,
      mode: isDark ? 'dark' : 'light',
      foreColor: isDark ? '#cbd5e1' : '#334155',
      gridColor: isDark ? '#334155' : '#e2e8f0'
    };
  }

  function destroyChart(chartRefName) {
    if (chartRefName === 'parametros' && parametrosChart) {
      parametrosChart.destroy();
      parametrosChart = null;
    }

    if (chartRefName === 'niveles' && nivelesChart) {
      nivelesChart.destroy();
      nivelesChart = null;
    }

    if (chartRefName === 'comparativo' && comparativoChart) {
      comparativoChart.destroy();
      comparativoChart = null;
    }

    if (chartRefName === 'muestras' && muestrasChart) {
      muestrasChart.destroy();
      muestrasChart = null;
    }
  }

  function initChartExports() {
    document.querySelectorAll('[data-export-chart]').forEach((button) => {
      button.addEventListener('click', async () => {
        const chartId = button.dataset.exportChart;
        const exportName = button.dataset.exportName || 'grafica-pozo';
        const exportKind = button.dataset.exportKind || detectExportKind(chartId, exportName);
        const pozoCodigo = button.dataset.exportPozo || extractPozoCodigo(exportName);

        const chart = getChartByElementId(chartId);

        if (!chart) {
          showToast('No hay una gráfica disponible para exportar.', 'error');
          return;
        }

        await exportApexChart(chart, exportName, {
          pozoCodigo,
          subtitle: buildExportSubtitle(exportKind)
        });
      });
    });
  }

  function detectExportKind(chartId, exportName) {
    const text = `${chartId || ''} ${exportName || ''}`.toLowerCase();

    if (text.includes('parametro')) return 'parametros';
    if (text.includes('nivel')) return 'niveles';
    if (text.includes('comparativ')) return 'comparativo';
    if (text.includes('survey')) return 'survey';
    if (text.includes('muestra')) return 'muestras';

    return 'grafica';
  }

  function extractPozoCodigo(exportName) {
    const text = String(exportName || '');

    const match = text.match(/MFB-\d{3,5}/i);
    if (match) return match[0].toUpperCase();

    return text
      .replace(/^(parametros|niveles|comparativo|survey|muestras)-/i, '')
      .trim()
      .toUpperCase();
  }

  function buildExportSubtitle(kind) {
    if (kind === 'parametros') {
      const selected = getCheckedValues('parametro-chart-field')
        .map((field) => getParametroLabels()[field] || field)
        .join(', ');

      const periodo = getSelectValue('parametros-periodo');

      const periodoLabel = {
        '7': '1 semana',
        '30': '1 mes',
        '90': '3 meses',
        '180': '6 meses',
        all: 'todo el histórico'
      }[periodo] || periodo;

      return `Gráfica de parámetros: ${selected || 'sin selección'} · Periodo: ${periodoLabel}`;
    }

    if (kind === 'niveles') {
      const selected = getCheckedValues('nivel-chart-field')
        .map((field) => getNivelLabels()[field] || field)
        .join(', ');

      const limite = getSelectValue('niveles-limite');
      const limiteLabel = limite === 'all' ? 'todas las tomas' : `últimas ${limite} tomas`;

      return `Gráfica de niveles: ${selected || 'sin selección'} · ${limiteLabel}`;
    }

    if (kind === 'comparativo') {
      const selectedDate = getSelectValue('comparativo-fecha-select');
      const label = selectedDate
        ? normalizeDateLabel(selectedDate)
        : 'fecha seleccionada';

      return `Comparativa parámetros vs niveles · Toma de nivel: ${label}`;
    }

    if (kind === 'muestras') {
      const total = getMuestrasRowsFromTable()
        .filter((row) => row.representativa && Number.isFinite(row.ays))
        .length;

      return `Gráfica de muestras representativas · % AyS en el tiempo · ${total} muestra(s) seleccionada(s)`;
    }

    if (kind === 'survey') {
      return 'Gráfica de trayectoria / survey';
    }

    return 'Gráfica del pozo';
  }

  function getChartByElementId(chartId) {
    if (chartId === 'chart-parametros-pozo') return parametrosChart;
    if (chartId === 'chart-niveles-pozo') return nivelesChart;
    if (chartId === 'chart-comparativa-pozo') return comparativoChart;
    if (chartId === 'chart-survey-pozo') return surveyChart;
    if (chartId === 'chart-muestras-pozo') return muestrasChart;

    return null;
  }

  async function exportApexChart(chart, filename, meta = {}) {
    try {
      if (!chart || typeof chart.dataURI !== 'function') {
        throw new Error('La gráfica no soporta exportación.');
      }

      const result = await chart.dataURI();

      if (!result || !result.imgURI) {
        throw new Error('No se pudo generar la imagen.');
      }

      const image = await loadImage(result.imgURI);

      const padding = 40;
      const headerHeight = 112;
      const footerHeight = 28;

      const canvas = document.createElement('canvas');

      canvas.width = Math.max(image.width + padding * 2, 920);
      canvas.height = image.height + headerHeight + footerHeight;

      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 26px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(meta.pozoCodigo || 'Pozo', canvas.width / 2, 26);

      ctx.fillStyle = '#334155';
      ctx.font = '500 15px Arial, sans-serif';
      wrapCanvasText(
        ctx,
        meta.subtitle || 'Gráfica del pozo',
        canvas.width / 2,
        62,
        canvas.width - padding * 2,
        20
      );

      const chartX = Math.round((canvas.width - image.width) / 2);
      ctx.drawImage(image, chartX, headerHeight);

      ctx.fillStyle = '#64748b';
      ctx.font = '12px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        `Exportado: ${new Date().toLocaleDateString('es-VE')}`,
        canvas.width - padding,
        canvas.height - 10
      );

      const finalUri = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = finalUri;
      link.download = `${sanitizeFilename(filename)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      showToast('Gráfica exportada correctamente.', 'success');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'No se pudo exportar la gráfica.', 'error');
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(' ');
    let line = '';
    let currentY = y;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line, x, currentY);
    }
  }

  function sanitizeFilename(value) {
    return String(value || 'grafica')
      .trim()
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');

    const baseClasses = [
      'fixed',
      'right-4',
      'top-4',
      'z-[9999]',
      'rounded-xl',
      'px-4',
      'py-3',
      'text-sm',
      'font-medium',
      'shadow-lg'
    ];

    const typeClasses =
      type === 'success'
        ? ['bg-emerald-600', 'text-white']
        : type === 'error'
          ? ['bg-red-600', 'text-white']
          : ['bg-slate-800', 'text-white'];

    toast.className = [...baseClasses, ...typeClasses].join(' ');
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  function filterRowsByDays(rows, daysLimit) {
    if (daysLimit === 'all') return rows;

    const days = Number(daysLimit);
    if (!Number.isFinite(days)) return rows;

    const orderedRows = sortRowsByDateAsc(rows);
    const lastDate = parseDateKey(orderedRows[orderedRows.length - 1]?.fecha) || new Date();

    const minDate = new Date(lastDate);
    minDate.setDate(lastDate.getDate() - days);

    return orderedRows.filter((row) => {
      const rowDate = parseDateKey(row.fecha);
      return rowDate && rowDate >= minDate;
    });
  }

  function sortRowsByDateAsc(rows) {
    return [...rows].sort((a, b) => {
      const dateA = parseDateKey(a.fecha)?.getTime() || 0;
      const dateB = parseDateKey(b.fecha)?.getTime() || 0;
      return dateA - dateB;
    });
  }

  function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const text = String(value);

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      const [year, month, day] = text.slice(0, 10).split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;

    return date;
  }

  function parseDateKey(value) {
    if (!value) return null;

    const text = String(value).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return parseDate(value);
    }

    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function normalizeDateLabel(value) {
    const date = parseDateKey(value);
    if (!date) return '';

    return date.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function parseChartNumber(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const clean = String(value)
      .trim()
      .replace(',', '.')
      .replace(/[^0-9.\-]/g, '');

    if (!clean) return null;

    const number = Number(clean);
    return Number.isFinite(number) ? number : null;
  }

  function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
      .map((input) => input.value)
      .filter(Boolean);
  }

  function getSelectValue(id) {
    const select = document.getElementById(id);
    return select ? select.value : 'all';
  }

  function readJsonData(element, fallbackValue = []) {
    try {
      return JSON.parse(element.textContent || '[]');
    } catch (error) {
      console.warn('No se pudo leer JSON embebido:', error);
      return fallbackValue;
    }
  }

  function getParametroLabels() {
    return {
      torque: 'Torque',
      amp: 'AMP',
      freq: 'Freq',
      volts: 'Volts',
      hp: 'HP',
      vel_operacional: 'VO',
      vel_actual: 'Vel. actual',
      rpm: 'RPM',
      presion_casing: 'P. casing',
      presion_tubing: 'P. tubing'
    };
  }

  function getNivelLabels() {
    return {
      nf_pies: 'NF pies',
      sumergencia: 'Sumergencia',
      porcentaje_liq: '% Liq',
      pip: 'PIP',
      pbhp: 'PBHP',
      presion_casing: 'P. casing',
      presion_tubing: 'P. tubing',
      rpm: 'RPM',
      torque: 'Torque',
      amp: 'AMP',
      hp: 'HP'
    };
  }

  function getComparativoLabels() {
    return {
      dif_rpm: 'Dif. RPM',
      dif_torque: 'Dif. Torque',
      dif_amp: 'Dif. AMP',
      dif_hp: 'Dif. HP',
      dif_presion_casing: 'Dif. casing',
      dif_presion_tubing: 'Dif. tubing'
    };
  }

  function renderChartMessage(chartEl, message) {
    chartEl.innerHTML = `
      <div class="flex min-h-[300px] items-center justify-center">
        <p class="text-sm text-slate-500 dark:text-slate-400">${message}</p>
      </div>
    `;
  }

  function getSpanishDataTablesLanguage() {
    return {
      search: 'Buscar:',
      lengthMenu: 'Mostrar _MENU_ registros',
      info: 'Mostrando _START_ a _END_ de _TOTAL_ registros',
      infoEmpty: 'Mostrando 0 a 0 de 0 registros',
      infoFiltered: '(filtrado de _MAX_ registros totales)',
      zeroRecords: 'No se encontraron registros',
      emptyTable: 'No hay registros disponibles',
      paginate: {
        first: 'Primero',
        previous: 'Anterior',
        next: 'Siguiente',
        last: 'Último'
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();