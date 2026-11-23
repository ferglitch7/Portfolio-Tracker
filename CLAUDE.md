# Portfolio — contexto para sesiones nuevas

Lee esto antes de tocar nada. Resume lo que se decidió en sesiones anteriores.

## Qué es

- PWA estática (sin backend, sin build, módulos ES) que valora posiciones a
  precio de mercado en vivo: crypto, acciones/ETFs de EE. UU., metales, Cash,
  cuentas de retiro y activos propios.
- Publicada con GitHub Pages desde `main` (raíz): https://ferglitch7.github.io/Portfolio-Tracker/
- El dueño la usa instalada en su iPhone. Los datos viven solo en cada
  dispositivo (localStorage + IndexedDB); no hay servidor ni cuentas.
- **Es un proyecto independiente.** No tiene nada que ver con
  `claude-usage-widget`; no mezclar.

## Reglas del dueño (no negociables)

- **Nada que ejecute código descargado en su PC** (ni tareas programadas que
  bajen y corran scripts, ni `irm | iex` automáticos). La app no depende de su PC.
- No guardar llaves de API en el repo ni en las copias exportadas.
- Hablar en español, claro y directo; con datos, sin endulzar. Antes de tareas
  grandes: tiempo estimado y modelo/effort recomendados.

## Cómo publicar un cambio

1. Versión en **números**: 1.0, 1.1 … 1.9, luego 2.0. Subir el mismo número en
   `version.json` y `APP_VERSION` de `js/update.js`, y subir `CACHE` en `sw.js`
   (`portfolio-vN`). Nunca reutilizar un número.
2. Si la versión trae algo que contar, añadir arriba de `NOTES` en
   `js/whatsnew.js` (máx. 3 puntos) y sus textos en inglés en `js/i18n.js`.
3. Correr **todas** las pruebas y publicar solo si pasan:
   `node --test` y `node --test 'tests/e2e/*.e2e.cjs'` (necesita Playwright + Chromium).
4. `git add -A` (no olvidar archivos) → commit → push a `main`. Pages publica
   en 1–2 min; la app instalada se actualiza sola al abrirla.

## Convenciones

- Interfaz escrita en español; `js/i18n.js` traduce al inglés en pantalla
  (diccionario + patrones). Texto nuevo ⇒ entrada en el diccionario; la prueba
  `tests/e2e/english.e2e.cjs` lista lo que quede en español.
- Fechas siempre **MM/DD/YYYY**. Números: ajuste del usuario (1.234,50 o 1,234.50).
- Temas: Auto, Claro, Oscuro y Azul (`data-theme` en `<html>`). El diseño
  anterior al tema Azul es el commit `f3774b3` (versión 1.7).
- Distribución: Barra (por defecto), Anillo o Lista (Ajustes).
- Pruebas de navegador con mercado simulado: `tests/e2e/harness.cjs`.

## Dónde está cada cosa

- `README.md`: funciones, fuentes de datos, estructura de archivos.
- `PENDIENTES.md`: ideas acordadas que faltan (p. ej. Crédito) y otras propuestas.
- `promo/`: video 3D promocional (vertical 1080×1920) y su imagen fija, con un
  portfolio de ejemplo. `tools/promo/`: scripts que los generan (capturas en
  tema Azul + render cuadro a cuadro con Playwright y ffmpeg).
