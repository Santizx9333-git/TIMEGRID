// TIMEGRID — Etapa 4: exportación a PNG y PDF
// El horario se dibuja en un canvas con el mismo estilo de la aplicación.
// El PDF se arma a mano (una página con la imagen incrustada), así funciona sin librerías ni conexión.
(() => {
  "use strict";

  const S = window.TimeGridSchedule;

  const FUENTE_DISPLAY = '"Space Grotesk", "Segoe UI", system-ui, sans-serif';
  const FUENTE_TEXTO = '"DM Sans", "Segoe UI", system-ui, sans-serif';
  const C = {
    fondo: "#111318",
    panel: "#191c24",
    panelSuave: "#171a22",
    borde: "#2b303c",
    texto: "#edf0f7",
    suave: "#9299a8",
    tenue: "#687080",
    primario: "#9875ff",
    base: "#1b1e27"
  };

  const ANCHO = 1400;
  const MARGEN = 56;
  const ESCALA = 2; // resolución ×2 para que se vea nítido
  const ALTO_HORA = 74;
  const CHIP_PAD_IZQ = 38; // hasta el inicio del nombre (punto de color incluido)
  const CHIP_PAD_DER = 16;
  const CHIP_SEPARACION = 12;

  /* ---------- Utilidades de dibujo ---------- */
  function rectRedondeado(ctx, x, y, w, h, r) {
    const radio = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.arcTo(x + w, y, x + w, y + h, radio);
    ctx.arcTo(x + w, y + h, x, y + h, radio);
    ctx.arcTo(x, y + h, x, y, radio);
    ctx.arcTo(x, y, x + w, y, radio);
    ctx.closePath();
  }

  function hexARgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Mezcla `cantidad` (0–1) del color A sobre el color B.
  function mezclar(hexA, hexB, cantidad) {
    const a = hexARgb(hexA);
    const b = hexARgb(hexB);
    const canal = (i) => Math.round(a[i] * cantidad + b[i] * (1 - cantidad));
    return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
  }

  function acortar(ctx, texto, anchoMax) {
    if (ctx.measureText(texto).width <= anchoMax) return texto;
    let base = texto;
    while (base.length > 1 && ctx.measureText(`${base}…`).width > anchoMax) base = base.slice(0, -1);
    return `${base.trimEnd()}…`;
  }

  // Parte un texto en líneas que entren en `anchoMax`; la última lleva "…" si sobra texto.
  function envolver(ctx, texto, anchoMax, maxLineas) {
    let lineas = [];
    let actual = "";

    texto.split(/\s+/).filter(Boolean).forEach((palabra) => {
      let resto = palabra;
      while (ctx.measureText(resto).width > anchoMax && resto.length > 1) {
        let corte = resto.length;
        while (corte > 1 && ctx.measureText(resto.slice(0, corte)).width > anchoMax) corte -= 1;
        if (actual) {
          lineas.push(actual);
          actual = "";
        }
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      const prueba = actual ? `${actual} ${resto}` : resto;
      if (ctx.measureText(prueba).width <= anchoMax) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = resto;
      }
    });
    if (actual) lineas.push(actual);

    if (lineas.length > maxLineas) {
      lineas = lineas.slice(0, maxLineas);
      let ultima = lineas[maxLineas - 1];
      while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > anchoMax) ultima = ultima.slice(0, -1);
      lineas[maxLineas - 1] = `${ultima.trimEnd()}…`;
    }
    return lineas;
  }

  async function prepararFuentes() {
    try {
      await Promise.all([
        document.fonts.load(`700 20px ${FUENTE_DISPLAY}`),
        document.fonts.load(`600 14px ${FUENTE_TEXTO}`),
        document.fonts.load(`400 14px ${FUENTE_TEXTO}`)
      ]);
      await document.fonts.ready;
    } catch (error) {
      /* si las fuentes no cargan, se usan las de respaldo */
    }
  }

  /* ---------- Dibujo del horario ---------- */
  function medirLeyenda(medidor, actividades, anchoDisponible) {
    const gap = 12;
    const items = actividades.map((a) => {
      const horas = S.formatearDuracion(S.minutosPorActividad(a));
      medidor.font = `600 15px ${FUENTE_TEXTO}`;
      const anchoNombre = medidor.measureText(a.nombre).width;
      medidor.font = `500 13px ${FUENTE_TEXTO}`;
      const anchoHoras = medidor.measureText(horas).width;
      const ancho = CHIP_PAD_IZQ + anchoNombre + CHIP_SEPARACION + anchoHoras + CHIP_PAD_DER;
      return { actividad: a, horas, ancho: Math.min(Math.ceil(ancho), anchoDisponible) };
    });

    const filas = [];
    let fila = [];
    let usado = 0;
    items.forEach((item) => {
      if (fila.length > 0 && usado + gap + item.ancho > anchoDisponible) {
        filas.push(fila);
        fila = [];
        usado = 0;
      }
      usado += (fila.length > 0 ? gap : 0) + item.ancho;
      fila.push(item);
    });
    if (fila.length > 0) filas.push(fila);
    return { filas, gap };
  }

  function dibujarBloque(ctx, turno, x, y, w, h) {
    const color = turno.actividad.color;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, mezclar(color, C.base, 0.4));
    grad.addColorStop(1, mezclar(color, C.base, 0.2));

    ctx.save();
    rectRedondeado(ctx, x, y, w, h, 9);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = mezclar(color, C.base, 0.5);
    ctx.stroke();

    // Todo lo que sigue queda recortado al bloque (acento y texto).
    rectRedondeado(ctx, x, y, w, h, 9);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, h);

    const padX = 15;
    const anchoTexto = w - padX - 10;
    ctx.textAlign = "left"; // el estado del canvas viene del dibujo anterior
    const minutos = S.duracionTurno(turno);
    const horaTexto = `${turno.inicio} – ${turno.fin}`;
    ctx.textBaseline = "alphabetic";

    if (h < 46) {
      // Bloque bajo: nombre y horario en una sola línea.
      ctx.font = `500 12px ${FUENTE_TEXTO}`;
      const anchoHora = ctx.measureText(horaTexto).width;
      ctx.font = `700 14px ${FUENTE_TEXTO}`;
      ctx.fillStyle = C.texto;
      ctx.fillText(acortar(ctx, turno.actividad.nombre, anchoTexto - anchoHora - 10), x + padX, y + h / 2 + 5);
      ctx.font = `500 12px ${FUENTE_TEXTO}`;
      ctx.fillStyle = "#c8ccd8";
      ctx.textAlign = "right";
      ctx.fillText(horaTexto, x + w - 10, y + h / 2 + 4);
    } else {
      ctx.font = `700 15px ${FUENTE_TEXTO}`;
      const maxLineas = h >= 88 ? 3 : h >= 64 ? 2 : 1;
      const lineas = envolver(ctx, turno.actividad.nombre, anchoTexto, maxLineas);
      ctx.fillStyle = C.texto;
      let cursor = y + 21;
      lineas.forEach((linea) => {
        ctx.fillText(linea, x + padX, cursor);
        cursor += 19;
      });
      ctx.font = `500 12px ${FUENTE_TEXTO}`;
      ctx.fillStyle = "#c8ccd8";
      ctx.fillText(horaTexto, x + padX, cursor - 2);

      if (h >= 70) {
        ctx.font = `600 11px ${FUENTE_TEXTO}`;
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.textAlign = "right";
        ctx.fillText(S.formatearDuracion(minutos), x + w - 10, y + h - 10);
      }
    }
    ctx.restore();
  }

  async function dibujarHorario(horario) {
    await prepararFuentes();

    const { turnos, dias, inicioTabla, horas } = S.calcularEstructura(horario.actividades);
    const resumen = S.calcularResumen(horario.actividades);
    const medidor = document.createElement("canvas").getContext("2d");

    // --- Medidas ---
    const anchoPanel = ANCHO - MARGEN * 2;
    const padPanel = 28;
    const altoCabecera = 48;
    const holgura = 14; // espacio sobre la primera hora
    const altoCuerpo = holgura + horas * ALTO_HORA + 1;
    const altoPanel = padPanel + altoCabecera + altoCuerpo + padPanel;
    const topPanel = MARGEN + 142;
    const leyenda = medirLeyenda(medidor, horario.actividades, anchoPanel);
    const altoChip = 42;
    const topLeyenda = topPanel + altoPanel + 38;
    const altoLeyenda = 28 + leyenda.filas.length * altoChip + (leyenda.filas.length - 1) * 12;
    const alto = Math.ceil(topLeyenda + altoLeyenda + 54 + MARGEN / 2);

    const canvas = document.createElement("canvas");
    canvas.width = ANCHO * ESCALA;
    canvas.height = alto * ESCALA;
    const ctx = canvas.getContext("2d");
    ctx.scale(ESCALA, ESCALA);
    ctx.textBaseline = "alphabetic";

    // --- Fondo ---
    ctx.fillStyle = C.fondo;
    ctx.fillRect(0, 0, ANCHO, alto);
    const brillo = ctx.createRadialGradient(ANCHO - 120, 40, 20, ANCHO - 120, 40, 620);
    brillo.addColorStop(0, "rgba(152,117,255,.16)");
    brillo.addColorStop(1, "rgba(152,117,255,0)");
    ctx.fillStyle = brillo;
    ctx.fillRect(0, 0, ANCHO, alto);

    // --- Cabecera ---
    ctx.textAlign = "left";
    ctx.font = `700 24px ${FUENTE_DISPLAY}`;
    ctx.fillStyle = C.texto;
    ctx.fillText("TIME", MARGEN, MARGEN + 12);
    const anchoTime = ctx.measureText("TIME").width;
    ctx.fillStyle = C.primario;
    ctx.fillText("GRID", MARGEN + anchoTime, MARGEN + 12);

    ctx.font = `500 14px ${FUENTE_TEXTO}`;
    ctx.fillStyle = C.tenue;
    ctx.textAlign = "right";
    const fecha = new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    ctx.fillText(`Exportado el ${fecha}`, ANCHO - MARGEN, MARGEN + 10);

    ctx.textAlign = "left";
    ctx.font = `700 46px ${FUENTE_DISPLAY}`;
    ctx.fillStyle = C.texto;
    ctx.fillText(acortar(ctx, horario.nombre, anchoPanel), MARGEN, MARGEN + 78);

    ctx.font = `500 17px ${FUENTE_TEXTO}`;
    ctx.fillStyle = C.suave;
    const textoResumen = `${resumen.actividades} ${resumen.actividades === 1 ? "actividad" : "actividades"} · ${resumen.turnos} ${resumen.turnos === 1 ? "turno" : "turnos"} · ${S.formatearDuracion(resumen.minutos)} por semana`;
    ctx.fillText(textoResumen, MARGEN, MARGEN + 108);

    // --- Panel de la tabla ---
    rectRedondeado(ctx, MARGEN, topPanel, anchoPanel, altoPanel, 18);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.borde;
    ctx.lineWidth = 1;
    ctx.stroke();

    const x0 = MARGEN + padPanel;
    const anchoHoras = 64;
    const xCols = x0 + anchoHoras;
    const anchoCol = (anchoPanel - padPanel * 2 - anchoHoras) / dias.length;
    const yCabecera = topPanel + padPanel;
    const yCuerpo = yCabecera + altoCabecera + holgura; // y de la primera línea horaria
    const yFin = yCuerpo + horas * ALTO_HORA;

    // Encabezados de días
    ctx.textAlign = "center";
    ctx.font = `700 15px ${FUENTE_TEXTO}`;
    ctx.fillStyle = "#c9ced9";
    dias.forEach((dia, i) => ctx.fillText(dia.label, xCols + anchoCol * i + anchoCol / 2, yCabecera + 26));

    // Líneas horarias, medias horas y etiquetas
    ctx.lineWidth = 1;
    for (let i = 0; i <= horas; i += 1) {
      const y = Math.round(yCuerpo + i * ALTO_HORA) + 0.5;
      ctx.strokeStyle = C.borde;
      ctx.beginPath();
      ctx.moveTo(xCols, y);
      ctx.lineTo(xCols + anchoCol * dias.length, y);
      ctx.stroke();

      if (i < horas) {
        const yMedia = Math.round(yCuerpo + (i + 0.5) * ALTO_HORA) + 0.5;
        ctx.strokeStyle = "rgba(255,255,255,.04)";
        ctx.beginPath();
        ctx.moveTo(xCols, yMedia);
        ctx.lineTo(xCols + anchoCol * dias.length, yMedia);
        ctx.stroke();
      }

      ctx.font = `500 12px ${FUENTE_TEXTO}`;
      ctx.fillStyle = C.tenue;
      ctx.textAlign = "right";
      ctx.fillText(S.aHHMM(inicioTabla + i * 60), xCols - 14, y + 4);
    }

    // Separadores verticales
    ctx.strokeStyle = C.borde;
    for (let i = 0; i <= dias.length; i += 1) {
      const x = Math.round(xCols + anchoCol * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, yCuerpo);
      ctx.lineTo(x, yFin);
      ctx.stroke();
    }

    // Bloques
    turnos.forEach((turno) => {
      const columna = dias.findIndex((d) => d.value === turno.dia);
      const x = xCols + anchoCol * columna + 5;
      const y = yCuerpo + ((S.aMinutos(turno.inicio) - inicioTabla) / 60) * ALTO_HORA + 1.5;
      const h = (S.duracionTurno(turno) / 60) * ALTO_HORA - 3;
      dibujarBloque(ctx, turno, x, y, anchoCol - 10, h);
    });

    // --- Leyenda ---
    ctx.textAlign = "left";
    ctx.font = `700 18px ${FUENTE_DISPLAY}`;
    ctx.fillStyle = C.texto;
    ctx.fillText("Actividades", MARGEN, topLeyenda);

    let yFila = topLeyenda + 18;
    leyenda.filas.forEach((fila) => {
      let x = MARGEN;
      fila.forEach(({ actividad, horas: duracion, ancho }) => {
        rectRedondeado(ctx, x, yFila, ancho, altoChip, 11);
        ctx.fillStyle = C.panelSuave;
        ctx.fill();
        ctx.strokeStyle = C.borde;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + 22, yFila + altoChip / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = actividad.color;
        ctx.fill();

        ctx.textAlign = "right";
        ctx.font = `500 13px ${FUENTE_TEXTO}`;
        ctx.fillStyle = C.suave;
        ctx.fillText(duracion, x + ancho - 16, yFila + altoChip / 2 + 5);
        const anchoDuracion = ctx.measureText(duracion).width;

        ctx.textAlign = "left";
        ctx.font = `600 15px ${FUENTE_TEXTO}`;
        ctx.fillStyle = C.texto;
        ctx.fillText(acortar(ctx, actividad.nombre, ancho - CHIP_PAD_IZQ - CHIP_PAD_DER - CHIP_SEPARACION - anchoDuracion), x + 38, yFila + altoChip / 2 + 5);

        x += ancho + leyenda.gap;
      });
      yFila += altoChip + 12;
    });

    // --- Pie ---
    ctx.textAlign = "center";
    ctx.font = `500 13px ${FUENTE_TEXTO}`;
    ctx.fillStyle = C.tenue;
    ctx.fillText("Creado con TIMEGRID · Diseñado para organizar mejor tu tiempo", ANCHO / 2, alto - 26);

    return canvas;
  }

  /* ---------- Descarga ---------- */
  function nombreDeArchivo(nombre, extension) {
    const base = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `timegrid-${base || "horario"}.${extension}`;
  }

  function descargar(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function canvasABlob(canvas, tipo, calidad) {
    return new Promise((resolver, rechazar) => {
      canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo generar la imagen."))), tipo, calidad);
    });
  }

  /* ---------- PDF (una página, imagen JPEG incrustada) ---------- */
  function construirPDF(jpeg, anchoImg, altoImg) {
    const A4 = { corto: 595.28, largo: 841.89 };
    const horizontal = anchoImg >= altoImg;
    const pw = horizontal ? A4.largo : A4.corto;
    const ph = horizontal ? A4.corto : A4.largo;
    const margen = 18;
    const factor = Math.min((pw - margen * 2) / anchoImg, (ph - margen * 2) / altoImg);
    const dw = anchoImg * factor;
    const dh = altoImg * factor;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;
    const f = (n) => n.toFixed(2);

    const codificador = new TextEncoder();
    const trozos = [];
    const offsets = [];
    let posicion = 0;
    const agregar = (dato) => {
      const bytes = typeof dato === "string" ? codificador.encode(dato) : dato;
      trozos.push(bytes);
      posicion += bytes.length;
    };
    const objeto = (numero, cuerpo) => {
      offsets[numero] = posicion;
      agregar(`${numero} 0 obj\n${cuerpo}\nendobj\n`);
    };

    agregar("%PDF-1.4\n");
    agregar(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    objeto(1, "<< /Type /Catalog /Pages 2 0 R >>");
    objeto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);

    offsets[4] = posicion;
    agregar(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${anchoImg} /Height ${altoImg} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    agregar(jpeg);
    agregar("\nendstream\nendobj\n");

    // Fondo del mismo color que la imagen (#111318) y luego la imagen centrada.
    const contenido = `0.067 0.075 0.094 rg 0 0 ${f(pw)} ${f(ph)} re f q ${f(dw)} 0 0 ${f(dh)} ${f(x)} ${f(y)} cm /Im0 Do Q`;
    objeto(5, `<< /Length ${codificador.encode(contenido).length} >>\nstream\n${contenido}\nendstream`);

    const inicioXref = posicion;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let n = 1; n <= 5; n += 1) xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
    agregar(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

    return new Blob(trozos, { type: "application/pdf" });
  }

  /* ---------- API pública ---------- */
  async function exportarPNG(horario) {
    try {
      const canvas = await dibujarHorario(horario);
      descargar(await canvasABlob(canvas, "image/png"), nombreDeArchivo(horario.nombre, "png"));
      showToast("Imagen PNG descargada.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo exportar la imagen. Probá de nuevo.");
    }
  }

  async function exportarPDF(horario) {
    try {
      const canvas = await dibujarHorario(horario);
      const jpeg = new Uint8Array(await (await canvasABlob(canvas, "image/jpeg", 0.93)).arrayBuffer());
      descargar(construirPDF(jpeg, canvas.width, canvas.height), nombreDeArchivo(horario.nombre, "pdf"));
      showToast("PDF descargado.");
    } catch (error) {
      console.error(error);
      showToast("No se pudo exportar el PDF. Probá de nuevo.");
    }
  }

  window.TimeGridExport = { exportarPNG, exportarPDF };
})();
