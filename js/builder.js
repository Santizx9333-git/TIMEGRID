// TIMEGRID — constructor de actividades (Etapas 2 y 3)
// Formulario, CRUD de actividades, turnos, validaciones, avisos de superposición y renderizado.
// Los datos viven solo en memoria (la persistencia llega en una etapa posterior).
(() => {
  "use strict";

  /* ---------- Constantes ---------- */
  const TG = window.TimeGridSchedule; // helpers y constantes compartidas (schedule.js)
  const { DIAS, DIA_ORDEN, DIA_LABEL } = TG;

  const COLORES = [
    { nombre: "Violeta", valor: "#9875FF" },
    { nombre: "Azul", valor: "#428BD7" },
    { nombre: "Verde", valor: "#37B88B" },
    { nombre: "Naranja", valor: "#D99143" },
    { nombre: "Rosa", valor: "#E46D9A" },
    { nombre: "Celeste", valor: "#4FB6C6" }
  ];

  /* ---------- Estado en memoria ---------- */
  const state = {
    actividades: [],
    editingId: null,
    color: COLORES[0].valor,
    turnosBorrador: [],
    pendingDeleteId: null
  };
  let deleteTimer = null;
  let conflictosActuales = [];
  let idsEnConflicto = new Set();

  /* ---------- Referencias al DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    scheduleName: $("schedule-name"),
    scheduleNameError: $("schedule-name-error"),
    form: $("activity-form"),
    formTitle: $("form-title"),
    editingBadge: $("editing-badge"),
    activityName: $("activity-name"),
    palette: $("color-palette"),
    colorName: $("color-name"),
    shiftsList: $("shifts-list"),
    shiftCounter: $("shift-counter"),
    addShift: $("add-shift"),
    formErrors: $("form-errors"),
    submit: $("submit-activity"),
    cancel: $("cancel-edit"),
    list: $("activity-list"),
    empty: $("activities-empty"),
    count: $("activity-count"),
    conflictPanel: $("conflict-panel"),
    continueBtn: $("start-builder"),
    continueStatus: $("continue-status")
  };

  /* ---------- Utilidades ---------- */
  function createId() {
    return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function nuevoTurnoBorrador(datos = {}) {
    return {
      uid: createId(),
      dia: datos.dia || "",
      inicio: datos.inicio || "",
      fin: datos.fin || ""
    };
  }

  function pluralTurnos(n) {
    return `${n} ${n === 1 ? "turno" : "turnos"}`;
  }

  function nombreDeColor(valor) {
    const encontrado = COLORES.find((c) => c.valor.toLowerCase() === String(valor).toLowerCase());
    return encontrado ? encontrado.nombre : "";
  }

  function describirTurno(turno) {
    return `${DIA_LABEL[turno.dia] || turno.dia} ${turno.inicio}–${turno.fin}`;
  }

  function ordenarTurnos(turnos) {
    return [...turnos].sort((a, b) => {
      const porDia = DIA_ORDEN[a.dia] - DIA_ORDEN[b.dia];
      return porDia !== 0 ? porDia : a.inicio.localeCompare(b.inicio);
    });
  }

  // Primer color de la paleta que todavía no usa ninguna actividad.
  function siguienteColorLibre() {
    const usados = new Set(state.actividades.map((a) => a.color.toLowerCase()));
    const libre = COLORES.find((c) => !usados.has(c.valor.toLowerCase()));
    return (libre || COLORES[0]).valor;
  }

  function crearElemento(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  /* ---------- Paleta de colores ---------- */
  function construirPaleta() {
    COLORES.forEach((color) => {
      const label = crearElemento("label", "swatch");
      label.title = color.nombre;

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "activity-color";
      input.value = color.valor;
      input.setAttribute("aria-label", color.nombre);
      input.addEventListener("change", () => setColor(color.valor));

      const dot = crearElemento("span", "swatch-dot");
      dot.style.setProperty("--swatch", color.valor);

      label.append(input, dot);
      el.palette.appendChild(label);
    });
  }

  function setColor(valor) {
    state.color = valor;
    el.palette.querySelectorAll("input").forEach((input) => {
      input.checked = input.value.toLowerCase() === valor.toLowerCase();
    });
    el.colorName.textContent = nombreDeColor(valor);
  }

  /* ---------- Turnos del formulario ---------- */
  function crearCampoTurno(textoLabel, control) {
    const wrapper = crearElemento("label", "shift-field");
    wrapper.append(crearElemento("span", "shift-field-label", textoLabel), control);
    return wrapper;
  }

  function renderTurnos() {
    el.shiftsList.replaceChildren();
    el.shiftCounter.textContent = pluralTurnos(state.turnosBorrador.length);

    if (state.turnosBorrador.length === 0) {
      el.shiftsList.appendChild(
        crearElemento("p", "shifts-empty", "Todavía no agregaste turnos. Sumá al menos uno para guardar la actividad.")
      );
      return;
    }

    state.turnosBorrador.forEach((turno, index) => {
      const row = crearElemento("div", "shift-row");
      row.dataset.uid = turno.uid;

      const head = crearElemento("div", "shift-head");
      head.appendChild(crearElemento("span", "shift-title", `TURNO ${index + 1}`));
      const remove = crearElemento("button", "shift-remove", "✕ Quitar");
      remove.type = "button";
      remove.setAttribute("aria-label", `Quitar turno ${index + 1}`);
      remove.addEventListener("click", () => quitarTurno(turno.uid));
      head.appendChild(remove);

      const fields = crearElemento("div", "shift-fields");

      const select = crearElemento("select", "text-input");
      select.dataset.field = "dia";
      const placeholder = crearElemento("option", "", "Elegí un día");
      placeholder.value = "";
      select.appendChild(placeholder);
      DIAS.forEach((d) => {
        const option = crearElemento("option", "", d.label);
        option.value = d.value;
        select.appendChild(option);
      });
      select.value = turno.dia;
      select.addEventListener("change", () => {
        turno.dia = select.value;
        select.classList.remove("invalid");
      });

      const inicio = crearElemento("input", "text-input");
      inicio.type = "time";
      inicio.dataset.field = "inicio";
      inicio.value = turno.inicio;
      inicio.addEventListener("input", () => {
        turno.inicio = inicio.value;
        inicio.classList.remove("invalid");
        fin.classList.remove("invalid");
      });

      const fin = crearElemento("input", "text-input");
      fin.type = "time";
      fin.dataset.field = "fin";
      fin.value = turno.fin;
      fin.addEventListener("input", () => {
        turno.fin = fin.value;
        fin.classList.remove("invalid");
        inicio.classList.remove("invalid");
      });

      fields.append(
        crearCampoTurno("Día", select),
        crearCampoTurno("Inicio", inicio),
        crearCampoTurno("Fin", fin)
      );
      row.append(head, fields);
      el.shiftsList.appendChild(row);
    });
  }

  function agregarTurno() {
    const nuevo = nuevoTurnoBorrador();
    state.turnosBorrador.push(nuevo);
    renderTurnos();
    const select = el.shiftsList.querySelector(`[data-uid="${nuevo.uid}"] select`);
    if (select) select.focus();
  }

  function quitarTurno(uid) {
    state.turnosBorrador = state.turnosBorrador.filter((t) => t.uid !== uid);
    renderTurnos();
    limpiarErroresFormulario();
  }

  /* ---------- Validaciones ---------- */
  // Devuelve { errores: string[], invalidos: [{uid?, campo}] }
  function validarActividad(nombre, turnos) {
    const errores = [];
    const invalidos = [];

    if (!nombre) {
      errores.push("Escribí un nombre para la actividad.");
      invalidos.push({ campo: "nombre" });
    }

    if (turnos.length === 0) {
      errores.push("Agregá al menos un turno.");
    }

    const vistos = new Map(); // clave -> número de turno
    const validos = []; // turnos completos y sin duplicar, para comparar superposiciones

    turnos.forEach((turno, index) => {
      const n = index + 1;
      let completo = true;

      if (!turno.dia) {
        errores.push(`Turno ${n}: elegí un día de la semana.`);
        invalidos.push({ uid: turno.uid, campo: "dia" });
        completo = false;
      }
      if (!turno.inicio) {
        errores.push(`Turno ${n}: completá la hora de inicio.`);
        invalidos.push({ uid: turno.uid, campo: "inicio" });
        completo = false;
      }
      if (!turno.fin) {
        errores.push(`Turno ${n}: completá la hora de finalización.`);
        invalidos.push({ uid: turno.uid, campo: "fin" });
        completo = false;
      }
      if (!completo) return;

      if (turno.inicio >= turno.fin) {
        errores.push(`Turno ${n}: la hora de inicio (${turno.inicio}) debe ser anterior a la de finalización (${turno.fin}).`);
        invalidos.push({ uid: turno.uid, campo: "inicio" }, { uid: turno.uid, campo: "fin" });
        return;
      }

      const clave = `${turno.dia}|${turno.inicio}|${turno.fin}`;
      if (vistos.has(clave)) {
        errores.push(`Turno ${n}: es igual al turno ${vistos.get(clave)} (${describirTurno(turno)}). No se permiten turnos duplicados.`);
        invalidos.push(
          { uid: turno.uid, campo: "dia" },
          { uid: turno.uid, campo: "inicio" },
          { uid: turno.uid, campo: "fin" }
        );
        return;
      }

      vistos.set(clave, n);

      const choque = validos.find((v) => TG.seSuperponen(v.turno, turno));
      if (choque) {
        errores.push(`Turno ${n}: se superpone con el turno ${choque.n} (${describirTurno(choque.turno)}) de esta misma actividad.`);
        invalidos.push({ uid: turno.uid, campo: "inicio" }, { uid: turno.uid, campo: "fin" });
      }
      validos.push({ n, turno });
    });

    return { errores, invalidos };
  }

  function mostrarErroresFormulario({ errores, invalidos }) {
    el.formErrors.replaceChildren();
    el.formErrors.appendChild(crearElemento("strong", "", "Revisá estos datos antes de guardar:"));
    const ul = crearElemento("ul");
    errores.forEach((mensaje) => ul.appendChild(crearElemento("li", "", mensaje)));
    el.formErrors.appendChild(ul);
    el.formErrors.hidden = false;

    invalidos.forEach(({ uid, campo }) => {
      const control = campo === "nombre"
        ? el.activityName
        : el.shiftsList.querySelector(`[data-uid="${uid}"] [data-field="${campo}"]`);
      if (control) control.classList.add("invalid");
    });

    const primero = el.form.querySelector(".invalid");
    if (primero) primero.focus();
  }

  function limpiarErroresFormulario() {
    el.formErrors.hidden = true;
    el.formErrors.replaceChildren();
    el.form.querySelectorAll(".invalid").forEach((n) => n.classList.remove("invalid"));
  }

  /* ---------- Guardar / editar / eliminar ---------- */
  function guardarActividad(event) {
    event.preventDefault();

    const nombre = el.activityName.value.trim();
    const turnos = state.turnosBorrador;
    limpiarErroresFormulario();

    const resultado = validarActividad(nombre, turnos);
    if (resultado.errores.length > 0) {
      mostrarErroresFormulario(resultado);
      return;
    }

    const turnosLimpios = ordenarTurnos(
      turnos.map(({ dia, inicio, fin }) => ({ dia, inicio, fin }))
    );

    let idGuardada = state.editingId;
    const mensajeOk = state.editingId ? `Actividad "${nombre}" actualizada.` : `Actividad "${nombre}" agregada.`;

    if (state.editingId) {
      const actividad = state.actividades.find((a) => a.id === state.editingId);
      if (actividad) {
        actividad.nombre = nombre;
        actividad.color = state.color;
        actividad.turnos = turnosLimpios;
      }
    } else {
      idGuardada = createId();
      state.actividades.push({
        id: idGuardada,
        nombre,
        color: state.color,
        turnos: turnosLimpios
      });
    }

    reiniciarFormulario();
    renderActividades();
    limpiarEstadoContinuar();

    const choques = conflictosActuales.filter((c) => c.a.id === idGuardada || c.b.id === idGuardada);
    showToast(choques.length > 0
      ? `${mensajeOk} Ojo: se superpone con otra actividad.`
      : mensajeOk);
  }

  function editarActividad(id) {
    const actividad = state.actividades.find((a) => a.id === id);
    if (!actividad) return;

    state.editingId = id;
    state.pendingDeleteId = null;
    el.activityName.value = actividad.nombre;
    setColor(actividad.color);
    state.turnosBorrador = actividad.turnos.map((t) => nuevoTurnoBorrador(t));
    limpiarErroresFormulario();
    renderTurnos();
    actualizarModoFormulario();
    renderActividades();

    el.form.scrollIntoView({ behavior: "smooth", block: "center" });
    el.activityName.focus();
  }

  function eliminarActividad(id) {
    const actividad = state.actividades.find((a) => a.id === id);
    if (!actividad) return;

    state.actividades = state.actividades.filter((a) => a.id !== id);
    state.pendingDeleteId = null;
    window.clearTimeout(deleteTimer);

    if (state.editingId === id) reiniciarFormulario();
    renderActividades();
    showToast(`Actividad "${actividad.nombre}" eliminada.`);
  }

  // Primer clic pide confirmación; segundo clic elimina.
  function pedirConfirmacionEliminar(id) {
    if (state.pendingDeleteId === id) {
      eliminarActividad(id);
      return;
    }
    state.pendingDeleteId = id;
    renderActividades();
    window.clearTimeout(deleteTimer);
    deleteTimer = window.setTimeout(() => {
      state.pendingDeleteId = null;
      renderActividades();
    }, 3500);
  }

  function reiniciarFormulario() {
    state.editingId = null;
    el.activityName.value = "";
    setColor(siguienteColorLibre());
    state.turnosBorrador = [nuevoTurnoBorrador()];
    limpiarErroresFormulario();
    renderTurnos();
    actualizarModoFormulario();
  }

  function cancelarEdicion() {
    reiniciarFormulario();
    renderActividades();
    showToast("Edición cancelada.");
  }

  function actualizarModoFormulario() {
    const editando = Boolean(state.editingId);
    el.formTitle.textContent = editando ? "Editar actividad" : "Nueva actividad";
    el.editingBadge.hidden = !editando;
    el.submit.textContent = editando ? "Actualizar actividad" : "Guardar actividad";
    el.cancel.hidden = !editando;
    el.form.classList.toggle("is-editing", editando);
  }

  /* ---------- Listado de actividades ---------- */
  function crearTarjeta(actividad) {
    const card = crearElemento("article", "activity-card");
    card.style.setProperty("--card-color", actividad.color);
    if (actividad.id === state.editingId) card.classList.add("is-editing");
    const enConflicto = idsEnConflicto.has(actividad.id);
    if (enConflicto) card.classList.add("has-conflict");

    const header = crearElemento("div", "activity-card-header");
    const dot = crearElemento("span", "activity-dot");
    dot.setAttribute("aria-hidden", "true");
    const titulo = crearElemento("h4", "activity-title", actividad.nombre);
    const badge = crearElemento("span", "activity-badge", pluralTurnos(actividad.turnos.length));
    header.append(dot, titulo, badge);
    if (enConflicto) header.appendChild(crearElemento("span", "activity-badge warn", "⚠ Superposición"));

    const turnos = crearElemento("ul", "activity-shifts");
    ordenarTurnos(actividad.turnos).forEach((turno) => {
      const li = crearElemento("li");
      li.append(
        crearElemento("span", "shift-day", DIA_LABEL[turno.dia] || turno.dia),
        crearElemento("span", "shift-time", `${turno.inicio} – ${turno.fin}`)
      );
      turnos.appendChild(li);
    });

    const acciones = crearElemento("div", "activity-actions");

    const editar = crearElemento("button", "button button-secondary button-small", "Editar");
    editar.type = "button";
    editar.setAttribute("aria-label", `Editar ${actividad.nombre}`);
    editar.addEventListener("click", () => editarActividad(actividad.id));

    const confirmando = state.pendingDeleteId === actividad.id;
    const eliminar = crearElemento(
      "button",
      `button button-small button-danger${confirmando ? " confirming" : ""}`,
      confirmando ? "¿Seguro? Confirmar" : "Eliminar"
    );
    eliminar.type = "button";
    eliminar.setAttribute("aria-label", `Eliminar ${actividad.nombre}`);
    eliminar.addEventListener("click", () => pedirConfirmacionEliminar(actividad.id));

    acciones.append(editar, eliminar);
    card.append(header, turnos, acciones);
    return card;
  }

  function renderConflictos() {
    conflictosActuales = TG.detectarConflictos(state.actividades);
    idsEnConflicto = new Set(conflictosActuales.flatMap((c) => [c.a.id, c.b.id]));

    el.conflictPanel.replaceChildren();
    el.conflictPanel.hidden = conflictosActuales.length === 0;
    if (conflictosActuales.length === 0) return;

    const total = conflictosActuales.length;
    el.conflictPanel.append(
      crearElemento("strong", "", `⚠ ${total} ${total === 1 ? "superposición detectada" : "superposiciones detectadas"}`),
      crearElemento("p", "conflict-note", "Dos actividades no pueden ocupar el mismo día y horario. Editá los turnos para resolverlo.")
    );

    const lista = crearElemento("ul", "conflict-list");
    conflictosActuales.forEach(({ a, b, turnoA, turnoB, dia }) => {
      const item = crearElemento("li");
      item.append(
        crearElemento("span", "conflict-names", `${a.nombre} ↔ ${b.nombre}`),
        crearElemento(
          "span",
          "conflict-when",
          `${DIA_LABEL[dia]} · ${turnoA.inicio}–${turnoA.fin} y ${turnoB.inicio}–${turnoB.fin}`
        )
      );
      lista.appendChild(item);
    });
    el.conflictPanel.appendChild(lista);
  }

  function renderActividades() {
    renderConflictos();
    el.list.replaceChildren(...state.actividades.map(crearTarjeta));
    el.count.textContent = String(state.actividades.length);
    el.empty.hidden = state.actividades.length > 0;
    el.list.hidden = state.actividades.length === 0;
  }

  /* ---------- Nombre del horario y continuar ---------- */
  function mostrarErrorNombreHorario(mensaje) {
    el.scheduleNameError.textContent = mensaje;
    el.scheduleNameError.hidden = false;
    el.scheduleName.classList.add("invalid");
  }

  function limpiarErrorNombreHorario() {
    el.scheduleNameError.hidden = true;
    el.scheduleNameError.textContent = "";
    el.scheduleName.classList.remove("invalid");
  }

  function mostrarEstadoContinuar(tipo, mensajes) {
    el.continueStatus.replaceChildren();
    mensajes.forEach((m) => el.continueStatus.appendChild(crearElemento("p", "", m)));
    el.continueStatus.className = `status-box ${tipo}`;
    el.continueStatus.hidden = false;
  }

  function limpiarEstadoContinuar() {
    el.continueStatus.hidden = true;
    el.continueStatus.replaceChildren();
  }

  function continuar() {
    const nombre = el.scheduleName.value.trim();
    const problemas = [];

    limpiarErrorNombreHorario();

    if (!nombre) {
      mostrarErrorNombreHorario("Escribí un nombre para tu horario.");
      problemas.push("Falta el nombre del horario.");
    }
    if (state.actividades.length === 0) {
      problemas.push("Agregá al menos una actividad para continuar.");
    }

    if (problemas.length > 0) {
      mostrarEstadoContinuar("error", problemas);
      if (!nombre) el.scheduleName.focus();
      return;
    }

    if (conflictosActuales.length > 0) {
      const n = conflictosActuales.length;
      mostrarEstadoContinuar("error", [
        `Hay ${n} ${n === 1 ? "superposición" : "superposiciones"} entre actividades. Resolvela${n === 1 ? "" : "s"} para generar la tabla semanal.`
      ]);
      el.conflictPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    limpiarEstadoContinuar();
    TG.mostrar(nombre, state.actividades);
    showView("schedule");
  }

  /* ---------- Inicialización ---------- */
  function init() {
    construirPaleta();
    reiniciarFormulario();
    renderActividades();

    el.scheduleName.addEventListener("input", () => {
      limpiarErrorNombreHorario();
      limpiarEstadoContinuar();
    });
    el.activityName.addEventListener("input", () => el.activityName.classList.remove("invalid"));
    el.form.addEventListener("submit", guardarActividad);
    el.addShift.addEventListener("click", agregarTurno);
    el.cancel.addEventListener("click", cancelarEdicion);
    el.continueBtn.addEventListener("click", continuar);
  }

  init();
})();
