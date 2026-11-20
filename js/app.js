// TIMEGRID — navegación inicial y pequeñas interacciones de interfaz
const navButtons = document.querySelectorAll("[data-view]");
const views = document.querySelectorAll(".view");
const pageName = document.getElementById("page-name");
const sidebar = document.getElementById("sidebar");
const mobileMenu = document.getElementById("mobile-menu");
const toast = document.getElementById("toast");

const viewNames = {
  home: "Inicio",
  builder: "Crear horario",
  schedule: "Vista semanal",
  saved: "Mis horarios"
};

function showView(viewName) {
  views.forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));

  // La vista semanal es parte del flujo de "Crear horario".
  const activeNav = viewName === "schedule" ? "builder" : viewName;
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === activeNav);
  });

  pageName.textContent = viewNames[viewName] || "Inicio";
  sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

mobileMenu.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.addEventListener("click", (event) => {
  if (window.innerWidth > 760) return;
  const clickedInsideSidebar = sidebar.contains(event.target);
  const clickedMenu = mobileMenu.contains(event.target);
  if (!clickedInsideSidebar && !clickedMenu) sidebar.classList.remove("open");
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

// El botón "Continuar" del constructor se gestiona en builder.js.

// El guardado vive en storage.js y la vista "Mis horarios" (con sus contadores) en library.js.
