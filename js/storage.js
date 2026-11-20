// TIMEGRID — Etapa 4: persistencia en LocalStorage
// Solo guarda y lee datos. No toca el DOM.
// Forma de un horario: { id, nombre, actividades: [{ id, nombre, color, turnos: [{ dia, inicio, fin }] }], creado, actualizado }
(() => {
  "use strict";

  const CLAVE = "timegrid-schedules";
  const CLAVE_RESPALDO = "timegrid-schedules-corrupt";
  const COLOR_POR_DEFECTO = "#9875FF";
  const MAX_NOMBRE_HORARIO = 45;

  const { DIA_ORDEN } = window.TimeGridSchedule;
  const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  const REGEX_COLOR = /^#[0-9a-f]{6}$/i;

  /* ---------- Utilidades ---------- */
  function crearId(prefijo) {
    return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function fechaValida(valor) {
    return typeof valor === "string" && !Number.isNaN(Date.parse(valor));
  }

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  /* ---------- Validación de lo que viene del almacenamiento ---------- */
  // El contenido de LocalStorage puede estar editado o dañado: nunca se confía en él.
  function sanitizarTurno(turno) {
    if (!turno || typeof turno !== "object") return null;
    if (!(turno.dia in DIA_ORDEN)) return null;
    if (!REGEX_HORA.test(turno.inicio) || !REGEX_HORA.test(turno.fin)) return null;
    if (turno.inicio >= turno.fin) return null;
    return { dia: turno.dia, inicio: turno.inicio, fin: turno.fin };
  }

  function sanitizarActividad(actividad) {
    if (!actividad || typeof actividad !== "object") return null;
    const nombre = typeof actividad.nombre === "string" ? actividad.nombre.trim() : "";
    if (!nombre) return null;

    const turnos = (Array.isArray(actividad.turnos) ? actividad.turnos : [])
      .map(sanitizarTurno)
      .filter(Boolean);
    if (turnos.length === 0) return null;

    return {
      id: typeof actividad.id === "string" && actividad.id ? actividad.id : crearId("act"),
      nombre,
      color: REGEX_COLOR.test(actividad.color) ? actividad.color : COLOR_POR_DEFECTO,
      turnos
    };
  }

  function sanitizarHorario(horario) {
    if (!horario || typeof horario !== "object") return null;

    const actividades = (Array.isArray(horario.actividades) ? horario.actividades : [])
      .map(sanitizarActividad)
      .filter(Boolean);
    if (actividades.length === 0) return null;

    const nombre = typeof horario.nombre === "string" ? horario.nombre.trim() : "";
    const ahora = new Date().toISOString();

    return {
      id: typeof horario.id === "string" && horario.id ? horario.id : crearId("hor"),
      nombre: (nombre || "Horario sin nombre").slice(0, MAX_NOMBRE_HORARIO),
      actividades,
      creado: fechaValida(horario.creado) ? horario.creado : ahora,
      actualizado: fechaValida(horario.actualizado) ? horario.actualizado : ahora
    };
  }

  /* ---------- Lectura y escritura ---------- */
  function disponible() {
    try {
      const prueba = "__timegrid_test__";
      window.localStorage.setItem(prueba, prueba);
      window.localStorage.removeItem(prueba);
      return true;
    } catch (error) {
      return false;
    }
  }

  function leerTodos() {
    let crudo = null;
    try {
      crudo = window.localStorage.getItem(CLAVE);
    } catch (error) {
      return [];
    }
    if (!crudo) return [];

    try {
      const datos = JSON.parse(crudo);
      if (!Array.isArray(datos)) throw new Error("Formato inesperado");

      // Cada horario necesita un id estable y único. Si falta o se repite, se repara y se guarda una vez.
      const ids = new Set();
      let reparado = false;
      const lista = [];
      datos.forEach((crudoHorario) => {
        const horario = sanitizarHorario(crudoHorario);
        if (!horario) return;
        const tieneId = Boolean(crudoHorario) && typeof crudoHorario.id === "string" && crudoHorario.id !== "";
        if (!tieneId || ids.has(horario.id)) {
          horario.id = crearId("hor");
          reparado = true;
        }
        ids.add(horario.id);
        lista.push(horario);
      });
      if (reparado) escribirTodos(lista);
      return lista;
    } catch (error) {
      // Datos ilegibles: se guarda una copia para no perderlos y se arranca limpio.
      try {
        window.localStorage.setItem(CLAVE_RESPALDO, crudo);
      } catch (ignorado) {
        /* sin espacio para el respaldo: se continúa igual */
      }
      return [];
    }
  }

  function escribirTodos(lista) {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(lista));
      return { ok: true };
    } catch (error) {
      const sinEspacio = error && (error.name === "QuotaExceededError" || error.code === 22);
      return {
        ok: false,
        error: sinEspacio
          ? "No hay espacio disponible en el navegador para guardar el horario."
          : "Tu navegador no permite guardar datos locales (¿modo privado o bloqueado?)."
      };
    }
  }

  /* ---------- API pública ---------- */
  function listar() {
    return leerTodos().sort((a, b) => Date.parse(b.actualizado) - Date.parse(a.actualizado));
  }

  function obtener(id) {
    const encontrado = leerTodos().find((h) => h.id === id);
    return encontrado ? clonar(encontrado) : null;
  }

  // Crea o actualiza. Si el id no existe (por ejemplo, el horario fue borrado), crea uno nuevo.
  function guardar(datos) {
    const lista = leerTodos();
    const ahora = new Date().toISOString();
    const indice = datos.id ? lista.findIndex((h) => h.id === datos.id) : -1;
    const previo = indice >= 0 ? lista[indice] : null;

    const candidato = sanitizarHorario({
      id: previo ? previo.id : crearId("hor"),
      nombre: datos.nombre,
      actividades: datos.actividades,
      creado: previo ? previo.creado : ahora,
      actualizado: ahora
    });
    if (!candidato) return { ok: false, error: "El horario no tiene actividades válidas para guardar." };

    if (previo) lista[indice] = candidato;
    else lista.push(candidato);

    const resultado = escribirTodos(lista);
    return resultado.ok ? { ok: true, horario: clonar(candidato), nuevo: !previo } : resultado;
  }

  function duplicar(id) {
    const lista = leerTodos();
    const original = lista.find((h) => h.id === id);
    if (!original) return { ok: false, error: "No se encontró el horario a duplicar." };

    const ahora = new Date().toISOString();
    const sufijo = " (copia)";
    const copia = sanitizarHorario({
      ...clonar(original),
      id: crearId("hor"),
      nombre: `${original.nombre.slice(0, MAX_NOMBRE_HORARIO - sufijo.length)}${sufijo}`,
      creado: ahora,
      actualizado: ahora
    });

    lista.push(copia);
    const resultado = escribirTodos(lista);
    return resultado.ok ? { ok: true, horario: clonar(copia) } : resultado;
  }

  function eliminar(id) {
    const lista = leerTodos();
    const restantes = lista.filter((h) => h.id !== id);
    if (restantes.length === lista.length) return { ok: false, error: "No se encontró el horario." };
    return escribirTodos(restantes);
  }

  function contar() {
    return leerTodos().length;
  }

  window.TimeGridStorage = { disponible, listar, obtener, guardar, duplicar, eliminar, contar };
})();
