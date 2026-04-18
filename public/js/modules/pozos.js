(() => {
  function init() {
    const searchInput = document.querySelector('[data-pozos-search]');
    const rows = Array.from(document.querySelectorAll('[data-pozo-row]'));

    if (!searchInput || !rows.length) return;

    searchInput.addEventListener('input', event => {
      const term = String(event.target.value || '').trim().toLowerCase();

      rows.forEach(row => {
        const searchable = row.getAttribute('data-pozo-row') || '';
        row.classList.toggle('hidden', Boolean(term) && !searchable.includes(term));
      });
    });
  }

  window.PetroPozos = {
    init
  };
})();
