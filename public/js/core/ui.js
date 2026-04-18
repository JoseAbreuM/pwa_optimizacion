(() => {
  function init() {
    const activeTables = document.querySelectorAll('[data-ui="responsive-table"]');
    activeTables.forEach(table => {
      table.classList.add('align-middle');
    });
  }

  window.PetroUI = {
    init
  };
})();
