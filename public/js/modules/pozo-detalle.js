(() => {
  let parametrosChart = null;
  let nivelesChart = null;
  let comparativoChart = null;
  let surveyChart = null;
  let muestrasChart = null;
  let pruebasChart = null;
  let produccionCharts = [];
  let produccionChartMap = {};

  let activeModalId = null;
  let modalHistoryPushed = false;
  let globalModalEventsBound = false;

  function init() {
    destroyAllCharts();

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
    initPruebasTables();
    cacheDetalleConsultado();
    initChartExports();
    initOfflineBackLinks();
    initPlaceholderActions();
  }

  function reinit() {
    init();
  }

  function bindOnce(element, key, handler, eventName = 'click') {
    if (!element) return;

    const bindKey = `pozoBound${key}`;

    if (element.dataset[bindKey] === 'true') return;

    element.addEventListener(eventName, handler);
    element.dataset[bindKey] = 'true';
  }

  function initTabs() {
    const buttons = document.querySelectorAll('.pozo-tab-btn');
    const panels = document.querySelectorAll('.pozo-tab-panel');

    if (!buttons.length || !panels.length) return;

    buttons.forEach((button) => {
      bindOnce(button, 'Tab', () => {
        const targetId = button.dataset.tabTarget;
        if (!targetId) return;

        buttons.forEach((btn) => setInactiveButton(btn));
        panels.forEach((panel) => panel.classList.add('hidden'));

        setActiveButton(button);

        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.remove('hidden');
        }
        if (targetId === 'tab-produccion') initProduccion();
        if (targetId === 'tab-bomba-produccion') {
          window.PetroBombaProduccion?.mount?.();
          initChartExports();
        }
        if (targetId === 'tab-muestras') {
          initPruebasChart();
        }

        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));

          safeResizeChart(parametrosChart);
          safeResizeChart(nivelesChart);
          safeResizeChart(comparativoChart);
          safeResizeChart(surveyChart);
          safeResizeChart(muestrasChart);
          safeResizeChart(pruebasChart);
          produccionCharts.forEach(safeResizeChart);

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
      bindOnce(button, 'OpenModal', () => {
        openModal(button.dataset.pozoOpenModal, {
          pushHistory: true
        });
      });
    });

    document.querySelectorAll('[data-pozo-close-modal]').forEach((button) => {
      bindOnce(button, 'CloseModal', () => {
        closeModal(button.dataset.pozoCloseModal, {
          goBack: true
        });
      });
    });

    document.querySelectorAll('[role="dialog"]').forEach((modal) => {
      bindOnce(modal, 'Backdrop', (event) => {
        const clickedBackdrop = event.target === modal;
        const clickedOuterWrapper =
          event.target?.dataset?.pozoModalBackdrop === 'true';

        if (clickedBackdrop || clickedOuterWrapper) {
          closeModal(modal.id, {
            goBack: true
          });
        }
      });
    });

    if (!globalModalEventsBound) {
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        const openModalEl = getTopOpenModal();
        if (!openModalEl) return;

        closeModal(openModalEl.id, {
          goBack: true
        });
      });

      window.addEventListener('popstate', () => {
        if (!activeModalId) return;

        const modalId = activeModalId;

        closeModal(modalId, {
          fromPopState: true
        });
      });

      globalModalEventsBound = true;
    }
  }

  function openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const alreadyOpen = !modal.classList.contains('hidden');

    closeOtherModals(modalId);

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.body.classList.add('overflow-hidden');
    document.documentElement.classList.add('overflow-hidden');

    activeModalId = modalId;

    if (!alreadyOpen && options.pushHistory && !modalHistoryPushed) {
      try {
        const currentState =
          history.state && typeof history.state === 'object'
            ? history.state
            : {};

        history.pushState(
          {
            ...currentState,
            pozoModal: modalId
          },
          '',
          window.location.href
        );

        modalHistoryPushed = true;
      } catch (error) {
        modalHistoryPushed = false;
      }
    }

    focusModalCloseButton(modal);

    setTimeout(() => {
      adjustVisibleDataTables();
      window.dispatchEvent(new Event('resize'));
    }, 150);
  }

  function closeModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');

    if (activeModalId === modalId) {
      activeModalId = null;
    }

    const openModals = document.querySelectorAll('[role="dialog"]:not(.hidden)');

    if (!openModals.length) {
      document.body.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('overflow-hidden');
    }

    if (options.fromPopState) {
      modalHistoryPushed = false;
      return;
    }

    if (options.goBack && modalHistoryPushed) {
      modalHistoryPushed = false;

      try {
        history.back();
      } catch (error) {
        // Si el navegador bloquea history.back(), simplemente deja el modal cerrado.
      }

      return;
    }

    modalHistoryPushed = false;
  }

  function closeOtherModals(exceptModalId) {
    document.querySelectorAll('[role="dialog"]:not(.hidden)').forEach((modal) => {
      if (modal.id === exceptModalId) return;

      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }

  function getTopOpenModal() {
    const openModals = Array.from(
      document.querySelectorAll('[role="dialog"]:not(.hidden)')
    );

    return openModals[openModals.length - 1] || null;
  }

  function focusModalCloseButton(modal) {
    const closeButton = modal.querySelector('[data-pozo-close-modal]');

    if (!closeButton) return;

    setTimeout(() => {
      try {
        closeButton.focus({
          preventScroll: true
        });
      } catch (error) {
        closeButton.focus();
      }
    }, 60);
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
    const tableEl = document.querySelector(selector);

    initDataTable(selector, {
      scrollY: null,
      scrollX: true,
      pageLength: 10,
      ordering: true,
      expectedColumns: 6,
      order: [[0, 'desc']]
    });

    if (!tableEl) return;

    bindOnce(tableEl, 'MuestrasRepresentativasDelegated', async (event) => {
      const input = event.target.closest('[data-muestra-representativa]');
      if (!input) return;

      const previousValue = !input.checked;
      const label = input.closest('label');
      const text =
        label?.querySelector('[data-muestra-switch-label]') ||
        label?.querySelector('span:last-child');

      updateMuestraSwitchLabel(input, text);
      updateMuestrasJsonRepresentativa(input.dataset.muestraId, input.checked);
      renderMuestrasChart();

      try {
        await updateMuestraRepresentativa(input);
      } catch (error) {
        input.checked = previousValue;
        updateMuestraSwitchLabel(input, text);
        updateMuestrasJsonRepresentativa(input.dataset.muestraId, previousValue);
        renderMuestrasChart();

        console.error(error);
        showToast(error.message || 'No se pudo actualizar la muestra.', 'error');
      }
    }, 'change');
  }

  function updateMuestraSwitchLabel(input, textEl) {
    if (!textEl) return;

    textEl.textContent = input.checked ? 'Sí' : 'No';

    textEl.classList.toggle('text-emerald-700', input.checked);
    textEl.classList.toggle('dark:text-emerald-300', input.checked);
    textEl.classList.toggle('text-slate-500', !input.checked);
    textEl.classList.toggle('dark:text-slate-400', !input.checked);
  }

  async function updateMuestraRepresentativa(input) {
    const muestraId = input.dataset.muestraId;
    const pozoId = input.dataset.pozoId;
    const representativa = Boolean(input.checked);

    if (!muestraId || !pozoId) {
      throw new Error('No se pudo identificar la muestra.');
    }

    if (!navigator.onLine) {
      await enqueueOfflineMuestraUpdate(pozoId, muestraId, representativa);
      return;
    }

    try {
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
    } catch (error) {
      if (!navigator.onLine || error instanceof TypeError) {
        await enqueueOfflineMuestraUpdate(pozoId, muestraId, representativa);
        return;
      }

      throw error;
    }
  }

  async function enqueueOfflineMuestraUpdate(pozoId, muestraId, representativa) {
    if (!window.PetroSync || typeof window.PetroSync.enqueueOperation !== 'function') {
      throw new Error('Funcionalidad offline no disponible.');
    }

    await window.PetroSync.enqueueOperation({
      type: 'MUESTRA_REPRESENTATIVA_UPDATE',
      payload: {
        id_pozo: Number(pozoId),
        id_muestra: Number(muestraId),
        representativa
      }
    });

    showToast('Sin conexión: cambio guardado para sincronizar.', 'success');
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

    console.debug('[POZO/MUESTRAS] rows seleccionadas para gráfica:', rows);

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
      y: row.ays,
      fuente: row.fuente || 'Sin información'
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
      dataLabels: { enabled: false },
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
        custom: ({ dataPointIndex, w }) => {
          const point = w.config.series[0].data[dataPointIndex];
          return `<div class="p-2 text-xs"><strong>${Number(point.y).toFixed(2)}% AyS</strong><br>${escapeChartText(point.x)}<br>Fuente: ${escapeChartText(point.fuente)}</div>`;
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

    muestrasChart.render().then(() => {
      safeResizeChart(muestrasChart);
    });
  }

  function getMuestrasRowsFromTable() {
    const domRows = getMuestrasRowsFromDom();

    if (domRows.length) {
      return domRows;
    }

    return getMuestrasRowsFromJson();
  }

  function getMuestrasRowsFromDom() {
    return Array.from(document.querySelectorAll('[data-muestra-representativa]'))
      .map((input) => {
        const rowEl = input.closest('tr');

        const fecha =
          input.dataset.fecha ||
          rowEl?.querySelector('td[data-order]')?.dataset.order ||
          '';

        const aysRaw =
          input.dataset.ays ||
          rowEl?.children?.[1]?.dataset?.order ||
          rowEl?.children?.[1]?.textContent ||
          '';

        return {
          id: input.dataset.muestraId,
          pozoId: input.dataset.pozoId,
          fecha,
          ays: parseChartNumber(aysRaw),
          fuente: input.dataset.fuente || 'Sin información',
          representativa: input.checked
        };
      })
      .filter((row) => row.id && row.fecha);
  }

  function getMuestrasRowsFromJson() {
    const dataEl = document.getElementById('muestras-data-json');

    if (!dataEl) return [];

    const rows = readJsonData(dataEl, []);

    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        const id = getMuestraId(row);

        return {
          id,
          pozoId:
            row.id_pozo ||
            row.pozo_id ||
            row.idPozo ||
            '',
          fecha: getDateKey(row.fecha),
          ays: parseChartNumber(
            row.ays ??
            row.porcentaje_ays ??
            row.porcentaje_agua_sedimentos
          ),
          fuente: row.fuente || 'Sin información',
          representativa: normalizeBoolean(
            row.representativa ??
            row.es_representativa ??
            row.muestra_representativa
          )
        };
      })
      .filter((row) => row.id && row.fecha);
  }

  function setMuestrasJsonRows(rows) {
    const dataEl = document.getElementById('muestras-data-json');

    if (!dataEl) return;

    try {
      dataEl.textContent = JSON.stringify(rows || []);
    } catch (error) {
      console.warn('No se pudo actualizar muestras-data-json:', error);
    }
  }

  function updateMuestrasJsonRepresentativa(muestraId, representativa) {
    if (!muestraId) return;

    const dataEl = document.getElementById('muestras-data-json');
    if (!dataEl) return;

    const rows = readJsonData(dataEl, []);
    if (!Array.isArray(rows) || !rows.length) return;

    const updatedRows = rows.map((row) => {
      const id = getMuestraId(row);

      if (String(id) !== String(muestraId)) return row;

      return {
        ...row,
        representativa
      };
    });

    setMuestrasJsonRows(updatedRows);
  }

  function getMuestraId(row) {
    if (!row) return '';

    return (
      row.id ??
      row.id_muestra ??
      row.id_muestras ??
      row.muestra_id ??
      ''
    );
  }

  function normalizeBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;

    const text = String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (
      text === '1' ||
      text === 'true' ||
      text === 'si' ||
      text === 'yes' ||
      text === 'representativa'
    );
  }

  function getDateKey(value) {
    const date = parseDateKey(value);

    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

    bindOnce(form, 'SurveySubmit', async (event) => {
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

        if (!navigator.onLine) {
          await enqueueOfflineSurveyUpdate(pozoId, surveyText);
          showSurveyMessage('Sin conexión: survey guardado para sincronizar.', 'success');
          return;
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

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'No se pudo guardar el survey.');
        }

        showSurveyMessage(result.message || 'Survey actualizado correctamente.', 'success');

        setTimeout(() => {
          window.location.reload();
        }, 700);
      } catch (error) {
        if (!navigator.onLine || error instanceof TypeError) {
          try {
            await enqueueOfflineSurveyUpdate(pozoId, surveyText);
            showSurveyMessage('Sin conexión: survey guardado para sincronizar.', 'success');
            return;
          } catch (queueError) {
            showSurveyMessage(queueError.message || 'No se pudo guardar el survey offline.', 'error');
            return;
          }
        }

        showSurveyMessage(error.message || 'No se pudo guardar el survey.', 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText || 'Guardar survey';
        }
      }
    }, 'submit');
  }

  async function enqueueOfflineSurveyUpdate(pozoId, surveyText) {
    if (!window.PetroSync || typeof window.PetroSync.enqueueOperation !== 'function') {
      throw new Error('Funcionalidad offline no disponible.');
    }

    await window.PetroSync.enqueueOperation({
      type: 'SURVEY_UPDATE',
      payload: {
        id_pozo: Number(pozoId),
        survey_text: surveyText
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
    box.classList.remove('hidden');
  }

  async function cacheDetalleConsultado() {
    const el = document.getElementById('pozo-detail-data');
    if (!el || !window.PetroDB || !navigator.onLine) return;
    try {
      const data = JSON.parse(el.textContent);
      if (Number.isInteger(Number(data.pozo?.id))) {
        await window.PetroDB.put('pozo_detalles', { ...data, id: Number(data.pozo.id) });
      }
    } catch (error) { console.warn('No se pudo guardar la ficha offline:', error); }
  }

  function initPruebasTables() {
    const dataEl = document.getElementById('pruebas-data-json');
    const host = document.getElementById('pruebas-tablas');
    if (!dataEl || !host) return;

    const rows = readJsonData(dataEl, []);
    const isOfm = row => String(row.fuente || '').trim().toUpperCase() === 'OFM';
    host.innerHTML = '';
    createPruebasTable(host, 'ofm', 'Pruebas OFM', rows.filter(isOfm));
    createPruebasTable(host, 'otras', 'Pruebas de otras fuentes', rows.filter(row => !isOfm(row)));
  }

  function createPruebasTable(host, key, title, rows) {
    const fields = [
      ['fecha_prueba', 'Fecha'], ['ays', '% AyS'], ['api', 'API'],
      ['volumetria', 'Volumetría'], ['bbpd', 'BBPD'], ['bnpd', 'BNPD'],
      ['gasf', 'Gas'], ['fuente', 'Fuente']
    ];
    const section = document.createElement('section');
    section.className = 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4';
    section.innerHTML = `
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h3 class="text-base font-semibold text-slate-900 dark:text-white">${title} <span class="text-sm font-normal text-slate-500">(${rows.length})</span></h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Busca, ordena las columnas y cambia de página.</p></div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Buscar
            <input type="search" data-pruebas-search="${key}" placeholder="Fecha, fuente o valor" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-800 sm:w-48" aria-label="Buscar en ${title}">
          </label>
          <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Filas
            <select data-pruebas-size="${key}" class="mt-1 block min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"><option>10</option><option>25</option><option>50</option></select>
          </label>
        </div>
      </div>
      <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" role="region" aria-label="${title}" tabindex="0">
        <table class="w-full min-w-[820px] text-left text-sm text-slate-700 dark:text-slate-200">
          <thead class="bg-slate-50 text-xs dark:bg-slate-800"><tr>${fields.map(([field, label]) => `<th scope="col" class="whitespace-nowrap p-2"><button type="button" data-pruebas-sort="${field}" class="min-h-10 text-left font-semibold hover:text-sky-700 dark:hover:text-sky-300" aria-label="Ordenar por ${label}">${label} <span data-sort-indicator="${field}" aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
          <tbody data-pruebas-body="${key}"></tbody>
        </table>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span data-pruebas-count="${key}" aria-live="polite"></span>
        <div class="flex items-center gap-2"><button type="button" data-pruebas-prev="${key}" class="min-h-11 rounded-lg border border-slate-300 px-3 dark:border-slate-600">Anterior</button><span data-pruebas-page="${key}"></span><button type="button" data-pruebas-next="${key}" class="min-h-11 rounded-lg border border-slate-300 px-3 dark:border-slate-600">Siguiente</button></div>
      </div>`;
    host.appendChild(section);

    const state = { query: '', sort: 'fecha_prueba', direction: -1, page: 1, size: 10 };
    const cellText = (row, field) => {
      const value = row[field];
      if (value === null || value === undefined || value === '') return '—';
      if (field === 'fecha_prueba') return normalizeDateLabel(value);
      if (field === 'fuente') return String(value);
      const number = Number(value);
      return Number.isFinite(number) ? number.toLocaleString('es-VE', { maximumFractionDigits: 2 }) : String(value);
    };
    const render = () => {
      const query = state.query.toLocaleLowerCase('es');
      const visible = rows.filter(row => !query || fields.some(([field]) => cellText(row, field).toLocaleLowerCase('es').includes(query)));
      visible.sort((a, b) => {
        const left = a[state.sort];
        const right = b[state.sort];
        if (state.sort !== 'fecha_prueba' && state.sort !== 'fuente') {
          const l = Number(left), r = Number(right);
          if (Number.isFinite(l) && Number.isFinite(r)) return (l - r) * state.direction;
        }
        return String(left ?? '').localeCompare(String(right ?? ''), 'es') * state.direction;
      });
      const pages = Math.max(1, Math.ceil(visible.length / state.size));
      state.page = Math.min(state.page, pages);
      const pageRows = visible.slice((state.page - 1) * state.size, state.page * state.size);
      section.querySelector(`[data-pruebas-body="${key}"]`).innerHTML = pageRows.length
        ? pageRows.map(row => `<tr class="border-t border-slate-100 dark:border-slate-700">${fields.map(([field]) => `<td class="whitespace-nowrap p-2">${escapeChartText(cellText(row, field))}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${fields.length}" class="p-4 text-center text-slate-500">Sin pruebas para mostrar.</td></tr>`;
      section.querySelector(`[data-pruebas-count="${key}"]`).textContent = `${visible.length} registros · ${pageRows.length} en esta página`;
      section.querySelector(`[data-pruebas-page="${key}"]`).textContent = `${state.page} / ${pages}`;
      section.querySelector(`[data-pruebas-prev="${key}"]`).disabled = state.page <= 1;
      section.querySelector(`[data-pruebas-next="${key}"]`).disabled = state.page >= pages;
      section.querySelectorAll('[data-sort-indicator]').forEach(node => {
        node.textContent = node.dataset.sortIndicator === state.sort ? (state.direction === -1 ? '↓' : '↑') : '';
      });
    };
    section.querySelector(`[data-pruebas-search="${key}"]`).addEventListener('input', event => {
      state.query = event.target.value.trim(); state.page = 1; render();
    });
    section.querySelector(`[data-pruebas-size="${key}"]`).addEventListener('change', event => {
      state.size = Number(event.target.value); state.page = 1; render();
    });
    section.querySelectorAll('[data-pruebas-sort]').forEach(button => button.addEventListener('click', () => {
      const field = button.dataset.pruebasSort;
      state.direction = state.sort === field ? -state.direction : (field === 'fecha_prueba' ? -1 : 1);
      state.sort = field; state.page = 1; render();
    }));
    section.querySelector(`[data-pruebas-prev="${key}"]`).addEventListener('click', () => { state.page -= 1; render(); });
    section.querySelector(`[data-pruebas-next="${key}"]`).addEventListener('click', () => { state.page += 1; render(); });
    render();
  }

  function initPruebasChart() {
    const dataEl = document.getElementById('pruebas-data-json');
    const target = document.getElementById('chart-pruebas-ays-pozo');
    if (!dataEl || !target || typeof window.ApexCharts === 'undefined') return;
    const rows = readJsonData(dataEl, []);
    const points = rows.filter(row => String(row.fuente || '').trim().toUpperCase() === 'OFM' && row.ays != null && Number.isFinite(Number(row.ays)))
      .map(row => ({ x: new Date(String(row.fecha_prueba).slice(0, 10) + 'T12:00:00').getTime(), y: Number(row.ays), fuente: row.fuente || 'Sin información' }))
      .filter(point => Number.isFinite(point.x));
    if (pruebasChart) pruebasChart.destroy();
    if (!points.length) { renderChartMessage(target, 'No hay pruebas OFM con % AyS válido.'); return; }
    target.innerHTML = '';
    const theme = getChartTheme();
    pruebasChart = new window.ApexCharts(target, {
      chart: { type: 'area', height: 320, foreColor: theme.foreColor, background: 'transparent', zoom: { enabled: true }, toolbar: { show: true } },
      dataLabels: { enabled: false },
      theme: { mode: theme.mode }, colors: ['#8b5cf6'],
      series: [{ name: '% AyS · Pruebas', data: points }],
      stroke: { curve: 'smooth', width: 2.5 }, fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0.02 } },
      markers: { size: points.length < 40 ? 3 : 0 },
      xaxis: { type: 'datetime' }, yaxis: { title: { text: '% AyS' }, min: 0 },
      tooltip: { custom: ({ dataPointIndex, w }) => { const point = w.config.series[0].data[dataPointIndex]; return `<div class="p-2 text-xs"><strong>${point.y.toLocaleString('es-VE')}% AyS</strong><br>${new Date(point.x).toLocaleDateString('es-VE')}<br>Fuente: ${escapeChartText(point.fuente)}</div>`; } }
    });
    pruebasChart.render();
  }

  function escapeChartText(value) {
    return String(value ?? 'Sin información').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initProduccion() {
    const dataEl = document.getElementById('produccion-data-json');
    const selector = document.getElementById('produccion-completacion');
    const period = document.getElementById('produccion-periodo');
    if (!dataEl || !selector || !period || typeof window.ApexCharts === 'undefined') return;

    const variables = [
      { field: 'petroleo', rateField: 'petroleo_diario', label: 'Petróleo', color: '#10b981' },
      { field: 'agua', rateField: 'agua_diaria', label: 'Agua', color: '#3b82f6' },
      { field: 'gas', rateField: 'gas_diario', label: 'Gas', color: '#ef4444' }
    ];
    const rows = readJsonData(dataEl, []);
    const oldOfflineRows = rows.some(row => !Object.prototype.hasOwnProperty.call(row, 'dias'));
    const completaciones = [...new Set(rows.map(row => String(row.completacion || 'Sin información')))];
    const previousSelection = selector.value;
    selector.innerHTML = '<option value="__all__">Todas (series separadas)</option>' +
      completaciones.map((name, index) => `<option value="${index}">${escapeChartText(name)}</option>`).join('');
    selector.value = previousSelection && [...selector.options].some(option => option.value === previousSelection)
      ? previousSelection : (completaciones.length === 1 ? '0' : '__all__');

    const fechaMs = value => {
      const key = String(value || '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00`).getTime() : NaN;
    };
    const numberText = value => value == null ? '—' : Number(value).toLocaleString('es-VE', { maximumFractionDigits: 4 });
    const quartile = (sorted, fraction) => {
      const index = (sorted.length - 1) * fraction;
      const lower = Math.floor(index);
      return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
    };
    const outlierReasons = (data, variable) => {
      if (data.length < 4) return () => [];
      const rates = data.map(row => Number(row[variable.rateField])).sort((a, b) => a - b);
      const days = data.map(row => Number(row.dias)).sort((a, b) => a - b);
      const rateQ1 = quartile(rates, 0.25);
      const rateQ3 = quartile(rates, 0.75);
      const daysQ1 = quartile(days, 0.25);
      const daysQ3 = quartile(days, 0.75);
      const upperRate = rateQ3 + 1.5 * (rateQ3 - rateQ1);
      const lowerDays = daysQ1 - 1.5 * (daysQ3 - daysQ1);
      return row => [
        ...(Number(row[variable.rateField]) > upperRate ? ['tasa diaria alta'] : []),
        ...(Number(row.dias) < lowerDays ? ['pocos días activos'] : [])
      ];
    };
    const outlierMarkers = (series, color) => series.flatMap((item, seriesIndex) => item.data.flatMap((point, dataPointIndex) =>
      point.outlier.length ? [{ seriesIndex, dataPointIndex, fillColor: color, strokeColor: '#f59e0b', size: 8, shape: 'circle' }] : []));
    const render = () => {
      produccionCharts.forEach(chart => chart.destroy());
      produccionCharts = [];
      produccionChartMap = {};
      const latest = Math.max(...rows.map(row => fechaMs(row.fecha)).filter(Number.isFinite));
      const cutoff = period.value === 'all' ? null : new Date(latest);
      if (cutoff) cutoff.setFullYear(cutoff.getFullYear() - Number(period.value));
      const selected = selector.value === '__all__' ? completaciones : [completaciones[Number(selector.value)]];
      const visible = rows.filter(row => selected.includes(String(row.completacion || 'Sin información')) &&
        Number.isFinite(fechaMs(row.fecha)) && (!cutoff || fechaMs(row.fecha) >= cutoff.getTime()));
      document.getElementById('produccion-contexto').textContent =
        `Completación: ${selector.value === '__all__' ? 'Todas, sin sumar completaciones' : selected[0]}. Período: ${period.selectedOptions[0].textContent}. ${visible.length} registros visibles.${oldOfflineRows ? ' Actualiza manualmente los datos sin conexión para recibir días y tasas diarias.' : ''}`;
      const theme = getChartTheme();
      const grid = { borderColor: theme.gridColor, strokeDashArray: 4 };
      const formatTooltip = (point, label, relative = false) => `<div class="rounded-lg bg-white p-3 text-xs text-slate-800 shadow-lg dark:bg-slate-800 dark:text-slate-100"><strong>${escapeChartText(label)}</strong><br>Fecha: ${new Date(point.x).toLocaleDateString('es-VE')}<br>Promedio diario: ${numberText(point.daily)}${relative ? ` (${numberText(point.y)}% del máximo diario visible)` : ''}<br>Producción mensual original: ${numberText(point.monthly)}<br>Días activos: ${numberText(point.days)}<br>Completación: ${escapeChartText(point.completion)}<br>Fuente: ${escapeChartText(point.fuente)}<br>Archivo: ${escapeChartText(point.archivo)}${point.outlier.length ? `<br><strong>Valor atípico: ${escapeChartText(point.outlier.join(' y '))}</strong>` : ''}</div>`;
      const pointFor = (row, variable, reasons) => ({ x: fechaMs(row.fecha), y: Number(row[variable.rateField]), daily: Number(row[variable.rateField]), monthly: row[variable.field], days: row.dias, completion: row.completacion || 'Sin información', fuente: row.fuente || 'Sin información', archivo: row.origen_archivo || '—', outlier: reasons(row) });
      const validRows = variable => visible.filter(row => Number(row.dias) > 0 && row[variable.rateField] != null && Number.isFinite(Number(row[variable.rateField])));
      const scaleFor = field => {
        const minEl = document.getElementById(`produccion-${field}-min`);
        const maxEl = document.getElementById(`produccion-${field}-max`);
        const status = document.getElementById(`produccion-${field}-escala-estado`);
        const min = minEl.value.trim() === '' ? null : Number(minEl.value);
        const max = maxEl.value.trim() === '' ? null : Number(maxEl.value);
        if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max)) || (min != null && max != null && min >= max)) {
          status.textContent = 'El mínimo debe ser menor que el máximo. Se muestra la escala automática.';
          return {};
        }
        status.textContent = '';
        return { ...(min == null ? {} : { min }), ...(max == null ? {} : { max }) };
      };

      for (const variable of variables) {
        const target = document.getElementById(`chart-produccion-${variable.field}`);
        if (!target) continue;
        const data = validRows(variable);
        const reasons = outlierReasons(data, variable);
        const unusual = data.filter(row => reasons(row).length).length;
        const maxObserved = document.getElementById(`produccion-${variable.field}-max-observado`);
        if (maxObserved) maxObserved.textContent = data.length ? `Máximo diario visible: ${numberText(Math.max(...data.map(row => Number(row[variable.rateField]))))} · ${unusual} valores atípicos marcados` : 'Sin tasas diarias válidas en el período';
        const series = selected.map(name => ({
          name: selected.length === 1 ? variable.label : name,
          data: data.filter(row => String(row.completacion || 'Sin información') === name).map(row => pointFor(row, variable, reasons))
        })).filter(item => item.data.length);
        if (!series.length) { renderChartMessage(target, oldOfflineRows ? 'Actualiza los datos sin conexión para ver tasas diarias.' : `Sin tasas diarias de ${variable.label.toLowerCase()} con días activos válidos.`); continue; }
        target.innerHTML = '';
        const chart = new window.ApexCharts(target, {
          chart: { type: 'area', height: 300, foreColor: theme.foreColor, background: 'transparent', zoom: { enabled: true }, toolbar: { show: true } },
          theme: { mode: theme.mode }, colors: series.map(() => variable.color), series,
          dataLabels: { enabled: false },
          stroke: { curve: 'smooth', width: 2.5, dashArray: series.map((_, index) => index ? 4 + index * 2 : 0) },
          fill: { type: 'gradient', gradient: { opacityFrom: 0.22, opacityTo: 0.01 } },
          markers: { size: data.length < 40 ? 3 : 0, discrete: outlierMarkers(series, variable.color) }, grid,
          xaxis: { type: 'datetime', title: { text: 'Fecha' } },
          yaxis: { title: { text: `Promedio diario de ${variable.label.toLowerCase()}` }, decimalsInFloat: 2, ...scaleFor(variable.field) },
          legend: { show: series.length > 1, position: 'top', horizontalAlign: 'left' },
          tooltip: { custom: ({ seriesIndex, dataPointIndex, w }) => formatTooltip(w.config.series[seriesIndex].data[dataPointIndex], variable.label) }
        });
        produccionCharts.push(chart);
        produccionChartMap[`chart-produccion-${variable.field}`] = chart;
        chart.render();
      }

      const crossing = document.getElementById('chart-produccion-cruce');
      if (!crossing) return;
      const crossSeries = [];
      const crossColors = [];
      const crossDashes = [];
      const crossMarkers = [];
      for (const variable of variables) {
        const data = validRows(variable);
        const reasons = outlierReasons(data, variable);
        const maximum = Math.max(0, ...data.map(row => Number(row[variable.rateField])));
        let visibleSeriesIndex = 0;
        for (const name of selected) {
          const points = data.filter(row => String(row.completacion || 'Sin información') === name).map(row => {
            const point = pointFor(row, variable, reasons);
            return { ...point, y: maximum > 0 ? (point.daily / maximum) * 100 : 0 };
          });
          if (points.length) {
            crossMarkers.push(...outlierMarkers([{ data: points }], variable.color).map(marker => ({ ...marker, seriesIndex: crossSeries.length })));
            crossSeries.push({ name: selected.length === 1 ? variable.label : `${variable.label} · ${name}`, data: points });
            crossColors.push(variable.color);
            crossDashes.push(visibleSeriesIndex ? 4 + visibleSeriesIndex * 2 : 0);
            visibleSeriesIndex += 1;
          }
        }
      }
      if (!crossSeries.length) { renderChartMessage(crossing, 'No hay datos para comparar en este período.'); return; }
      crossing.innerHTML = '';
      const crossChart = new window.ApexCharts(crossing, {
        chart: { type: 'line', height: 360, foreColor: theme.foreColor, background: 'transparent', zoom: { enabled: true }, toolbar: { show: true } },
        theme: { mode: theme.mode }, colors: crossColors, series: crossSeries,
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2.5, dashArray: crossDashes },
        markers: { size: 0, discrete: crossMarkers }, grid, xaxis: { type: 'datetime', title: { text: 'Fecha' } },
        yaxis: { min: 0, max: 100, title: { text: '% del máximo diario visible por variable' }, labels: { formatter: value => `${Number(value).toFixed(0)}%` } },
        legend: { position: 'bottom', horizontalAlign: 'center' },
        tooltip: { custom: ({ seriesIndex, dataPointIndex, w }) => formatTooltip(w.config.series[seriesIndex].data[dataPointIndex], w.config.series[seriesIndex].name, true) }
      });
      produccionCharts.push(crossChart);
      produccionChartMap['chart-produccion-cruce'] = crossChart;
      crossChart.render();
    };
    bindOnce(selector, 'ProduccionSelector', render, 'change');
    bindOnce(period, 'ProduccionPeriodo', render, 'change');
    for (const variable of variables) {
      for (const bound of ['min', 'max']) bindOnce(document.getElementById(`produccion-${variable.field}-${bound}`), `ProduccionEscala${bound}`, render, 'change');
    }
    render();
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
      renderChartMessage(chartEl, 'Este pozo no tiene survey activo.');
      destroyChart('survey');
      return;
    }

    const seriesData = survey
      .map((row) => ({
        x: row.x_offset == null ? NaN : Number(row.x_offset),
        y: row.tvd == null ? NaN : Number(row.tvd),
        md: row.md,
        tvd: row.tvd,
        y_offset: row.y_offset,
        azimut: row.azimut
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (!seriesData.length) {
      renderChartMessage(chartEl, 'El survey no tiene X Offset y TVD válidos para graficar.');
      destroyChart('survey');
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
      dataLabels: { enabled: false },
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
        reversed: true,
        title: { text: 'TVD (profundidad)' },
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
              <div><strong>X Offset:</strong> ${point.x}</div>
              <div><strong>Y Offset:</strong> ${point.y_offset ?? '—'}</div>
              <div><strong>MD:</strong> ${point.md ?? '—'}</div>
              <div><strong>TVD:</strong> ${point.tvd ?? '—'}</div>
              <div><strong>Azimut:</strong> ${point.azimut ?? '—'}</div>
            </div>
          `;
        }
      }
    };

    destroyChart('survey');

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
      bindOnce(input, 'ParametrosChart', render, 'change');
    });

    const periodoSelect = document.getElementById('parametros-periodo');
    bindOnce(periodoSelect, 'ParametrosPeriodo', render, 'change');

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
      bindOnce(input, 'NivelesChart', render, 'change');
    });

    const limiteSelect = document.getElementById('niveles-limite');
    bindOnce(limiteSelect, 'NivelesLimite', render, 'change');

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

    bindOnce(fechaSelect, 'ComparativoFecha', render, 'change');

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
      dataLabels: { enabled: false },
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
      dataLabels: { enabled: false },
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

    if (chartRefName === 'survey' && surveyChart) {
      surveyChart.destroy();
      surveyChart = null;
    }

    if (chartRefName === 'muestras' && muestrasChart) {
      muestrasChart.destroy();
      muestrasChart = null;
    }
  }

  function destroyAllCharts() {
    if (pruebasChart) pruebasChart.destroy();
    pruebasChart = null;
    produccionCharts.forEach(chart => chart.destroy());
    produccionCharts = [];
    produccionChartMap = {};
    window.PetroBombaProduccion?.destroy?.();
    destroyChart('parametros');
    destroyChart('niveles');
    destroyChart('comparativo');
    destroyChart('survey');
    destroyChart('muestras');
  }

  function initChartExports() {
    document.querySelectorAll('[data-export-chart]').forEach((button) => {
      bindOnce(button, 'ExportChart', async () => {
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
    if (text.includes('produccion')) return 'produccion';
    if (text.includes('pruebas')) return 'pruebas';

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

    if (kind === 'produccion') {
      return `Promedios diarios del período mensual · ${getSelectValue('produccion-periodo') || 'todo el período'} · fuente disponible en los puntos`;
    }

    if (kind === 'pruebas') return 'Pruebas OFM · % AyS';
    if (kind === 'bomba-produccion') return 'Cruce de producción mensual con períodos de bomba · meses completos';

    return 'Gráfica del pozo';
  }

  function getChartByElementId(chartId) {
    if (chartId === 'chart-parametros-pozo') return parametrosChart;
    if (chartId === 'chart-niveles-pozo') return nivelesChart;
    if (chartId === 'chart-comparativa-pozo') return comparativoChart;
    if (chartId === 'chart-survey-pozo') return surveyChart;
    if (chartId === 'chart-muestras-pozo') return muestrasChart;
    if (chartId === 'chart-pruebas-ays-pozo') return pruebasChart;
    if (produccionChartMap[chartId]) return produccionChartMap[chartId];
    if (window.PetroBombaProduccion?.getChart) return window.PetroBombaProduccion.getChart(chartId);

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

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo crear el archivo PNG.');
      const file = new File([blob], `${sanitizeFilename(filename)}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: meta.pozoCodigo || 'Gráfica del pozo' });
          showToast('Gráfica compartida correctamente.', 'success');
          return;
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);

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

  function initOfflineBackLinks() {
    document.querySelectorAll('[data-pozo-back="pozos"]').forEach((link) => {
      bindOnce(link, 'BackPozos', (event) => {
        if (!window.PetroOfflineStore) return;

        event.preventDefault();

        if (window.PetroOfflineShell && typeof window.PetroOfflineShell.goToPozos === 'function') {
          window.PetroOfflineShell.goToPozos();
          return;
        }

        window.location.href = '/pozos';
      });
    });
  }

  function initPlaceholderActions() {
    document.querySelectorAll('[data-pozo-action]').forEach((button) => {
      bindOnce(button, 'ActionPlaceholder', () => {
        const action = button.dataset.pozoAction;

        if (action === 'editar' || action === 'editar-datos') {
          showToast('La edición de datos del pozo se conectará en la siguiente fase.', 'info');
          return;
        }

        if (action === 'registrar-dato') {
          showToast('El registro de datos se conectará con la cola offline en la siguiente fase.', 'info');
          return;
        }

        if (action === 'editar-completacion') {
          showToast('La edición de completación se conectará en la siguiente fase.', 'info');
          return;
        }

        if (action === 'subir-diagrama') {
          showToast('La carga/cache de diagramas PDF se conectará en la siguiente fase.', 'info');
          return;
        }

        if (action === 'nueva-muestra' || action === 'editar-muestra') {
          showToast('El formulario de muestras se conectará en la siguiente fase.', 'info');
        }
      });
    });
  }

  window.PetroPozoDetalle = {
    init,
    reinit,
    destroyCharts: destroyAllCharts,
    openModal,
    closeModal,
    renderMuestrasChart
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {
      once: true
    });
  } else {
    init();
  }
})();
