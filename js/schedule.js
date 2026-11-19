// TIMEGRID — Etapa 3: detección de superposiciones y tabla semanal
// Expone el objeto global TimeGridSchedule, que también usa builder.js.
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
  const ALTO_HORA = 56; // px por hora en la tabla

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

  /* ---------- Helpers de DOM ---------- */
  const $ = (id) => document.getElementById(id);

  function crear(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  /* ---------- Tabla semanal ---------- */
  function aplanarTurnos(actividades) {
    return actividades.flatMap((actividad) =>
      actividad.turnos.map((turno) => ({ actividad, ...turno }))
    );
  }

  function crearBloque(turno, inicioTabla) {
    const minutos = duracionTurno(turno);
    const alto = (minutos / 60) * ALTO_HORA;
    const top = ((aMinutos(turno.inicio) - inicioTabla) / 60) * ALTO_HORA;

    const bloque = crear("article", "week-block");
    bloque.style.setProperty("--c", turno.actividad.color);
    bloque.style.top = `${top + 1}px`;
    bloque.style.height = `${alto - 2}px`;
    bloque.title = `${turno.actividad.nombre} · ${DIA_LABEL[turno.dia]} ${turno.inicio}–${turno.fin}`;
    if (alto < 46) bloque.classList.add("compact");

    bloque.append(
      crear("strong", "week-block-name", turno.actividad.nombre),
      crear("span", "week-block-time", `${turno.inicio} – ${turno.fin}`)
    );
    return bloque;
  }

  function construirTabla(actividades) {
    const turnos = aplanarTurnos(actividades);
    const diasUsados = new Set(turnos.map((t) => DIA_ORDEN[t.dia]));
    const dias = DIAS.filter((_, indice) => indice < DIAS_BASE || diasUsados.has(indice));

    const inicioTabla = Math.floor(Math.min(...turnos.map((t) => aMinutos(t.inicio))) / 60) * 60;
    const finTabla = Math.ceil(Math.max(...turnos.map((t) => aMinutos(t.fin))) / 60) * 60;
    const horas = (finTabla - inicioTabla) / 60;

    const grid = crear("div", "week-grid");
    grid.style.setProperty("--days", String(dias.length));
    grid.style.setProperty("--hour-h", `${ALTO_HORA}px`);
    grid.style.setProperty("--body-h", `${horas * ALTO_HORA}px`);
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Tabla semanal de actividades");

    // Fila de encabezados
    grid.appendChild(crear("div", "week-corner"));
    dias.forEach((dia) => grid.appendChild(crear("div", "week-day-head", dia.label)));

    // Columna de horas
    const columnaHoras = crear("div", "week-times");
    for (let i = 0; i < horas; i += 1) {
      const etiqueta = crear("span", "week-time-label", aHHMM(inicioTabla + i * 60));
      etiqueta.style.top = `${i * ALTO_HORA}px`;
      columnaHoras.appendChild(etiqueta);
    }
    grid.appendChild(columnaHoras);

    // Una columna por día, con sus bloques
    dias.forEach((dia) => {
      const columna = crear("div", "week-col");
      columna.dataset.dia = dia.value;
      turnos
        .filter((t) => t.dia === dia.value)
        .sort((x, y) => aMinutos(x.inicio) - aMinutos(y.inicio))
        .forEach((t) => columna.appendChild(crearBloque(t, inicioTabla)));
      grid.appendChild(columna);
    });

    return grid;
  }

  /* ---------- Resumen y leyenda ---------- */
  function minutosPorActividad(actividad) {
    return actividad.turnos.reduce((total, t) => total + duracionTurno(t), 0);
  }

  function renderResumen(actividades) {
    const totalTurnos = actividades.reduce((n, a) => n + a.turnos.length, 0);
    const totalMinutos = actividades.reduce((n, a) => n + minutosPorActividad(a), 0);

    $("stat-activities").textContent = String(actividades.length);
    $("stat-shifts").textContent = String(totalTurnos);
    $("stat-hours").textContent = formatearDuracion(totalMinutos);
  }

  function renderLeyenda(actividades) {
    const leyenda = $("schedule-legend");
    leyenda.replaceChildren(
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

  /* ---------- Punto de entrada ---------- */
  // Rellena la vista del horario. Quien la llama decide cuándo mostrarla.
  function mostrar(nombre, actividades) {
    $("schedule-title").textContent = nombre;
    renderResumen(actividades);
    $("week-scroll").replaceChildren(construirTabla(actividades));
    renderLeyenda(actividades);
  }

  window.TimeGridSchedule = {
    DIAS,
    DIA_ORDEN,
    DIA_LABEL,
    aMinutos,
    seSuperponen,
    detectarConflictos,
    formatearDuracion,
    mostrar
  };
})();
