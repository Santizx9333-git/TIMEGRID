# TIMEGRID — Implementación de la Etapa 2: Constructor de actividades

Actúa como un desarrollador frontend experimentado. Necesito que continúes el desarrollo de un proyecto llamado **TIMEGRID**, un generador universal de horarios semanales.

## 1. Contexto del proyecto

TIMEGRID permite crear horarios para diferentes ámbitos: universidad, trabajo, rutinas personales, actividades deportivas, etc.

El proyecto ya cuenta con una **Etapa 1 completada**, que incluye:
- Interfaz visual inicial.
- Diseño oscuro, moderno y minimalista.
- Navegación entre Inicio, Crear horario y Mis horarios.
- Estructura básica del constructor.
- Diseño responsive.

Tecnologías utilizadas:
- HTML5
- CSS3
- JavaScript puro (Vanilla JS)
- LocalStorage en etapas posteriores.

No utilizar frameworks ni dependencias innecesarias.

## 2. Estructura actual

Respetar la estructura existente:

TIMEGRID/
- index.html
- css/
  - styles.css
  - home.css
  - builder.css
  - schedule.css
- js/
  - app.js
  - builder.js
  - schedule.js
  - storage.js
  - export.js
- assets/

Antes de modificar cualquier archivo, inspeccionar el proyecto existente. No reemplazar ni eliminar funcionalidades que ya funcionan.

Si algún archivo todavía no existe, crearlo únicamente si es necesario y respetando la organización del proyecto.

## 3. Objetivo de esta etapa

Implementar un constructor funcional que permita configurar un horario y cargar las actividades que lo componen.

### A. Datos generales del horario
- Campo para introducir el nombre del horario.
- Validar que el nombre no esté vacío.
- Conservar el nombre mientras se trabaja en el constructor.

### B. Gestión de actividades (CRUD)

Permitir:

- Crear actividades.
- Visualizar las actividades cargadas.
- Editar actividades existentes.
- Eliminar actividades.

Cada actividad debe contener:
- Nombre.
- Color identificador.
- Uno o varios turnos.

Ejemplo de estructura de una actividad:

```js
{
  id: "identificador-unico",
  nombre: "Programación",
  color: "#9875FF",
  turnos: [
    {
      dia: "martes",
      inicio: "18:00",
      fin: "20:00"
    },
    {
      dia: "jueves",
      inicio: "16:00",
      fin: "18:00"
    }
  ]
}
```

Utilizar identificadores únicos para evitar confusiones al editar o eliminar actividades.

### C. Selector de colores

Cada actividad debe poder identificarse mediante un color.

Ofrecer una paleta inicial:
- Violeta: #9875FF
- Azul: #428BD7
- Verde: #37B88B
- Naranja: #D99143
- Rosa: #E46D9A
- Celeste: #4FB6C6

El color seleccionado debe mostrarse claramente y conservarse al editar la actividad.

### D. Gestión de turnos

Cada actividad debe admitir múltiples turnos.

Para cada turno, permitir seleccionar:
- Día de la semana.
- Hora de inicio.
- Hora de finalización.

Los días disponibles son:
- Lunes
- Martes
- Miércoles
- Jueves
- Viernes
- Sábado
- Domingo

Incluir:
- Botón para agregar otro turno.
- Botón para eliminar un turno individual.
- Contador de turnos cargados.
- Al editar una actividad, mostrar todos sus turnos existentes.

Una actividad debe tener al menos un turno para poder guardarse.

### E. Validaciones

Implementar las siguientes validaciones:

1. El nombre de la actividad no puede estar vacío.
2. Debe existir al menos un turno.
3. Todos los turnos deben tener día, hora de inicio y hora de finalización.
4. La hora de inicio debe ser anterior a la hora de finalización.
5. No permitir turnos exactamente duplicados dentro de una misma actividad.
6. No permitir guardar actividades con datos incompletos.

Mostrar mensajes de error claros y específicos. No utilizar únicamente alertas del navegador.

**Importante:** en esta etapa solo se controlan duplicados exactos dentro de una actividad. La detección de superposición entre actividades diferentes queda para la Etapa 3.

### F. Listado de actividades

Debajo del formulario debe existir una sección que muestre las actividades cargadas.

Cada tarjeta debe mostrar:
- Nombre de la actividad.
- Color identificador.
- Cantidad de turnos.
- Días y horarios de cada turno.
- Botón Editar.
- Botón Eliminar.

Si todavía no hay actividades, mostrar un mensaje indicando que el usuario debe agregar su primera actividad.

### G. Edición de actividades

Al presionar Editar:
- Cargar los datos de la actividad en el formulario.
- Mostrar su color actual.
- Mostrar todos sus turnos.
- Cambiar el botón de guardar por uno que indique que se está actualizando.
- Permitir cancelar la edición.

Al actualizar, modificar la actividad existente en lugar de crear una nueva.

### H. Continuar con el horario

Incluir un botón para continuar.

Antes de permitir avanzar, comprobar:
- Que el horario tenga un nombre.
- Que exista al menos una actividad cargada.

Por ahora, al continuar, mostrar un mensaje indicando que la generación de la tabla semanal se implementará en la Etapa 3.

No implementar todavía la tabla semanal.

## 4. Diseño visual

Mantener la identidad visual de TIMEGRID:

- Fondo principal: #111318.
- Paneles: #1B1E27.
- Violeta principal: #8B5CF6.
- Violeta secundario: #9875FF.
- Texto principal: #E5E7EB.
- Estética oscura, moderna, minimalista y ordenada.
- Bordes suaves y esquinas redondeadas.
- Buena separación entre formularios y tarjetas.
- Diseño responsive para computadoras y celulares.

No rediseñar toda la aplicación. El constructor debe integrarse visualmente con la Etapa 1.

## 5. Organización del JavaScript

Separar las responsabilidades de forma clara.

- `app.js`: navegación general y funcionalidades globales.
- `builder.js`: formulario, actividades, turnos, validaciones y renderizado.
- `storage.js`: no implementar persistencia definitiva todavía.

Evitar concentrar toda la lógica en un único archivo.

Utilizar funciones pequeñas y nombres descriptivos. Evitar código repetido.

Manipular los elementos del DOM de manera segura. No insertar datos introducidos por el usuario mediante `innerHTML`.

## 6. Restricciones importantes

Esta es únicamente la Etapa 2.

NO implementar todavía:
- Generación de la tabla semanal.
- Detección de conflictos entre actividades diferentes.
- Guardado definitivo de horarios en LocalStorage.
- Edición de horarios ya guardados.
- Duplicación de horarios.
- Exportación PNG.
- Exportación PDF.

Esas funciones corresponden a las etapas posteriores.

Los datos de las actividades pueden mantenerse temporalmente en memoria mientras el usuario utiliza el constructor.

## 7. Resultado esperado

Al finalizar, quiero poder:

1. Entrar a Crear horario.
2. Escribir el nombre de mi horario.
3. Crear una actividad.
4. Elegir su color.
5. Agregar uno o varios turnos.
6. Guardar la actividad.
7. Verla en el listado.
8. Editarla.
9. Eliminarla.
10. Crear otras actividades.
11. Continuar cuando el horario tenga nombre y al menos una actividad.

El resultado debe ser completamente funcional, no solamente una maqueta visual.

## 8. Entrega

- Modificar los archivos necesarios.
- Mantener intactas las funcionalidades de la Etapa 1.
- Entregar el código completo y organizado.
- Indicar qué archivos fueron creados o modificados.
- Explicar brevemente cómo probar cada funcionalidad.
- Comprobar que no existan errores en la consola del navegador.

Prioriza la funcionalidad, la claridad del código y la integración con el proyecto existente. No avances a la Etapa 3.