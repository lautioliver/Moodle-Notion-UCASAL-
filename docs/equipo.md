# Documentación Técnica: Cambios en el Proyecto

Esta documentación detalla las modificaciones y mejoras implementadas en la última sesión de desarrollo del proyecto **Moodle-Notion Sync**.

## 1. Reestructuración de Carpetas
Para mantener un entorno de trabajo limpio y modular, el proyecto ha sido reorganizado:

- **`src/`**: Contiene toda la lógica de la aplicación (`index.js`, `auth.js`, `parser.js`, `storage.js`, `notionSync.js`).
- **`data/`**: Carpeta destinada a alojar la base de datos local y sesiones (`db.json`, `cookies.json`, `courses.json`).
- **`api/`**: Contiene la Serverless Function (`sync.js`) requerida para el despliegue en Vercel.
- **`docs/`**: Documentación del proyecto.
- **Archivos Obsoletos**: Se eliminaron archivos de pruebas y temporales (`test_cheerio.js`, `capture.js`, `debug.html`, `campus_source.html`).

## 2. Solución al Caché del Login (Puppeteer)
Se detectó que el login no se mantenía persistente entre ejecuciones porque las cookies de sesión (como `MoodleSession`) tenían el parámetro `expires: -1`.
- **Solución:** En `auth.js`, se interceptan las cookies antes de cargarlas en Puppeteer y se fuerza una fecha de expiración de 30 días (`expires = Date.now() / 1000 + 86400 * 30`) para que Puppeteer las tome como persistentes.
- **Impacto:** Menor riesgo de bloqueos por parte de Moodle debido a múltiples intentos de login. Mayor rapidez de ejecución.

## 3. Preparación para Vercel
Dado el requerimiento de desplegar en Vercel de manera funcional:
- **Refactorización de `index.js`**: Se migró de una IIFE (función autoejecutable) a una función exportable `runSync()`. Esto permite que el script sea importado como módulo y ejecutado a demanda.
- **Endpoint `api/sync.js`**: Se creó un Serverless Endpoint que Vercel ejecutará para lanzar la automatización.
- **`vercel.json`**: Se agregó la configuración para un Cron Job que permite llamar a `/api/sync` automáticamente, y las reglas de ruteo del build.

> **Nota importante sobre Vercel y Puppeteer:** Vercel impone un límite estricto de 50MB por función. Si el proyecto experimenta errores en la nube indicando que supera el límite de peso debido a Chromium, será necesario reemplazar `puppeteer` por `puppeteer-core` e instalar el motor ligero `@sparticuz/chromium`. Por decisión del equipo, el despliegue funcional se prioriza por ahora usando la base estándar.
