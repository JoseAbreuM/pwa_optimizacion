document.addEventListener('DOMContentLoaded', async () => {
  window.PetroUI?.init?.();
  window.PetroPozos?.init?.();
  window.PetroMuestras?.init?.();
  window.PetroParametros?.init?.();
  window.PetroNiveles?.init?.();
  await window.PetroSync?.initDashboard?.();
});
