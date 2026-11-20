// TIMEGRID — tabla semanal, superposiciones y acciones de la vista del horario
// Expone el objeto global TimeGridSchedule, que también usan builder.js, storage.js, export.js y library.js.
(() => {
  "use strict";

  /* ---------- Constantes compartidas ---------- */
  const DIAS = [
    { value: "lunes", label: "Lunes" },
    { value: "martes", label: "Martes" },
    { value: "miercoles", label: "Miércoles" },
    { value: "jueves", label: "Jueves" },
    { value: "viernes", label: "Viernes" },
    { value: "sabado", label: "Sábado" },
    { value: "domingo", label: "Domingo" }
  ];
  const DIA_ORDEN = Object.fromEntries(DIAS.map((d, i) => [d.value, i]));
  const DIA_LABEL = Object.fromEntries(DIAS.map((d) => [d.value, d.label]));
  const DIAS_BASE = 5; // Lunes a viernes siempre visibles; sábado y domingo solo si se usan.

  const EVENTO_CAMBIOS = "timegrid:horarios-cambiados";
  const ANCHO_COL_HORAS = 56;   // px, columna de horas de la tabla
  const ANCHO_MIN_DIA = 84;     // px mínimos por día antes de pasar a la agenda
  const ALTO_HORA_MIN = 52;
  const ALTO_HORA_MAX = 76;

  /* ---------- Utilidades de tiempo ---------- */
  function aMinutos(hhmm) {
    const [horas, minutos] = hhmm.split(":").map(Number);
    return horas * 60 + minutos;
  }

  function aHHMM(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0");
    const m = String(minutos % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function formatearDuracion(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} min`;
  }

  function duracionTurno(turno) {
    return aMinutos(turno.fin) - aMinutos(turno.inicio);
  }

  function indiceDeHoy() {
    return (new Date().getDay() + 6) % 7; // JS: domingo = 0 → aquí lunes = 0
  }

  /* ---------- Superposiciones ---------- */
  // Dos turnos chocan si son el mismo día y sus rangos se cruzan.
  // Si uno termina justo cuando empieza el otro, no es conflicto.
  function seSuperponen(turnoA, turnoB) {
    return (
      turnoA.dia === turnoB.dia &&
      aMinutos(turnoA.inicio) < aMinutos(turnoB.fin) &&
      aMinutos(turnoB.inicio) < aMinutos(turnoA.fin)
    );
  }

  // Compara turnos de actividades DIFERENTES. Devuelve una lista ordenada por día y hora.
  function detectarConflictos(actividades) {
    const conflictos = [];

    for (let i = 0; i < actividades.length; i += 1) {
      for (let j = i + 1; j < actividades.length; j += 1) {
        const a = actividades[i];
        const b = actividades[j];
        a.turnos.forEach((turnoA) => {
          b.turnos.forEach((turnoB) => {
            if (seSuperponen(turnoA, turnoB)) {
              conflictos.push({ a, b, turnoA, turnoB, dia: turnoA.dia });
            }
          });
        });
      }
    }

    return conflictos.sort((x, y) => {
      const porDia = DIA_ORDEN[x.dia] - DIA_ORDEN[y.dia];
      if (porDia !== 0) return porDia;
      return aMinutos(x.turnoA.inicio) - aMinutos(y.turnoA.inicio);
    });
  }

  /* ---------- Estructura de la semana (la comparten la tabla y la exportación) ---------- */
  function aplanarTurnos(actividades) {
    return actividades.flatMap((actividad) =>
      actividad.turnos.map((turno) => ({ actividad, ...turno }))
    );
  }

  function calcularEstructura(actividades) {
    const turnos = aplanarTurnos(actividades);
    const diasUsados = new Set(turnos.map((t) => DIA_ORDEN[t.dia]));
    const dias = DIAS.filter((_, indice) => indice < DIAS_BASE || diasUsados.has(indice));
    const inicioTabla = Math.floor(Math.min(...turnos.map((t) => aMinutos(t.inicio))) / 60) * 60;
    const finTabla = Math.ceil(Math.max(...turnos.map((t) => aMinutos(t.fin))) / 60) * 60;
    return { turnos, dias, inicioTabla, finTabla, horas: (finTabla - inicioTabla) / 60 };
  }

  function minutosPorActividad(actividad) {
    return actividad.turnos.reduce((total, t) => total + duracionTurno(t), 0);
  }

  function calcularResumen(actividades) {
    return {
      actividades: actividades.length,
      turnos: actividades.reduce((n, a) => n + a.turnos.length, 0),
      minutos: actividades.reduce((n, a) => n + minutosPorActividad(a), 0)
    };
  }

  /* ---------- Helpers de DOM ---------- */
  const $ = (id) => document.getElementById(id);

  function crear(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  /* ---------- Tabla semanal ---------- */
  // Las posiciones se expresan con calc() y la variable --hour-h, así la tabla
  // se reescala al instante cuando cambia el tamaño de la pantalla, sin volver a dibujarse.
  function crearBloque(turno, inicioTabla) {
    const minutos = duracionTurno(turno);
    const bloque = crear("article", "week-block");
    bloque.style.setProperty("--c", turno.actividad.color);
    bloque.style.top = `calc(var(--pad) + var(--hour-h) * ${(aMinutos(turno.inicio) - inicioTabla) / 60} + 1px)`;
    bloque.style.height = `calc(var(--hour-h) * ${minutos / 60} - 2px)`;
    bloque.dataset.minutos = String(minutos);
    bloque.title = `${turno.actividad.nombre} · ${DIA_LABEL[turno.dia]} ${turno.inicio}–${turno.fin}`;

    const texto = crear("div", "week-block-text");
    texto.append(
      crear("strong", "week-block-name", turno.actividad.nombre),
      crear("span", "week-block-time", `${turno.inicio} – ${turno.fin}`)
    );
    bloque.append(texto, crear("span", "week-block-duration", formatearDuracion(minutos)));
    return bloque;
  }

  function crearLineaAhora(inicioTabla, finTabla) {
    const ahora = new Date();
    const minutos = ahora.getHours() * 60 + ahora.getMinutes();
    if (minutos < inicioTabla || minutos > finTabla) return null;
    const linea = crear("div", "week-now");
    linea.style.top = `calc(var(--pad) + var(--hour-h) * ${(minutos - inicioTabla) / 60})`;
    linea.setAttribute("aria-hidden", "true");
    return linea;
  }

  function construirTabla(actividades) {
    const { turnos, dias, inicioTabla, finTabla, horas } = calcularEstructura(actividades);
    const hoy = indiceDeHoy();

    const grid = crear("div", "week-grid");
    grid.dataset.days = String(dias.length);
    grid.dataset.hours = String(horas);
    grid.style.setProperty("--days", String(dias.length));
    grid.style.setProperty("--hours", String(horas));
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Tabla semanal de actividades");

    // Encabezados
    grid.appendChild(crear("div", "week-corner"));
    dias.forEach((dia) => {
      const esHoy = DIA_ORDEN[dia.value] === hoy;
      const cabecera = crear("div", `week-day-head${esHoy ? " today" : ""}`);
      cabecera.append(crear("span", "week-day-name", dia.label));
      if (esHoy) cabecera.append(crear("span", "week-today-tag", "HOY"));
      grid.appendChild(cabecera);
    });

    // Columna de horas
    const columnaHoras = crear("div", "week-times");
    for (let i = 0; i <= horas; i += 1) {
      const etiqueta = crear("span", "week-time-label", aHHMM(inicioTabla + i * 60));
      etiqueta.style.top = `calc(var(--pad) + var(--hour-h) * ${i} - 7px)`;
      columnaHoras.appendChild(etiqueta);
    }
    grid.appendChild(columnaHoras);

    // Una columna por día
    dias.forEach((dia) => {
      const esHoy = DIA_ORDEN[dia.value] === hoy;
      const columna = crear("div", `week-col${esHoy ? " today" : ""}`);
      columna.dataset.dia = dia.value;
      turnos
        .filter((t) => t.dia === dia.value)
        .sort((x, y) => aMinutos(x.inicio) - aMinutos(y.inicio))
        .forEach((t) => columna.appendChild(crearBloque(t, inicioTabla)));
      if (esHoy) {
        const linea = crearLineaAhora(inicioTabla, finTabla);
        if (linea) columna.appendChild(linea);
      }
      grid.appendChild(columna);
    });

    return grid;
  }

  // Versión vertical para paneles angostos: un bloque por día.
  function construirAgenda(actividades) {
    const { turnos, dias } = calcularEstructura(actividades);
    const hoy = indiceDeHoy();
    const agenda = crear("div", "agenda-days");

    dias.forEach((dia) => {
      const delDia = turnos
        .filter((t) => t.dia === dia.value)
        .sort((x, y) => aMinutos(x.inicio) - aMinutos(y.inicio));
      if (delDia.length === 0) return;

      const seccion = crear("section", "agenda-day");
      const cabecera = crear("header", "agenda-day-head");
      cabecera.append(crear("h4", "", dia.label));
      if (DIA_ORDEN[dia.value] === hoy) cabecera.append(crear("span", "week-today-tag", "HOY"));
      cabecera.append(crear("span", "agenda-count", `${delDia.length} ${delDia.length === 1 ? "turno" : "turnos"}`));

      const lista = crear("ul", "agenda-list");
      delDia.forEach((t) => {
        const item = crear("li", "agenda-item");
        item.style.setProperty("--c", t.actividad.color);
        const texto = crear("div", "agenda-item-text");
        texto.append(
          crear("strong", "", t.actividad.nombre),
          crear("span", "", `${t.inicio} – ${t.fin}`)
        );
        item.append(texto, crear("span", "agenda-item-duration", formatearDuracion(duracionTurno(t))));
        lista.appendChild(item);
      });

      seccion.append(cabecera, lista);
      agenda.appendChild(seccion);
    });

    return agenda;
  }

  // Decide alto de hora y modo (grilla o agenda) según el espacio disponible.
  function ajustarTabla() {
    const panel = $("week-panel");
    const grid = panel && panel.querySelector(".week-grid");
    if (!grid || panel.clientWidth === 0) return; // vista oculta

    const estilo = window.getComputedStyle(panel);
    const ancho = panel.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    const dias = Number(grid.dataset.days);
    const horas = Number(grid.dataset.hours);

    panel.classList.toggle("is-agenda", ancho < ANCHO_COL_HORAS + dias * ANCHO_MIN_DIA);

    const disponible = Math.max(380, window.innerHeight - 340);
    const altoHora = Math.min(ALTO_HORA_MAX, Math.max(ALTO_HORA_MIN, Math.floor(disponible / horas)));
    grid.style.setProperty("--hour-h", `${altoHora}px`);

    grid.querySelectorAll(".week-block").forEach((bloque) => {
      const alto = (Number(bloque.dataset.minutos) / 60) * altoHora;
      bloque.classList.toggle("compact", alto < 44);
      bloque.classList.toggle("tall", alto >= 84);
    });
  }

  /* ---------- Resumen y leyenda ---------- */
  function renderResumen(actividades) {
    const resumen = calcularResumen(actividades);
    $("stat-activities").textContent = String(resumen.actividades);
    $("stat-shifts").textContent = String(resumen.turnos);
    $("stat-hours").textContent = formatearDuracion(resumen.minutos);
  }

  function renderLeyenda(actividades) {
    $("schedule-legend").replaceChildren(
      ...actividades.map((actividad) => {
        const item = crear("li", "legend-item");
        item.style.setProperty("--c", actividad.color);
        item.append(
          crear("span", "legend-swatch"),
          crear("span", "legend-name", actividad.nombre),
          crear("span", "legend-hours", formatearDuracion(minutosPorActividad(actividad)))
        );
        return item;
      })
    );
  }

  /* ---------- Miniatura (para "Mis horarios") ---------- */
  function crearMiniatura(actividades) {
    const { turnos, dias, inicioTabla, horas } = calcularEstructura(actividades);
    const total = horas * 60;
    const mini = crear("div", "mini-week");
    mini.style.setProperty("--days", String(dias.length));
    mini.setAttribute("aria-hidden", "true");

    dias.forEach((dia) => {
      const columna = crear("div", "mini-col");
      turnos.filter((t) => t.dia === dia.value).forEach((t) => {
        const bloque = crear("span", "mini-block");
        bloque.style.setProperty("--c", t.actividad.color);
        bloque.style.top = `${((aMinutos(t.inicio) - inicioTabla) / total) * 100}%`;
        bloque.style.height = `${(duracionTurno(t) / total) * 100}%`;
        columna.appendChild(bloque);
      });
      mini.appendChild(columna);
    });
    return mini;
  }

  /* ---------- Vista del horario: estado, guardado y exportación ---------- */
  let actual = null; // { id, nombre, actividades } que se está mostrando

  function firma(horario) {
    return JSON.stringify([
      horario.nombre,
      horario.actividades.map((a) => [a.nombre, a.color, a.turnos.map((t) => [t.dia, t.inicio, t.fin])])
    ]);
  }

  function actualizarEstadoGuardado() {
    if (!actual) return;
    const estado = $("save-status");
    const boton = $("btn-save-schedule");
    const guardado = actual.id ? window.TimeGridStorage.obtener(actual.id) : null;
    const igual = Boolean(guardado) && firma(guardado) === firma(actual);

    estado.dataset.state = igual ? "saved" : "unsaved";
    estado.textContent = igual ? "✓ Guardado" : guardado ? "● Cambios sin guardar" : "● Sin guardar";
    boton.textContent = guardado ? "Guardar cambios" : "Guardar horario";
    boton.disabled = igual;
  }

  function guardarActual() {
    if (!actual) return;
    const resultado = window.TimeGridStorage.guardar(actual);
    if (!resultado.ok) {
      showToast(resultado.error);
      return;
    }
    actual.id = resultado.horario.id;
    actualizarEstadoGuardado();
    document.dispatchEvent(new CustomEvent(EVENTO_CAMBIOS, {
      detail: { origen: "schedule", horario: resultado.horario }
    }));
    showToast(resultado.nuevo ? `Horario "${actual.nombre}" guardado.` : `Cambios en "${actual.nombre}" guardados.`);
  }

  async function exportarActual(formato) {
    if (!actual) return;
    const boton = $(formato === "png" ? "btn-export-png" : "btn-export-pdf");
    boton.disabled = true;
    try {
      await (formato === "png" ? window.TimeGridExport.exportarPNG(actual) : window.TimeGridExport.exportarPDF(actual));
    } finally {
      boton.disabled = false;
    }
  }

  // Rellena la vista del horario. Quien la llama decide cuándo mostrarla.
  function mostrar(horario) {
    actual = {
      id: horario.id || null,
      nombre: horario.nombre,
      actividades: JSON.parse(JSON.stringify(horario.actividades))
    };
    $("schedule-title").textContent = actual.nombre;
    renderResumen(actual.actividades);
    $("week-scroll").replaceChildren(construirTabla(actual.actividades));
    $("week-agenda").replaceChildren(construirAgenda(actual.actividades));
    renderLeyenda(actual.actividades);
    actualizarEstadoGuardado();
    window.requestAnimationFrame(ajustarTabla);
  }

  function init() {
    $("btn-save-schedule").addEventListener("click", guardarActual);
    $("btn-export-png").addEventListener("click", () => exportarActual("png"));
    $("btn-export-pdf").addEventListener("click", () => exportarActual("pdf"));

    window.addEventListener("resize", ajustarTabla);
    if ("ResizeObserver" in window) new ResizeObserver(ajustarTabla).observe($("week-panel"));

    // Si el horario abierto se borra desde "Mis horarios", deja de estar guardado.
    document.addEventListener(EVENTO_CAMBIOS, (evento) => {
      const { origen, eliminadoId } = evento.detail || {};
      if (origen === "library" && eliminadoId && actual && actual.id === eliminadoId) actual.id = null;
      actualizarEstadoGuardado();
    });
  }

  window.TimeGridSchedule = {
    DIAS,
    DIA_ORDEN,
    DIA_LABEL,
    EVENTO_CAMBIOS,
    aMinutos,
    aHHMM,
    seSuperponen,
    detectarConflictos,
    formatearDuracion,
    duracionTurno,
    calcularEstructura,
    calcularResumen,
    minutosPorActividad,
    crearMiniatura,
    firmaHorario: firma,
    mostrar
  };

  // Los elementos de la vista existen en el HTML estático; se inicializa al terminar de cargar.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
