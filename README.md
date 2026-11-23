# Portfolio

App web instalable (PWA) que valora tus posiciones al precio de mercado en
vivo: crypto, acciones y ETFs de EE. UU., metales, efectivo y activos propios.
Guardas cantidad y, si quieres, costo promedio. En crypto, acciones y metales
puedes además registrar compras y ventas con fecha: la cantidad y el costo
promedio salen de ellas y se calcula la ganancia realizada. También guarda
dividendos (acciones) y recompensas de staking (crypto). El Cash puede tener una
tasa anual (APY): cada mes la app abona sola el interés al saldo, como una
cuenta de ahorro. Lo cobrado en los últimos 12 meses se suma en Rendimiento.

También: lista de **Seguimiento** (activos que no tienes, con precio y
gráfico), tus compras y ventas como puntos en el gráfico de cada activo,
**bloqueo con Face ID** (una llave de acceso del iPhone; no cifra los datos,
es una pantalla de privacidad) y la app se difumina en el selector de apps. No hay conexión a
brokers ni wallets.

Son archivos estáticos: sin backend, sin build y sin nada corriendo en tu PC.
Se publica con GitHub Pages desde la raíz de la rama `main`.

## Instalarla en el iPhone

Abre la dirección de GitHub Pages en Safari → Compartir → **Añadir a pantalla de
inicio**. La app comprueba si hay una versión nueva cada vez que vuelve a primer
plano y se recarga sola.

## Probarla en local

```
node serve.mjs          # http://localhost:4173
```

`http://localhost:4173/#demo` abre un portfolio de ejemplo que no se guarda.

## Idioma y tema

En español o inglés (Ajustes → Idioma). La app está escrita en español y
`js/i18n.js` traduce al inglés todo lo que llega a la pantalla, con un
diccionario de frases y patrones para las que llevan números o nombres. Un
texto nuevo necesita su entrada en ese diccionario; la prueba
`tests/e2e/english.e2e.cjs` recorre la app en inglés y lista cualquier texto que
siga en español. El tema (Ajustes → Tema) sigue al iPhone o se fija en claro, oscuro o
azul (vidrio y luz azul).

**Diseño anterior al tema Azul:** el commit `f3774b3` (versión 1.7). El tema
Azul es una opción más; Auto, Claro y Oscuro quedan como estaban.

## Publicar un cambio

Sube el mismo número de versión en `version.json` y en `js/update.js`
(`node --test` falla si no coinciden). Las versiones van 1.0, 1.1 … 1.9 y
después 2.0. Sube también `CACHE` en `sw.js` y haz push a `main`. GitHub Pages publica
en uno o dos minutos y la app instalada se actualiza al abrirla.

Si la versión trae algo que contar, añade arriba de `NOTES` en
`js/whatsnew.js` una entrada con ese número de versión y hasta tres puntos
cortos: tras actualizarse, la app muestra una tarjeta «Novedades» una sola vez.
Una versión sin notas (arreglos) se actualiza en silencio.

## Pruebas

```
node --test                          # lógica, menos de 1 s
node --test 'tests/e2e/*.e2e.cjs'    # la app en un navegador, ~1 min
```

Las de navegador necesitan Playwright con Chromium. Abren la app con tamaño de
iPhone, tocan como un dedo (deslizar, arrastrar, mantener) y comprueban
importes, guardado, copias y modo sin conexión. El mercado es simulado
(`tests/e2e/harness.cjs`): ninguna petición sale a internet, así que el
resultado no depende de la red ni de lo que hizo el precio hoy. Córrelas antes
de publicar.

## De dónde salen los datos

| Clase | Precio en vivo | Histórico (gráficos) | Llave |
| --- | --- | --- | --- |
| Crypto listada en Coinbase | Coinbase, tick a tick | Coinbase | no |
| Resto de crypto | CoinGecko, cada 60 s | CoinGecko | no |
| Oro | gold-api.com, cada 30 s | Coinbase PAXG (token respaldado por oro), reescalado al precio spot | no |
| Plata, platino, paladio | gold-api.com, cada 30 s | aproximado con un ETF (SLV, PPLT, PALL) vía Twelve Data | Twelve Data, gratuita |
| Acciones y ETFs de EE. UU. | Finnhub, cada 15 s | Twelve Data | Finnhub y Twelve Data, gratuitas |
| Efectivo / conversión | open.er-api.com, diaria | — | no |
| Planes de retiro (401(k), IRA, Roth, pensión) | saldo que escribes; opcionalmente se mueve con un índice (VOO, VTI o VT vía Finnhub) desde la última actualización | — | Finnhub, si sigue un índice |
| Otro activo | valor que escribes | — | — |

Las llaves se pegan en Ajustes, se validan antes de guardarse y se quedan en
ese navegador. Cada persona que use la app pone las suyas.

Límites conocidos:

- **Acciones**: sin llave de Finnhub no tienen precio. El plan gratuito no
  cubre bolsas fuera de EE. UU.
- **Twelve Data gratis**: 8 consultas por minuto y 800 al día. La app las
  encola y guarda los resultados, así que con muchas acciones los gráficos se
  completan poco a poco la primera vez.
- **Plata, platino y paladio**: el plan gratuito no da su histórico spot; el
  gráfico usa la forma del ETF reescalada al precio actual y se marca como
  aproximado.
- **CoinGecko** limita peticiones por IP; si responde 429 la app reintenta sola.

## El gráfico del portfolio

Los rangos 1D, 1S, 1M y 1A responden
«¿cuánto habrían valido mis posiciones de hoy?»: cantidades actuales por el
precio pasado de cada activo. No usan las operaciones a propósito: si lo
hicieran, una compra se vería como subida y el % dejaría de medir rendimiento.
Un activo sin histórico se mantiene plano y se
nombra bajo el gráfico.

El rango **Real** dibuja el balance que la app registró de verdad (una foto
cada media hora mientras está abierta), así que empieza vacío y se llena con el
uso.

## Meta

Tarjeta en inicio y hoja propia (`js/goal.js`, cálculos en `js/goal-math.js`):
progreso hacia una cantidad (por defecto "Road to 1M"), hitos redondos que se
celebran una vez al cruzarlos, y una proyección de cuándo llegas con el aporte
mensual y la rentabilidad anual que elijas (interés compuesto mensual). Muestra
también cuánto aportar para llegar en 5, 10, 15 o 20 años y cuánto antes llegas
aportando un poco más. Todo depende de la rentabilidad supuesta: no es una
predicción.

## Datos

Todo se guarda solo y al instante en el navegador donde la usas, en tres capas:

1. **Copia de trabajo** en `localStorage`.
2. **Espejo en IndexedDB** (`js/vault.js`). Si la copia de trabajo se vacía o se
   corrompe, la app la restaura sola al abrirse.
3. **Versiones**: una por día (como empezó ese día) y una antes de cada
   borrado, importación o restauración; se guardan las 20 más recientes.
   Ajustes → Versiones guardadas.

Las tres viven en el mismo almacenamiento: si borras la app de la pantalla de
inicio se pierden. Para eso está Ajustes → **Guardar en Archivos** (en iPhone
abre la hoja de compartir; "Guardar en Archivos" la deja en iCloud Drive). La
app avisa a los 3 días de uso si nunca guardaste una copia, y luego cada 30
días. Una copia contiene posiciones, preferencias, objetivo y el historial
real; nunca las llaves. Se recupera con Ajustes → Importar copia.

## Estructura

```
index.html  styles.css  manifest.webmanifest  sw.js  version.json  serve.mjs
js/main.js       pantallas y conexión entre módulos
js/prices.js     precios en vivo
js/history.js    históricos, con cola para el límite de Twelve Data
js/series.js     valor del portfolio en el tiempo
js/snapshots.js  registro del balance real
js/targets.js    distribución objetivo y rebalanceo
js/stats.js      máximos, mínimos y capitalización del detalle
js/update.js     actualización de la app instalada
js/vault.js      espejo interno, versiones y copia a Archivos
js/goal.js       meta: tarjeta, hoja, hitos y celebración
js/goal-math.js  interés compuesto, plazos y aportes necesarios
js/catalog.js    activos disponibles y búsqueda
js/store.js      posiciones y ajustes
js/format.js     formato de moneda y números
js/ui.js         número animado, selector, interruptor, mini-gráfico
js/motion.js     springs y gestos
js/sheet.js      hojas deslizables y avisos
js/chart.js      gráfico
js/logo.js       logos con alternativa si no cargan
tools/build-catalog.mjs   regenera js/catalog-data.js (top 100 de crypto)
tools/make-images.cjs     regenera iconos e imágenes de arranque
tests/                    pruebas de la lógica: node --test
tests/e2e/                pruebas en navegador con mercado simulado
```
