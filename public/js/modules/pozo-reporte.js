(() => {
  if (window.PetroPozoReporte) return;

  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const list = value => Array.isArray(value) ? value : [];
  const dateKey = value => String(value || '').slice(0, 10);
  const number = value => value == null || value === '' || !Number.isFinite(Number(value))
    ? '—' : Number(value).toLocaleString('es-VE', { maximumFractionDigits: 2 });
  const text = value => value == null || value === '' ? '—' : String(value);
  const normalized = value => String(value || '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  function lineChart(series, options = {}) {
    const all = series.flatMap(item => item.points).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!all.length) return '<p class="empty">Sin datos suficientes para graficar.</p>';
    const width = 680, height = 185, left = 34, right = 12, top = 12, bottom = 20;
    const minX = Math.min(...all.map(point => point.x));
    const maxX = Math.max(...all.map(point => point.x));
    const minY = options.relative ? 0 : Math.min(...all.map(point => point.y));
    const maxY = options.relative ? 100 : Math.max(...all.map(point => point.y));
    const x = value => left + (maxX === minX ? 0.5 : (value - minX) / (maxX - minX)) * (width - left - right);
    const y = value => top + (options.reverseY
      ? (value - minY) / (maxY - minY || 1)
      : 1 - (value - minY) / (maxY - minY || 1)) * (height - top - bottom);
    const paths = series.map(item => {
      const points = item.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
        .sort((a, b) => a.x - b.x);
      const max = Math.max(0, ...points.map(point => point.y));
      const selected = points.length > 250 ? points.filter((_, index) => index % Math.ceil(points.length / 250) === 0 || index === points.length - 1) : points;
      const d = selected.map((point, index) => `${index ? 'L' : 'M'}${x(point.x).toFixed(1)},${y(options.relative ? (max ? point.y / max * 100 : 0) : point.y).toFixed(1)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${item.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');
    const grid = [0, 0.5, 1].map(fraction => `<line x1="${left}" x2="${width - right}" y1="${top + fraction * (height - top - bottom)}" y2="${top + fraction * (height - top - bottom)}" stroke="#e2e8f0"/>`).join('');
    const legend = series.filter(item => item.points.length).map(item => `<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`).join('');
    return `<div class="chart"><div class="legend">${legend}</div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || 'Gráfica del pozo')}">${grid}${paths}</svg><p class="axis">${esc(options.from || '')} <span>${esc(options.to || '')}</span></p></div>`;
  }

  function byDate(rows, field = 'fecha') {
    return [...list(rows)].sort((a, b) => dateKey(a[field]).localeCompare(dateKey(b[field])));
  }

  function dateSeries(rows, field, color, name, dateField = 'fecha') {
    return { name, color, points: byDate(rows, dateField).map(row => ({
      x: new Date(`${dateKey(row[dateField])}T12:00:00`).getTime(),
      y: row[field] == null ? NaN : Number(row[field])
    })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) };
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.length
      ? rows.map(row => `<tr>${row.map(cell => `<td>${esc(text(cell))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}">Sin registros disponibles.</td></tr>`}</tbody></table></div>`;
  }

  function buildReport(data) {
    const pozo = data.pozo || {};
    const codigo = text(pozo.codigo || pozo.nombre || pozo.id);
    const estado = text(pozo.estado || pozo.estado_nombre || pozo.estado_pozo);
    const active = normalized(estado) === 'activo';
    const pumps = byDate(data.historialBombas || data.bombas, 'fecha_inst').reverse().slice(0, 2);
    if (!pumps.length && data.bombaActual) pumps.push(data.bombaActual);
    const production = byDate(data.produccion);
    const latestCompletion = production.at(-1)?.completacion || '';
    const selectedProduction = production.filter(row => (row.completacion || '') === latestCompletion);
    const productionSeries = [
      dateSeries(selectedProduction, 'petroleo', '#059669', 'Petróleo'),
      dateSeries(selectedProduction, 'agua', '#2563eb', 'Agua'),
      dateSeries(selectedProduction, 'gas', '#dc2626', 'Gas')
    ];
    const survey = list(data.survey).map(row => ({ x: Number(row.x_offset), y: Number(row.tvd) }))
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    const samples = byDate(data.ultimasMuestras || data.timeline?.muestras || data.muestras);
    const sampleSeries = [dateSeries(samples, 'ays', '#d97706', '% AyS')];
    const parametros = byDate(data.timeline?.parametros || data.parametros);
    const currentParam = data.ultimoParametro || parametros.at(-1) || null;
    const parameterSeries = [
      dateSeries(parametros.slice(-60), 'torque', '#7c3aed', 'Torque'),
      dateSeries(parametros.slice(-60), 'amp', '#0891b2', 'Amperaje')
    ];
    const productionDates = selectedProduction.map(row => dateKey(row.fecha)).filter(Boolean);
    const sampleDates = samples.map(row => dateKey(row.fecha)).filter(Boolean);
    const parameterDates = parametros.map(row => dateKey(row.fecha)).filter(Boolean);
    const generated = new Date().toLocaleString('es-VE');

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte ${esc(codigo)}</title><style>
      *{box-sizing:border-box}body{font:14px/1.45 Arial,sans-serif;color:#0f172a;background:#f1f5f9;margin:0}main{max-width:850px;margin:auto;background:#fff;padding:28px}h1{font-size:25px;margin:0}h2{font-size:16px;margin:0 0 8px;color:#033f73}p{margin:5px 0}.muted{color:#64748b}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 20px}.meta span{background:#e0f2fe;border-radius:8px;padding:6px 10px}.block{border-top:1px solid #cbd5e1;padding-top:16px;margin-top:18px;break-inside:avoid}.chart svg{display:block;width:100%;height:auto}.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#475569}.legend span{display:inline-flex;align-items:center;gap:5px}.legend i{display:inline-block;width:11px;height:11px;border-radius:100%}.axis{display:flex;justify-content:space-between;color:#64748b;font-size:11px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:7px;border-bottom:1px solid #e2e8f0}th{background:#f1f5f9}.empty{padding:18px;background:#f8fafc;color:#64748b;border-radius:8px}.actions{display:flex;gap:8px;justify-content:flex-end;margin-bottom:16px}.actions button{min-height:44px;background:#033f73;color:white;border:0;border-radius:8px;padding:8px 16px;font-size:14px}footer{color:#64748b;font-size:11px;margin-top:24px}@media print{body{background:#fff}main{padding:0;max-width:none}.actions{display:none}@page{size:A4;margin:13mm}}@media(max-width:600px){main{padding:16px}.block{break-inside:auto}}
    </style></head><body><main><div class="actions"><button type="button" onclick="window.print()">Guardar o imprimir PDF</button></div>
      <h1>Reporte del pozo ${esc(codigo)}</h1><p class="muted">Generado ${esc(generated)} · Datos disponibles en esta ficha${data.offline ? ' · modo offline' : ''}</p>
      <div class="meta"><span>Estado: ${esc(estado)}</span><span>Área: ${esc(text(pozo.area))}</span><span>Yacimiento: ${esc(text(pozo.yacimiento))}</span></div>
      <section class="block"><h2>Últimas dos bombas</h2>${table(['Marca','Modelo','Serial','Instalación','Falla','TVU','Fuente'], pumps.map(row => [row.marca,row.modelo,row.serial,dateKey(row.fecha_inst)||'—',dateKey(row.fecha_falla)||'—',number(row.tvu_dias ?? row.tvu),row.fuente_actual || row.fuente]))}</section>
      <section class="block"><h2>Producción</h2><p class="muted">Completación más reciente: ${esc(text(latestCompletion))}. Cada variable se muestra como porcentaje de su máximo del período; verde petróleo, azul agua y rojo gas. Fuente: ${esc([...new Set(selectedProduction.map(row=>row.fuente).filter(Boolean))].join(', ') || 'Sin información')}.</p>
        ${lineChart(productionSeries,{relative:true,label:'Tendencia de producción',from:productionDates[0],to:productionDates.at(-1)})}
        ${table(['Variable','Último valor'],[['Petróleo',number(selectedProduction.at(-1)?.petroleo)],['Agua',number(selectedProduction.at(-1)?.agua)],['Gas',number(selectedProduction.at(-1)?.gas)]])}</section>
      <section class="block"><h2>Trayectoria / survey</h2><p class="muted">${survey.length} puntos · X Offset horizontal, TVD vertical.</p>${lineChart([{name:'Trayectoria',color:'#0f766e',points:survey}],{reverseY:true,label:'Trayectoria del survey'})}</section>
      <section class="block"><h2>Muestras · % AyS</h2><p class="muted">${sampleSeries[0].points.length} muestras con valor disponible. Fuentes: ${esc([...new Set(samples.map(row=>row.fuente).filter(Boolean))].join(', ') || 'Sin información')}.</p>${lineChart(sampleSeries,{label:'Porcentaje de agua y sedimentos',from:sampleDates[0],to:sampleDates.at(-1)})}</section>
      ${active ? `<section class="block"><h2>Comportamiento actual de parámetros</h2><p class="muted">Últimos registros: torque y amperaje, cada serie respecto a su propio máximo.</p>${lineChart(parameterSeries,{relative:true,label:'Parámetros recientes',from:parameterDates[0],to:parameterDates.at(-1)})}${table(['Última fecha','Torque','AMP','Frecuencia','Voltaje','HP'],currentParam?[[dateKey(currentParam.fecha),number(currentParam.torque),number(currentParam.amp),number(currentParam.freq),number(currentParam.volts),number(currentParam.hp)]]:[])}</section>` : ''}
      <footer>Reporte generado localmente desde PetroField. Los guiones indican datos no disponibles.</footer>
    </main></body></html>`;
  }

  function exportReport() {
    const page = window.open('', '_blank');
    if (!page) { window.alert('Permite abrir ventanas para exportar el reporte del pozo.'); return; }
    try {
      const node = document.getElementById('pozo-detail-data');
      if (!node) throw new Error('No se encontraron datos del pozo.');
      const report = buildReport(JSON.parse(node.textContent));
      page.document.open();
      page.document.write(report);
      page.document.close();
      page.focus();
    } catch (error) {
      page.close();
      window.alert(error.message || 'No se pudo generar el reporte.');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-export-pozo-report]');
    if (button) { event.preventDefault(); exportReport(); }
  });
  window.PetroPozoReporte = { buildReport };
})();
