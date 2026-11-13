# Manual de Usuario — Sistema de Gestión de Horarios Escolares (Dirección y UTP)

Bienvenido(a) al **Sistema de Gestión de Horarios Escolares**. Esta plataforma permite planificar los horarios de **1º a 8º Básico**, controlar las horas de cada asignatura y docente (proporción 65/35, horas SEP y PIE) y **bloquear automáticamente cualquier topón de horario**.

---

## 1. Cómo Asignar, Mover o Intercambiar Clases en un Curso
En la primera pestaña **`🗓️ Horario por Curso (1º a 8º)`**:

1. **Seleccionar el Curso**: Haz clic sobre los botones rápidos (`1º`, `2º`, `3º`, ..., `8º`) en la esquina superior izquierda.
2. **Asignar una clase**:
   - **Opción A (Con clic)**: Haz clic sobre una asignatura de la columna izquierda (ej. *Matemática*) y luego haz clic sobre el bloque libre del calendario donde deseas ubicarla.
   - **Opción B (Arrastrar)**: Arrastra la asignatura desde la lista izquierda y suéltala sobre el bloque del calendario.
   - **Opción C (Clic directo en celda)**: Si no tienes ninguna asignatura seleccionada a la izquierda, haz clic sobre cualquier celda del calendario y se abrirá una ventana mostrando solo las asignaturas disponibles en esa hora.
3. **Intercambiar dos clases de hora (Enroque rápido)**:
   - Si deseas cambiar una clase ya asignada por otra dentro del mismo curso, simplemente **arrastra el bloque del calendario y suéltalo encima del otro bloque**. El sistema verificará automáticamente que ninguno de los dos profesores tenga topón y hará el intercambio en un solo paso.
4. **Quitar una clase**:
   - Pasa el mouse sobre el bloque asignado y haz clic en el botón **`✕`** (arriba a la derecha de la celda), o activa el botón **`🧹 Modo Borrador`** y haz clic sobre los bloques que quieras liberar.
5. **Deshacer un error (`↩️ Deshacer`)**:
   - Si borraste o cambiaste algo por error, presiona el botón **`↩️ Deshacer`** en la barra superior para volver inmediatamente al estado anterior.

---

## 2. Cómo Evita el Sistema los Topones y el Exceso de Horas

- **Bloqueo automático de Topones (`⛔ Topón`)**: Cuando seleccionas una asignatura a la izquierda, el calendario marca inmediatamente en **color rojo** todos los bloques donde ese profesor **ya está haciendo clases en otro curso a esa misma hora** (indicando en qué curso y asignatura se encuentra ocupado).
- **Control exacto del Plan de Estudio**: Cada asignatura tiene un contador de horas asignadas vs. horas requeridas (ej. `6 / 6h`). Al llegar al tope de horas del plan de estudio, el sistema marca la asignatura en verde y evita asignar horas de más por error.
- **Indicador superior**: En la barra superior siempre verás el indicador **`🟢 0 Topones detectados`** confirmando que ningún docente está duplicado en la misma hora.

---

## 3. Cómo Usar el Nuevo "Panorama General (Todos los Cursos)"
En la segunda pestaña **`📊 Panorama General (Todos los Cursos)`**:

1. **Tarjetas Superiores de Avance (`1º` a `8º`)**: Muestran el porcentaje de completitud (`38 / 38 hrs`) de cada curso. Al hacer clic en cualquiera de ellas, te lleva directamente al horario de ese curso.
2. **Vista Comparativa por Día (`Lunes` a `Viernes`)**:
   - Muestra los **8 cursos en columnas paralelas** para el día seleccionado.
   - En cada bloque se visualiza claramente la **Asignatura y el Profesor con su sigla y color**, además de la columna final **`✅ Sin topón`**.
   - **Edición directa**: Puedes hacer clic sobre cualquier celda de esta vista para modificar o asignar la clase sin salir de la pantalla.
3. **Vista `📅 Semana Compacta`**:
   - Muestra los 38 bloques semanales de todos los cursos en una sola tabla unificada (Sigla de la Asignatura arriba y Sigla del Profesor abajo).
4. **Filtro `🔍 Destacar Profesor`**:
   - En la esquina superior derecha del Panorama General, selecciona a cualquier profesor de la lista para **iluminar todos los bloques donde hace clases** en todos los cursos y días.

---

## 4. Cómo Restaurar Todo el Horario o Armar un Año Nuevo desde Cero

### A. Volver al Horario Oficial Predeterminado (`🔄 Restaurar Base`)
Si hiciste pruebas o cambios y quieres recuperar el horario base original del colegio:
1. En la barra superior derecha, haz clic en el botón **`🔄 Restaurar Base`**.
2. Confirma el mensaje en pantalla y todo el horario volverá a su estado original.

### B. Armar el Horario desde Cero (Vaciar Calendarios o Cambiar a Año 2027)
Tienes dos formas de iniciar un horario limpio desde cero:
1. **Usando el Selector de Año Escolar (`2026` / `2027`)** en la barra superior:
   - Al elegir **`2027 (Desde cero)`**, tendrás una plantilla completamente limpia (`0 / 38 hrs`) con todos los cursos, bloques y planes listos para rellenar, **sin perder ni alterar el horario guardado en `2026`**.
2. **Vaciando los horarios actuales**:
   - En la primera pestaña (`🗓️ Horario por Curso`), en el recuadro inferior izquierdo (*3. Acciones Rápidas*), haz clic en **`🗑️ Vaciar Todos los Cursos (Armar desde cero)`**.
   - Esto limpiará todas las celdas del calendario pero **mantendrá intactos tus cursos, bloques horarios, profesores y planes de estudio**.
3. **Autocompletar automáticamente (`🪄` / `🚀`)**:
   - Puedes presionar **`🪄 Autocompletar Horas Faltantes (Este Curso)`** o **`🚀 Autocompletar Todos los Cursos (1º a 8º)`** para que el sistema reparta automáticamente las horas pendientes sin ningún topón.

---

## 5. Cómo Bloquear Horas en que un Profesor NO Puede Hacer Clases
Si un docente no está disponible en ciertos bloques (por ejemplo, asiste solo media jornada o tiene horas administrativas fijas):
1. Ve a la pestaña **`👨‍🏫 Horario por Profesor`** y selecciona al docente.
2. Presiona el botón **`🔒 Marcar Horas No Disponibles`**.
3. Haz clic sobre las celdas libres que deseas bloquear (aparecerá **`🔒 No Disponible`**).
4. Presiona **`Listo`**. El sistema nunca permitirá asignar clases a ese profesor en los bloques bloqueados.

---

## 6. Cómo Editar Profesores, Planes de Estudio, Respaldar e Imprimir

- **Cambiar qué profesor dicta un ramo en un curso**:
  1. Entra a **`📚 Plan de Estudio por Curso`**.
  2. Selecciona el curso en la lista izquierda.
  3. Haz clic en el botón **`✏️`** de la asignatura, cambia el **Profesor Encargado** o la cantidad de horas semanales y presiona **`Actualizar`**.
- **Agregar o editar un Profesor y ver su Ficha 65/35**:
  1. Entra a **`📑 Carga Docente (65/35 y SEP)`**.
  2. Usa el formulario izquierdo para agregar un docente nuevo o presiona **`✏️`** en la tabla para modificar sus horas de contrato, horas SEP o PIE.
  3. Presiona **`📋 Ficha`** para ver el desglose completo de Horas Lectivas, Horas SEP y Horas No Lectivas (proporción 65/35).
- **Guardar Respaldo (`💾`) y Cargar Respaldo (`📂`)**:
  - Los cambios se guardan automáticamente en el navegador de tu computador.
  - Para enviar tus cambios a otra persona (en Windows o Mac) o guardar una copia de seguridad, presiona **`💾 Guardar Respaldo`** (se descargará un archivo `.json`). La otra persona solo debe presionar **`📂 Cargar Respaldo`** y seleccionar ese archivo.
- **Exportar Planilla (`📊`) e Imprimir / PDF (`🖨️`)**:
  - Presiona **`📊 Exportar Planilla (CSV)`** para descargar una tabla compatible con hojas de cálculo.
  - Presiona **`🖨️ Imprimir / PDF`** en cualquier pestaña para imprimir o guardar en PDF la vista que tengas en pantalla.
