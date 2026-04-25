document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initDashboardChart();
  initTableExportButtons();

  document.querySelectorAll('[data-tabs-target]').forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      setTimeout(() => {
        tableMuestreo?.refresh();
        tableBombas?.refresh();
        forceShowDatatables();
      }, 150);
    });
  });

  forceShowDatatables();
});

function initDashboardChart() {
  const dataNode = document.getElementById('dashboard-data');

  let dashboardData = {
    categorias: []
  };

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

function initTableExportButtons() {
  document.querySelectorAll('[data-export-table]').forEach((button) => {
    button.addEventListener('click', () => {
      const tableId = button.dataset.exportTable;
      const table = document.getElementById(tableId);

      if (!table) return;

      exportTableToCSV(table, tableId);
    });
  });
}

function exportTableToCSV(table, filename) {
  const rows = Array.from(table.querySelectorAll('tr'));

  const csv = rows.map((row) => {
    const cells = Array.from(row.querySelectorAll('th, td'));

    return cells.map((cell) => {
      const value = cell.innerText.trim().replace(/\s+/g, ' ');
      return `"${value.replace(/"/g, '""')}"`;
    }).join(';');
  }).join('\n');

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${filename}.csv`;
  link.click();

  URL.revokeObjectURL(url);
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