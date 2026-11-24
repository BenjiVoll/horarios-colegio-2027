# Manual de Usuario — Sistema de Gestión de Horarios Escolares (Christian College)

Bienvenido(a) al **Sistema de Gestión de Horarios Escolares** de **Christian College**. Esta plataforma permite planificar los horarios de **1º a 8º Básico**, controlar la carga docente legal (proporción **65/35**, horas **SEP** y **PIE**), prevenir **topones horarios en tiempo real** y exportar documentos **PDF vectoriales oficiales** desde computador, tablet o celular.

---

## 1. Cómo Asignar, Mover o Intercambiar Clases en un Curso
En la primera pestaña **`🗓️ Horario por Curso (1º a 8º)`**:

1. **Seleccionar el Curso**: Toca o haz clic sobre los botones rápidos (`1º` a `8º`) en el panel de cursos.
2. **Asignar una clase**:
   - **Opción A (Con clic/toque)**: Selecciona una asignatura de la paleta (ej. *Matemática*) y luego toca el bloque libre del calendario donde deseas ubicarla.
   - **Opción B (Arrastrar en PC)**: Arrastra la asignatura desde la lista izquierda y suéltala sobre el bloque del calendario.
   - **Opción C (Clic directo en celda)**: Sin ninguna asignatura seleccionada, toca cualquier celda del calendario para abrir la ventana de asignación rápida.
3. **Mover o intercambiar bloques (Enroque)**:
   - **En PC**: Arrastra un bloque ya asignado y suéltalo encima de otro bloque.
   - **En tablet y celular (2 toques)**: Activa el botón **`🔄 Mover / Intercambiar`**, toca el bloque asignado que deseas mover (quedará marcado en azul) y luego toca el bloque de destino. El sistema valida automáticamente que no existan topones.
4. **Quitar una clase**:
   - Presiona el botón **`✕`** en la esquina superior derecha del bloque, o activa **`🧹 Modo Borrador`** y toca los bloques que quieras liberar.
5. **Deshacer un error (`↩️ Deshacer`)**:
   - Presiona **`↩️ Deshacer`** en la barra superior (en móvil, dentro del botón **`☰ Más`**) para volver al estado anterior.

---

## 2. Prevención de Topones, Alertas Pedagógicas y Ventanas
- **Bloqueo automático de Topones (`⛔ Topón`)**: Al seleccionar una asignatura, el calendario marca en rojo los bloques donde el profesor ya hace clases en otro curso. El indicador superior **`🟢 0 Topones detectados`** confirma en todo momento la validez global.
- **Aviso pedagógico no bloqueante**: Si una misma asignatura queda con **3 o más bloques consecutivos** en un mismo día, aparece un aviso amarillo informativo sobre el calendario del curso.
- **Detector de Ventanas Docentes (`🪟 Ventanas`)**: En **`👨‍🏫 Horario por Profesor`**, el sistema calcula automáticamente las horas libres intermedias entre la primera y última clase de cada día y las resalta visualmente.

---

## 3. Panorama General (Todos los Cursos)
En la pestaña **`📊 Panorama General (Todos los Cursos)`**:
1. **Tarjetas de Avance (`1º` a `8º`)**: Muestran el porcentaje de completitud (`38 / 38 hrs`). Al tocar cualquiera, te lleva directo a ese curso.
2. **Vista Comparativa por Día (`Lunes` a `Viernes`)**: Muestra los 8 cursos en paralelo con columna de verificación **`✅ Sin topón`** y edición directa al tocar cualquier celda.
3. **Vista `📅 Semana Compacta`**: Muestra los 38 bloques semanales de todos los cursos en una sola matriz.
4. **Filtro `🔍 Destacar Profesor`**: Ilumina todos los bloques donde un docente tiene clases en la semana.

---

## 4. Años Escolares Dinámicos, Guardado en la Nube y Respaldos
- **Crear o clonar un nuevo Año Escolar (`+`)**: En la barra superior, junto al selector de año (`2026`, `2027`), presiona **`+`** para crear un nuevo año escolar (ej. `2028`) eligiendo si deseas clonar docentes, cursos y planes de estudio del año actual.
- **Guardar en la Nube (`💾 Guardar Cambios`)**: Cuando realizas modificaciones, el botón superior cambia a naranja. Presiónalo (o usa `Ctrl + S`) para publicar los cambios en Firebase. Si otro usuario guardó una versión más reciente mientras editabas, el sistema te avisará antes de sobrescribir.
- **Herramientas avanzadas y respaldos**: En **`📖 Ayuda y Opciones UTP`** encontrarás el acceso a **Bloques y Recreos**, **Descargar/Restaurar copia de seguridad (`.json`)**, **Estado de Base de Datos**, **Cargar Horario Base Propuesto (38/38)** y **Reiniciar Todo el Año a Cero (0/38)**.

---

## 5. Carga Docente (65/35 y SEP) y Plan de Estudio
- **Dashboard 65/35 (`📑 Carga Docente`)**: Muestra en la parte superior el resumen de planta docente, cumplimiento legal 65/35, avance global de horas y ventanas totales. Desde la tabla (o tarjetas en móvil) puedes abrir la **`📋 Ficha`** detallada o editar horas de contrato, Kº/CRA, SEP y PIE.
- **Plan de Estudio (`📚 Plan de Estudio por Curso`)**: Permite agregar, editar o eliminar cursos y asignaturas, asignar el docente encargado y controlar las horas planificadas vs. asignadas en calendario.

---

## 6. Exportación PDF Oficial y Planilla CSV
- **Exportar PDF Oficial (`📄 Exportar PDF Oficial`)**: Abre el Centro de Exportación vectorial para generar y previsualizar documentos exactos en hoja **A4, Carta u Oficio** (horario por curso, carpeta de todos los cursos, ficha/horario docente, panorama diario, sábana semanal y cuadro legal 65/35).
- **Exportar Planilla (`📊 Exportar Planilla`)**: Descarga el archivo `.csv` compatible con Excel y Google Sheets.
