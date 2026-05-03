document.addEventListener('DOMContentLoaded', () => {
  initUsersTables();
  initUsersTabAdjustments();
});

function initUsersTables() {
  if (typeof window.DataTable === 'undefined') {
    console.warn('DataTables.net no está cargado.');
    return;
  }

  const tables = {};

  const usuariosTable = document.getElementById('tabla-usuarios');
  const personalTable = document.getElementById('tabla-personal');

  if (usuariosTable && !window.DataTable.isDataTable('#tabla-usuarios')) {
    tables.usuarios = new window.DataTable('#tabla-usuarios', {
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      scrollX: true,
      colReorder: true,
      ordering: true,
      order: [[0, 'asc']],
      language: getSpanishDataTablesLanguage()
    });
  }

  if (personalTable && !window.DataTable.isDataTable('#tabla-personal')) {
    tables.personal = new window.DataTable('#tabla-personal', {
      pageLength: 10,
      lengthMenu: [5, 10, 25, 50],
      scrollX: true,
      colReorder: true,
      ordering: true,
      order: [[0, 'asc']],
      language: getSpanishDataTablesLanguage()
    });
  }

  window.usersTables = tables;
}

function initUsersTabAdjustments() {
  document.querySelectorAll('[data-tabs-target]').forEach((tabButton) => {
    tabButton.addEventListener('click', () => {
      setTimeout(() => {
        Object.values(window.usersTables || {}).forEach((table) => {
          if (table?.columns) table.columns.adjust();
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