(() => {
  if (window.PetroBombaProduccion) return;

  const COLORS = { petroleo: '#059669', agua: '#2563eb', gas: '#dc2626' };
  const LABELS = { petroleo: 'Petróleo', agua: 'Agua', gas: 'Gas' };
  const fields = Object.keys(COLORS);
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const dateKey = value => /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : '';
  const completionKey = row => String(row?.completacion ?? 'Sin completación');
  const num = value => value === null || value === undefined || value === '' ? null
    : (Number.isFinite(Number(value)) ? Number(value) : null);
  const fmt = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—'
    : Number(value).toLocaleString('es-VE', { maximumFractionDigits: 2 });
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const previousDay = key => {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const monthBounds = key => {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return [`${key.slice(0, 7)}-01`, `${key.slice(0, 7)}-${String(last).padStart(2, '0')}`];
  };

  function buildAnalysis(bombas = [], produccion = [], completion = null, today = localToday()) {
    const allProduction = (Array.isArray(produccion) ? produccion : [])
      .filter(row => dateKey(row.fecha))
      .sort((a, b) => dateKey(a.fecha).localeCompare(dateKey(b.fecha)));
    const completaciones = [...new Set(allProduction.map(completionKey))];
    const selectedCompletion = completion && completaciones.includes(completion)
      ? completion : (allProduction.length ? completionKey(allProduction.at(-1)) : null);
    const production = allProduction.filter(row => completionKey(row) === selectedCompletion);

    const dated = (Array.isArray(bombas) ? bombas : [])
      .filter(row => dateKey(row.fecha_inst))
      .sort((a, b) => dateKey(a.fecha_inst).localeCompare(dateKey(b.fecha_inst)) || Number(a.id || 0) - Number(b.id || 0));
    const missingInstallation = (Array.isArray(bombas) ? bombas : []).length - dated.length;
    const startCounts = new Map();
    dated.forEach(row => startCounts.set(dateKey(row.fecha_inst), (startCounts.get(dateKey(row.fecha_inst)) || 0) + 1));

    const periods = dated.map((row, index) => {
      const start = dateKey(row.fecha_inst);
      const failure = dateKey(row.fecha_falla);
      const next = dated.slice(index + 1).find(item => dateKey(item.fecha_inst) > start);
      const nextStart = next ? dateKey(next.fecha_inst) : '';
      const endCandidates = [{ date: today, reason: 'Sin salida registrada' }];
      if (failure) endCandidates.push({ date: failure, reason: 'Fecha de falla' });
      if (nextStart) endCandidates.push({ date: previousDay(nextStart), reason: 'Siguiente instalación' });
      endCandidates.sort((a, b) => a.date.localeCompare(b.date));
      const end = endCandidates[0];
      return {
        id: String(row.id ?? `${start}-${index}`),
        marca: row.marca || 'Bomba', modelo: row.modelo || '', serial: row.serial || '',
        start, end: end.date, endReason: end.reason, failure,
        ambiguous: startCounts.get(start) > 1,
        invalid: end.date < start,
        months: [], source: row.fuente_actual || row.fuente || ''
      };
    });

    let partialMonths = 0;
    let unassignedMonths = 0;
    let ambiguousMonths = 0;
    const entries = production.map(row => {
      const date = dateKey(row.fecha);
      const [monthStart, monthEnd] = monthBounds(date);
      const candidates = periods.filter(period => !period.invalid && !period.ambiguous
        && period.start <= monthStart && period.end >= monthEnd);
      const touchesPeriod = periods.some(period => !period.invalid && period.start <= monthEnd && period.end >= monthStart);
      const assigned = candidates.length === 1 ? candidates[0] : null;
      if (assigned) assigned.months.push(row);
      else if (candidates.length > 1 || periods.some(period => period.ambiguous && period.start <= monthEnd && period.end >= monthStart)) ambiguousMonths += 1;
      else if (touchesPeriod) partialMonths += 1;
      else unassignedMonths += 1;
      return { row, date, monthStart, monthEnd, pumpId: assigned?.id || null,
        pumpName: assigned ? [assigned.marca, assigned.modelo].filter(Boolean).join(' ') : null };
    });

    periods.forEach(period => {
      period.stats = Object.fromEntries(fields.map(field => {
        const values = period.months.map(row => num(row[field])).filter(value => value !== null);
        return [field, { average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
          total: values.length ? values.reduce((a, b) => a + b, 0) : null, count: values.length }];
      }));
      period.sources = [...new Set(period.months.map(row => row.fuente).filter(Boolean))];
    });
    return { periods, entries, completaciones, selectedCompletion, missingInstallation,
      partialMonths, unassignedMonths, ambiguousMonths, assignedMonths: entries.filter(entry => entry.pumpId).length };
  }

  let trendChart = null;
  let averageChart = null;
  let currentAnalysis = null;

  function destroy() {
    trendChart?.destroy();
    averageChart?.destroy();
    trendChart = null;
    averageChart = null;
  }

  function getChart(id) {
    if (id === 'chart-bomba-produccion-tendencia') return trendChart;
    if (id === 'chart-bomba-produccion-promedios') return averageChart;
    return null;
  }

  function renderTable(analysis, selectedId) {
    const tbody = document.getElementById('bomba-produccion-rows');
    if (!tbody) return;
    const periods = [...analysis.periods].reverse();
    tbody.innerHTML = periods.length ? periods.map(period => `
      <tr class="border-t border-slate-200 dark:border-slate-700 ${selectedId === period.id ? 'bg-sky-50 dark:bg-sky-950/40' : ''}">
        <td class="sticky left-0 min-w-[150px] bg-white p-2 dark:bg-slate-900"><button type="button" data-select-bomba="${esc(period.id)}" class="min-h-10 text-left font-semibold text-sky-800 underline-offset-2 hover:underline dark:text-sky-300">${esc([period.marca, period.modelo].filter(Boolean).join(' ') || `Bomba ${period.id}`)}</button><span class="block text-xs text-slate-500">${esc(period.serial || `ID ${period.id}`)}</span></td>
        <td class="whitespace-nowrap p-2">${esc(period.start)}</td>
        <td class="whitespace-nowrap p-2">${period.endReason === 'Sin salida registrada' ? 'Sin salida registrada' : esc(period.end)}<span class="block text-xs text-slate-500">${esc(period.endReason)}</span></td>
        <td class="p-2 text-center">${period.months.length}</td>
        ${fields.map(field => `<td class="whitespace-nowrap p-2 text-right">${fmt(period.stats[field].average)}</td>`).join('')}
        <td class="whitespace-nowrap p-2">${esc(period.sources.join(', ') || '—')}</td>
      </tr>`).join('') : '<tr><td colspan="8" class="p-4 text-center text-slate-500">No hay bombas con fecha de instalación.</td></tr>';
    tbody.querySelectorAll('[data-select-bomba]').forEach(button => button.addEventListener('click', () => {
      const select = document.getElementById('bomba-produccion-bomba');
      select.value = button.dataset.selectBomba;
      select.dispatchEvent(new Event('change'));
    }));
  }

  function renderKpis(analysis, selectedId) {
    const host = document.getElementById('bomba-produccion-kpis');
    if (!host) return;
    const period = analysis.periods.find(item => item.id === selectedId);
    if (!period) {
      host.innerHTML = `<p class="text-sm text-slate-600 dark:text-slate-300">${analysis.assignedMonths} meses completos atribuibles · ${analysis.partialMonths} meses parciales excluidos · ${analysis.ambiguousMonths} ambiguos · ${analysis.unassignedMonths} sin bomba atribuible.</p>`;
      return;
    }
    host.innerHTML = `<p class="mb-2 text-sm font-semibold text-slate-900 dark:text-white">${esc(period.marca)} ${esc(period.modelo)} · ${period.months.length} meses completos</p>
      <div class="grid gap-2 sm:grid-cols-3">${fields.map(field => `<div class="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><span class="text-xs font-semibold" style="color:${COLORS[field]}">${LABELS[field]}</span><strong class="mt-1 block text-lg">${fmt(period.stats[field].average)}</strong><span class="text-xs text-slate-500">Promedio mensual · Total ${fmt(period.stats[field].total)}</span></div>`).join('')}</div>`;
  }

  function renderCharts(analysis, variable, selectedId) {
    destroy();
    const trend = document.getElementById('chart-bomba-produccion-tendencia');
    const average = document.getElementById('chart-bomba-produccion-promedios');
    if (!trend || !average) return;
    if (!window.ApexCharts) {
      trend.textContent = 'La librería de gráficas no está disponible.';
      average.textContent = '';
      return;
    }
    const points = analysis.entries.map(entry => ({
      x: new Date(`${entry.date}T12:00:00`).getTime(),
      y: num(entry.row[variable]),
      pumpName: entry.pumpName || 'Sin bomba atribuible',
      fuente: entry.row.fuente || 'Sin información',
      fullMonth: Boolean(entry.pumpId)
    })).filter(point => Number.isFinite(point.x) && point.y !== null);
    if (!points.length) {
      trend.textContent = `Sin valores de ${LABELS[variable].toLowerCase()} para esta completación.`;
    } else {
      trend.innerHTML = '';
      const visiblePeriods = selectedId ? analysis.periods.filter(period => period.id === selectedId) : analysis.periods.slice(-12);
      const annotations = visiblePeriods.filter(period => !period.invalid).map(period => ({
        x: new Date(`${period.start}T12:00:00`).getTime(),
        x2: new Date(`${period.end}T12:00:00`).getTime(),
        fillColor: selectedId ? '#f59e0b' : '#94a3b8', opacity: selectedId ? 0.14 : 0.055,
        ...(selectedId ? { label: { text: 'Período de bomba', borderColor: '#f59e0b', style: { background: '#f59e0b', color: '#111827', fontSize: '10px' } } } : {})
      }));
      trendChart = new window.ApexCharts(trend, {
        chart: { type: 'area', height: 330, zoom: { enabled: true }, toolbar: { show: true }, background: 'transparent' },
        theme: { mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light' },
        colors: [COLORS[variable]], series: [{ name: LABELS[variable], data: points }],
        dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 2.5 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.2, opacityTo: 0.01 } },
        markers: { size: points.length < 36 ? 3 : 0 },
        xaxis: { type: 'datetime' }, yaxis: { title: { text: LABELS[variable] }, decimalsInFloat: 2 },
        annotations: { xaxis: annotations },
        tooltip: { custom: ({ dataPointIndex, w }) => {
          const p = w.config.series[0].data[dataPointIndex];
          return `<div class="p-3 text-xs"><strong>${LABELS[variable]}: ${fmt(p.y)}</strong><br>${new Date(p.x).toLocaleDateString('es-VE')}<br>${esc(p.pumpName)}<br>Fuente: ${esc(p.fuente)}${p.fullMonth ? '' : '<br>Mes excluido del resumen por bomba'}</div>`;
        } }
      });
      trendChart.render();
    }
    const bars = analysis.periods.filter(period => period.stats[variable].average !== null).slice(-15);
    if (!bars.length) {
      average.textContent = 'No hay meses completos para comparar promedios.';
      return;
    }
    average.innerHTML = '';
    averageChart = new window.ApexCharts(average, {
      chart: { type: 'bar', height: Math.min(610, Math.max(260, bars.length * 34 + 90)), toolbar: { show: true }, background: 'transparent' },
      theme: { mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light' },
      colors: [COLORS[variable]], series: [{ name: `Promedio mensual de ${LABELS[variable].toLowerCase()}`, data: bars.map(period => Number(period.stats[variable].average.toFixed(2))) }],
      dataLabels: { enabled: false }, plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      xaxis: { categories: bars.map(period => `${period.marca.slice(0, 11)} · ${period.start.slice(0, 7)}`) },
      tooltip: { y: { formatter: value => fmt(value) } }
    });
    averageChart.render();
  }

  function csvDownload(analysis, pozoCodigo) {
    const headers = ['Bomba','Modelo','Serial','Instalación','Fin considerado','Criterio de fin','Meses completos',
      'Promedio petróleo','Promedio agua','Promedio gas','Total petróleo','Total agua','Total gas','Fuente'];
    const values = analysis.periods.map(period => [period.marca,period.modelo,period.serial,period.start,period.end,period.endReason,period.months.length,
      ...fields.map(field => period.stats[field].average ?? ''),
      ...fields.map(field => period.stats[field].total ?? ''),period.sources.join(' / ')]);
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...values].map(row => row.map(quote).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `produccion-por-bomba-${String(pozoCodigo || 'pozo').replace(/[^a-z0-9_-]/gi, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function mount() {
    const panel = document.getElementById('tab-bomba-produccion');
    const dataNode = document.getElementById('pozo-detail-data');
    if (!panel || !dataNode) return;
    let data;
    try { data = JSON.parse(dataNode.textContent); }
    catch (error) { panel.textContent = 'No se pudieron leer los datos del pozo.'; return; }
    const bombas = data.historialBombas || data.bombas || [];
    const produccion = data.produccion || [];
    const codigo = esc(data.pozo?.codigo || 'pozo');
    const prior = {
      completion: document.getElementById('bomba-produccion-completacion')?.value || '',
      variable: document.getElementById('bomba-produccion-variable')?.value || 'petroleo',
      pump: document.getElementById('bomba-produccion-bomba')?.value || ''
    };
    destroy();
    panel.innerHTML = `<section class="space-y-4 rounded-2xl bg-slate-50 p-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-4">
      <header class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 class="text-lg font-semibold">Producción por bomba</h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">Cruce del historial de instalación de bombas con la producción mensual del pozo. Elige una completación; las completaciones no se suman.</p>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Solo se atribuyen meses completos entre la instalación y la fecha de falla o la siguiente instalación. Si no hay salida registrada, el período se considera abierto hasta hoy. Los meses parciales y ambiguos quedan fuera de los promedios.</p>
      </header>
      <div class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label class="text-sm font-medium">Completación<select id="bomba-produccion-completacion" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800"></select></label>
          <label class="text-sm font-medium">Variable<select id="bomba-produccion-variable" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800"><option value="petroleo">Petróleo · verde</option><option value="agua">Agua · azul</option><option value="gas">Gas · rojo</option></select></label>
          <label class="text-sm font-medium">Destacar bomba<select id="bomba-produccion-bomba" class="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-800"></select></label>
        </div>
        <p id="bomba-produccion-resumen" class="mt-3 text-xs text-slate-600 dark:text-slate-300" aria-live="polite"></p>
      </div>
      <div id="bomba-produccion-kpis" class="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"></div>
      <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">Tendencia mensual y períodos de bomba</h3><p class="text-xs text-slate-500 dark:text-slate-400">Las bandas indican períodos registrados. Toca cada punto para ver la bomba atribuida.</p></div><button type="button" data-export-chart="chart-bomba-produccion-tendencia" data-export-name="produccion-por-bomba-${codigo}" data-export-pozo="${codigo}" data-export-kind="bomba-produccion" class="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600">Exportar PNG</button></div>
        <div id="chart-bomba-produccion-tendencia" class="mt-3 min-h-[330px]"></div>
      </article>
      <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">Promedio mensual por bomba</h3><p class="text-xs text-slate-500 dark:text-slate-400">Hasta 15 bombas recientes con meses completos atribuibles.</p></div><button type="button" data-export-chart="chart-bomba-produccion-promedios" data-export-name="promedio-produccion-bombas-${codigo}" data-export-pozo="${codigo}" data-export-kind="bomba-produccion" class="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600">Exportar PNG</button></div>
        <div id="chart-bomba-produccion-promedios" class="mt-3 min-h-[260px]"></div>
      </article>
      <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">Resumen por bomba</h3><p class="text-xs text-slate-500 dark:text-slate-400">Selecciona una bomba para destacarla. Los promedios usan los meses completos con valor disponible.</p></div><button type="button" id="bomba-produccion-export-csv" class="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600">Exportar CSV</button></div>
        <div class="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" role="region" aria-label="Resumen de producción por bomba" tabindex="0"><table class="w-full min-w-[900px] text-left text-xs"><thead class="bg-slate-50 dark:bg-slate-800"><tr><th class="sticky left-0 bg-slate-50 p-2 dark:bg-slate-800">Bomba</th><th class="p-2">Instalación</th><th class="p-2">Fin considerado</th><th class="p-2">Meses</th><th class="p-2">Prom. petróleo</th><th class="p-2">Prom. agua</th><th class="p-2">Prom. gas</th><th class="p-2">Fuente</th></tr></thead><tbody id="bomba-produccion-rows"></tbody></table></div>
      </article>
    </section>`;
    const completionSelect = document.getElementById('bomba-produccion-completacion');
    const variableSelect = document.getElementById('bomba-produccion-variable');
    const pumpSelect = document.getElementById('bomba-produccion-bomba');
    if (!completionSelect || !variableSelect || !pumpSelect) return;
    const initial = buildAnalysis(bombas, produccion, prior.completion);
    completionSelect.innerHTML = initial.completaciones.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (initial.selectedCompletion) completionSelect.value = initial.selectedCompletion;
    variableSelect.value = prior.variable;
    pumpSelect.innerHTML = '<option value="">Todas las bombas</option>' + [...initial.periods].reverse()
      .map(period => `<option value="${esc(period.id)}">${esc(`${period.marca} · ${period.start}`)}</option>`).join('');
    if (prior.pump && initial.periods.some(period => period.id === prior.pump)) pumpSelect.value = prior.pump;
    const render = () => {
      currentAnalysis = buildAnalysis(bombas, produccion, completionSelect.value);
      const selectedId = pumpSelect.value;
      const variable = fields.includes(variableSelect.value) ? variableSelect.value : 'petroleo';
      document.getElementById('bomba-produccion-resumen').textContent =
        `${currentAnalysis.periods.length} bombas con instalación · ${currentAnalysis.assignedMonths} meses completos atribuibles · ${currentAnalysis.partialMonths} parciales excluidos · ${currentAnalysis.ambiguousMonths} ambiguos · ${currentAnalysis.unassignedMonths} sin bomba. ${currentAnalysis.missingInstallation} bombas sin fecha de instalación.`;
      renderKpis(currentAnalysis, selectedId);
      renderTable(currentAnalysis, selectedId);
      renderCharts(currentAnalysis, variable, selectedId);
      pumpSelect.dataset.previousValue = selectedId;
    };
    completionSelect.onchange = render;
    variableSelect.onchange = render;
    pumpSelect.onchange = render;
    document.getElementById('bomba-produccion-export-csv').onclick = () => csvDownload(currentAnalysis, data.pozo?.codigo);
    render();
  }

  window.PetroBombaProduccion = { buildAnalysis, mount, destroy, getChart };
})();
