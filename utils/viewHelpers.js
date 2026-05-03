/**
 * Helpers disponibles para las vistas EJS.
 */

/**
 * Formatea fechas en DD/MM/YYYY.
 *
 * Acepta:
 * - Date
 * - string tipo '2026-04-29'
 * - string datetime de MySQL
 *
 * Si no hay fecha válida, devuelve '—'.
 */
function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea números simples.
 *
 * Útil para evitar mostrar null, undefined o NaN.
 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);

  if (!Number.isFinite(number)) return '—';

  return number.toLocaleString('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Devuelve un texto seguro para vistas.
 */
function fallback(value, emptyValue = '—') {
  if (value === null || value === undefined || value === '') {
    return emptyValue;
  }

  return value;
}

module.exports = {
  formatDate,
  formatNumber,
  fallback
};