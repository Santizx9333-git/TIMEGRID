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
  saved: "Mis horarios"
};

function showView(viewName) {
  views.forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
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

// En esta primera etapa todavía no guardamos horarios reales.
// Estos contadores quedan preparados para conectarlos con localStorage.
function updateScheduleCounters() {
  const savedSchedules = JSON.parse(localStorage.getItem("timegrid-schedules") || "[]");
  const count = savedSchedules.length;

  document.getElementById("saved-count").textContent = count;
  document.getElementById("home-saved-count").textContent = String(count).padStart(2, "0");

  const emptyState = document.getElementById("saved-empty");
  const savedList = document.getElementById("saved-list");

  emptyState.hidden = count > 0;
  savedList.innerHTML = "";

  savedSchedules.forEach((schedule) => {
    const card = document.createElement("article");
    card.className = "saved-card";

    const title = document.createElement("h3");
    title.textContent = schedule.nombre || "Horario sin nombre";

    const description = document.createElement("p");
    description.textContent = `${(schedule.actividades || []).length} actividades`;

    card.append(title, description);
    savedList.appendChild(card);
  });
}

updateScheduleCounters();
