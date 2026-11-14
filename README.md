# Sistema de Gestión de Horarios Escolares — Christian College

Aplicación web institucional para la planificación académica y asignación de horarios escolares (1º a 8º Básico), validación de topones docentes en tiempo real, sábana general de horarios y cuadro de carga horaria legal (Horas Lectivas, SEP, PIE y No Lectivas 65/35).

## Arquitectura del Proyecto

```text
sistema-horarios-colegio/
├── assets/
│   ├── css/
│   │   └── styles.css                # Estilos visuales, temas y formato de impresión PDF
│   └── img/
│       └── logo-colegio.png          # Logotipo oficial de la institución
├── config/
│   └── database.rules.json           # Reglas de seguridad para Firebase Realtime Database (auth != null)
├── docs/
│   └── MANUAL_DE_USUARIO.md          # Manual operativo para Dirección y Jefatura de UTP
├── src/
│   ├── config/
│   │   ├── constants.js              # Constantes de configuración, credenciales Firebase y estado global
│   │   └── seedData.js               # Plantilla base institucional (cursos, docentes, bloques y plan de estudio)
│   ├── controllers/
│   │   ├── events.controller.js      # Controlador de eventos del DOM, formularios, modales y bootstrap
│   │   └── ui.controller.js          # Controlador de renderizado de vistas (Horario, Sábana, Profesor, Carga 65/35)
│   ├── middlewares/
│   │   └── auth.middleware.js        # Middleware de autenticación JWT, control de sesión e inactividad (60 min)
│   ├── services/
│   │   ├── auth.service.js           # Servicio de autenticación y renovación de tokens con Firebase Auth REST API
│   │   ├── pdf.service.js            # Motor de generación y exportación vectorial de documentos PDF (jsPDF + AutoTable)
│   │   ├── scheduler.service.js      # Motor de validación de topones, asignaciones, enroques y autocompletado
│   │   └── storage.service.js        # Sincronización en tiempo real con Firebase, persistencia local y exportación CSV/JSON
│   └── utils/
│       └── helpers.js                # Utilidades generales, historial Deshacer (Undo) y notificaciones Toast
├── .nojekyll                         # Configuración de despliegue directo en GitHub Pages
├── index.html                        # Punto de entrada principal de la aplicación
└── README.md                         # Documentación de arquitectura del repositorio
```
