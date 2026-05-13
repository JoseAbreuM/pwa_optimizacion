(() => {
  let parametrosChart = null;
  let nivelesChart = null;
  let comparativoChart = null;
  let surveyChart = null;

  function init() {
    initTabs();
    initModals();
    initDetalleTables();
    initSurveyForm();

    initSurveyChart();
    initParametrosChart();
    initNivelesChart();
    initComparativoChart();
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
      expectedColumns: 19
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

    const options = {
      chart: {
        id: 'survey-pozo',
        type: 'line',
        height: 320,
        zoom: { enabled: true },
        toolbar: { show: true }
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

    renderMultiSeriesChart({
      chartEl,
      chartRefName: 'comparativo',
      rows: comparativo,
      selectedFields: [
        'dif_rpm',
        'dif_torque',
        'dif_amp',
        'dif_presion_casing',
        'dif_presion_tubing'
      ],
      daysLimit: 'all',
      fieldLabels: getComparativoLabels(),
      emptyMessage: 'No hay diferencias válidas para graficar.'
    });
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

    const options = {
      chart: {
        id: chartRefName,
        type: 'line',
        height: 320,
        zoom: { enabled: true },
        toolbar: { show: true }
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
        horizontalAlign: 'left'
      },
      noData: {
        text: 'Sin datos'
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
  }

  function initChartExports() {
    document.querySelectorAll('[data-export-chart]').forEach((button) => {
      button.addEventListener('click', async () => {
        const chartId = button.dataset.exportChart;
        const exportName = button.dataset.exportName || 'grafica-pozo';

        const chart = getChartByElementId(chartId);

        if (!chart) {
          showToast('No hay una gráfica disponible para exportar.', 'error');
          return;
        }

        await exportApexChart(chart, exportName);
      });
    });
  }

  function getChartByElementId(chartId) {
    if (chartId === 'chart-parametros-pozo') return parametrosChart;
    if (chartId === 'chart-niveles-pozo') return nivelesChart;
    if (chartId === 'chart-comparativa-pozo') return comparativoChart;
    if (chartId === 'chart-survey-pozo') return surveyChart;

    return null;
  }

  async function exportApexChart(chart, filename) {
    try {
      if (!chart || typeof chart.dataURI !== 'function') {
        throw new Error('La gráfica no soporta exportación.');
      }

      const result = await chart.dataURI();

      if (!result || !result.imgURI) {
        throw new Error('No se pudo generar la imagen.');
      }

      const link = document.createElement('a');
      link.href = result.imgURI;
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
    const lastDate = parseDate(orderedRows[orderedRows.length - 1]?.fecha) || new Date();

    const minDate = new Date(lastDate);
    minDate.setDate(lastDate.getDate() - days);

    return orderedRows.filter((row) => {
      const rowDate = parseDate(row.fecha);
      return rowDate && rowDate >= minDate;
    });
  }

  function sortRowsByDateAsc(rows) {
    return [...rows].sort((a, b) => {
      const dateA = parseDate(a.fecha)?.getTime() || 0;
      const dateB = parseDate(b.fecha)?.getTime() || 0;
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

  function normalizeDateLabel(value) {
    const date = parseDate(value);
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