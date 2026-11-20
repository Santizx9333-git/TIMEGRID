// TIMEGRID — Etapa 4: vista "Mis horarios"
// Lista los horarios guardados y ofrece abrir, editar, duplicar, exportar y eliminar.
(() => {
  "use strict";

  const S = window.TimeGridSchedule;
  const Store = window.TimeGridStorage;
  const $ = (id) => document.getElementById(id);

  let pendingDeleteId = null;
  let deleteTimer = null;

  /* ---------- Utilidades ---------- */
  function crear(tag, className, texto) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (texto !== undefined) node.textContent = texto;
    return node;
  }

  function fechaLegible(iso) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  }

  function pluralizar(n, singular, plural) {
    return `${n} ${n === 1 ? singular : plural}`;
  }

  function avisarCambio(detalle) {
    document.dispatchEvent(new CustomEvent(S.EVENTO_CAMBIOS, { detail: detalle }));
  }

  // Abrir o editar reemplaza lo que haya en el constructor: se protege un borrador sin guardar.
  function confirmarReemplazo() {
    if (!window.TimeGridBuilder.hayBorradorSinGuardar()) return true;
    return window.confirm("Tenés un horario sin guardar en el constructor. Si continuás, se va a reemplazar. ¿Continuar?");
  }

  /* ---------- Acciones ---------- */
  function abrir(id) {
    const horario = Store.obtener(id);
    if (!horario || !confirmarReemplazo()) return;

    if (S.detectarConflictos(horario.actividades).length > 0) {
      window.TimeGridBuilder.cargar(horario);
      showToast("Este horario tiene superposiciones. Se abrió en el constructor para resolverlas.");
      return;
    }
    window.TimeGridBuilder.cargar(horario, { irAlConstructor: false });
    S.mostrar(horario);
    showView("schedule");
  }

  function editar(id) {
    const horario = Store.obtener(id);
    if (!horario || !confirmarReemplazo()) return;
    window.TimeGridBuilder.cargar(horario);
  }

  function duplicar(id) {
    const resultado = Store.duplicar(id);
    if (!resultado.ok) {
      showToast(resultado.error);
      return;
    }
    avisarCambio({ origen: "library", horario: resultado.horario });
    showToast(`Se creó "${resultado.horario.nombre}".`);
  }

  function exportar(id, formato) {
    const horario = Store.obtener(id);
    if (!horario) return;
    if (formato === "png") window.TimeGridExport.exportarPNG(horario);
    else window.TimeGridExport.exportarPDF(horario);
  }

  // El primer clic pide confirmación; el segundo elimina.
  function pedirEliminar(id) {
    if (pendingDeleteId === id) {
      const horario = Store.obtener(id);
      const resultado = Store.eliminar(id);
      pendingDeleteId = null;
      window.clearTimeout(deleteTimer);
      if (!resultado.ok) {
        showToast(resultado.error);
        render();
        return;
      }
      avisarCambio({ origen: "library", eliminadoId: id });
      if (horario) showToast(`Horario "${horario.nombre}" eliminado.`);
      return;
    }
    pendingDeleteId = id;
    render();
    window.clearTimeout(deleteTimer);
    deleteTimer = window.setTimeout(() => {
      pendingDeleteId = null;
      render();
    }, 3500);
  }

  /* ---------- Render ---------- */
  function crearBoton(clase, texto, etiqueta, accion) {
    const boton = crear("button", clase, texto);
    boton.type = "button";
    boton.setAttribute("aria-label", etiqueta);
    boton.addEventListener("click", accion);
    return boton;
  }

  function crearTarjeta(horario) {
    const resumen = S.calcularResumen(horario.actividades);
    const card = crear("article", "saved-card");

    const cuerpo = crear("div", "saved-body");
    cuerpo.append(
      crear("h3", "", horario.nombre),
      crear(
        "p",
        "saved-meta",
        `${pluralizar(resumen.actividades, "actividad", "actividades")} · ${pluralizar(resumen.turnos, "turno", "turnos")} · ${S.formatearDuracion(resumen.minutos)}`
      ),
      crear("p", "saved-date", `Actualizado el ${fechaLegible(horario.actualizado)}`)
    );

    const principales = crear("div", "saved-actions");
    principales.append(
      crearBoton("button button-primary button-small", "Abrir", `Abrir ${horario.nombre}`, () => abrir(horario.id)),
      crearBoton("button button-secondary button-small", "Editar", `Editar ${horario.nombre}`, () => editar(horario.id))
    );

    const confirmando = pendingDeleteId === horario.id;
    const herramientas = crear("div", "saved-tools");
    herramientas.append(
      crearBoton("tool-btn", "Duplicar", `Duplicar ${horario.nombre}`, () => duplicar(horario.id)),
      crearBoton("tool-btn", "↓ PNG", `Exportar ${horario.nombre} como PNG`, () => exportar(horario.id, "png")),
      crearBoton("tool-btn", "↓ PDF", `Exportar ${horario.nombre} como PDF`, () => exportar(horario.id, "pdf")),
      crearBoton(
        `tool-btn danger${confirmando ? " confirming" : ""}`,
        confirmando ? "¿Seguro? Confirmar" : "Eliminar",
        `Eliminar ${horario.nombre}`,
        () => pedirEliminar(horario.id)
      )
    );

    card.append(S.crearMiniatura(horario.actividades), cuerpo, principales, herramientas);
    return card;
  }

  function render() {
    const horarios = Store.listar();
    const cantidad = horarios.length;

    $("saved-count").textContent = String(cantidad);
    $("home-saved-count").textContent = String(cantidad).padStart(2, "0");
    $("saved-empty").hidden = cantidad > 0;
    $("saved-list").hidden = cantidad === 0;
    $("storage-warning").hidden = Store.disponible();
    $("saved-list").replaceChildren(...horarios.map(crearTarjeta));
  }

  function init() {
    render();
    document.addEventListener(S.EVENTO_CAMBIOS, render);

    // Cambios hechos desde otra pestaña del mismo navegador.
    window.addEventListener("storage", (evento) => {
      if (evento.key !== null && evento.key !== "timegrid-schedules") return;
      render();
      avisarCambio({ origen: "storage" });
    });
  }

  init();
})();
