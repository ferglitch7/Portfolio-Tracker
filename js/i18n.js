// English and Spanish.
//
// The app is written in Spanish. In English, every text that reaches the screen
// (text nodes, aria-label, placeholder, title) is translated on the way in by a
// MutationObserver: exact sentences from EN, and sentences with numbers or names
// in them from PATTERNS. Nothing else in the code has to know about languages,
// and a missing entry shows up as Spanish (the e2e test lists any it finds).
//
// The language is read once at start; changing it in Ajustes reloads the app.

const KEY = 'portfolio.v1';

function initial() {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const pick = saved && saved.settings && saved.settings.lang;
    if (pick === 'en' || pick === 'es') return pick;
    if (saved) return 'es'; // people who used the app before languages existed
  } catch { /* no storage */ }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
  return nav.some(l => /^es\b/i.test(l || '')) ? 'es' : (nav.length ? 'en' : 'es');
}

export const LANG = initial();
export const isEn = LANG === 'en';
/** Locale for dates written with month names. */
export const DATE_LOCALE = isEn ? 'en-US' : 'es';

// ---- exact texts ------------------------------------------------------------------

const EN = new Map(Object.entries({
  // classes, kinds, catalog
  'Crypto': 'Crypto', 'Acciones': 'Stocks', 'Metales': 'Metals', 'Efectivo': 'Cash', 'Retiro': 'Retirement', 'Otros': 'Other',
  'Otro plan': 'Other plan', 'Nada': 'None', 'Total EE. UU.': 'Total US', 'Mundial': 'World', 'Pensión': 'Pension',
  'Oro': 'Gold', 'Plata': 'Silver', 'Platino': 'Platinum', 'Paladio': 'Palladium',
  'Dólar': 'US dollar', 'Euro': 'Euro', 'Peso mexicano': 'Mexican peso', 'Libra esterlina': 'British pound',
  'Dólar canadiense': 'Canadian dollar', 'Franco suizo': 'Swiss franc', 'Yen japonés': 'Japanese yen',
  'Dólar australiano': 'Australian dollar', 'Real brasileño': 'Brazilian real', 'Peso argentino': 'Argentine peso',
  'Peso colombiano': 'Colombian peso', 'Peso chileno': 'Chilean peso', 'Sol peruano': 'Peruvian sol',
  'Peso uruguayo': 'Uruguayan peso', 'Peso dominicano': 'Dominican peso', 'Colón costarricense': 'Costa Rican colón',
  'Quetzal guatemalteco': 'Guatemalan quetzal', 'Yuan chino': 'Chinese yuan', 'Dólar de Hong Kong': 'Hong Kong dollar',
  'Dólar de Singapur': 'Singapore dollar', 'Rupia india': 'Indian rupee', 'Won surcoreano': 'South Korean won',
  'Corona sueca': 'Swedish krona', 'Corona noruega': 'Norwegian krone', 'Corona danesa': 'Danish krone',
  'Esloti polaco': 'Polish złoty', 'Lira turca': 'Turkish lira', 'Rand sudafricano': 'South African rand',
  'Dírham de los EAU': 'UAE dirham', 'Dólar neozelandés': 'New Zealand dollar',

  // home
  'Añadir activo': 'Add asset', 'Balance total': 'Total balance',
  'Balance. Toca para cambiar de unidad, mantén pulsado para ocultarlo': 'Balance. Tap to change the unit, hold to hide it',
  'Evolución': 'History', 'El historial real se llena solo, cada vez que abres la app.': 'The real history fills in by itself, every time you open the app.',
  'Objetivo': 'Target', 'Activos': 'Assets', 'Rendimiento': 'Performance', 'Seguimiento': 'Watchlist',
  'Todo tu patrimonio, en vivo': 'Everything you own, live', 'Crypto, acciones, metales y efectivo en un solo balance.': 'Crypto, stocks, metals and cash in one balance.',
  'Ver un ejemplo': 'See an example', 'Ejemplo': 'Example', 'Salir': 'Exit', 'Esta app necesita JavaScript.': 'This app needs JavaScript.',
  'Distribución': 'Allocation', 'Ajustes': 'Settings', 'Añadir': 'Add',
  '1S': '1W', '1A': '1Y', '24 h': '24 h', '7 días': '7 days', '30 días': '30 days', '1 año': '1 year', 'Hoy': 'Today', 'hoy': 'today', 'total': 'total',
  'Real': 'Real', 'Mejor': 'Best', 'Peor': 'Worst', 'Dividendos e intereses · 12 meses': 'Dividends and interest · 12 months',
  'En vivo': 'Live', 'Reconectando': 'Reconnecting', 'Conectando': 'Connecting', 'Sin conexión': 'Offline',
  '1 clase': '1 class', 'La llave de Finnhub no es válida': 'Your Finnhub key is not valid', 'Acciones sin precio en vivo': 'Stocks without live prices',
  'Revisar': 'Check', 'Conectar': 'Connect', 'Guardar': 'Save', 'Aún no tienes una copia fuera del iPhone': 'You have no copy outside your iPhone yet',
  'Editar': 'Edit', 'Eliminar': 'Delete', 'Sin precio': 'No price', 'Cargando': 'Loading', 'Deshacer': 'Undo',
  'Posición cerrada': 'Closed position', 'Manual': 'Manual', 'saldo fijo': 'fixed balance',
  'Novedades': 'What’s new', 'Continuar': 'Continue',

  // goal
  'Road to 1M': 'Road to 1M', 'Ponte una meta': 'Set a goal', 'Road to 1M, una casa, tu retiro…': 'Road to 1M, a house, your retirement…',
  '¡Meta alcanzada!': 'Goal reached!', 'Añade un aporte para ver cuándo llegas': 'Add a contribution to see when you get there',
  'Tus aportes': 'Your contributions', 'Crecimiento': 'Growth', 'Nombre de la meta': 'Goal name', 'Aporte mensual': 'Monthly contribution',
  'Rentabilidad anual supuesta': 'Assumed annual return', '5 años': '5 years', '10': '10', '20': '20',
  'Es momento de ponerte una más grande.': 'Time to set a bigger one.', 'Sin fecha todavía': 'No date yet',
  'Con aporte 0 y sin crecimiento no llegas. Prueba con un aporte mensual.': 'With no contribution and no growth you never get there. Try a monthly contribution.',
  'Con': 'With', 'Ya llegas sin aportar': 'You get there without contributing', 'Crear meta': 'Create goal', 'Quitar meta': 'Remove goal',
  'Rentabilidad supuesta': 'Assumed return',
  'La proyección usa la rentabilidad que elijas; no es una predicción. Como referencia, una cartera diversificada de acciones ha rendido históricamente alrededor de 7 % al año descontando inflación, con años muy negativos de por medio.':
    'The projection uses the return you choose; it is not a prediction. For reference, a diversified stock portfolio has historically returned about 7 % a year after inflation, with some very negative years along the way.',
  'Cuánto aportar': 'How much to put in', 'Hitos': 'Milestones', 'Tu meta': 'Your goal', 'Nombre': 'Name', 'Cantidad': 'Amount',

  // lock, privacy
  'Desbloquear': 'Unlock', 'Configurar Face ID de nuevo': 'Set up Face ID again', 'Portfolio bloqueado': 'Portfolio locked',
  'No se pudo comprobar. Inténtalo de nuevo.': 'Could not verify. Try again.', 'No se pudo configurar. Inténtalo de nuevo.': 'Could not set it up. Try again.',
  'No se pudo activar el bloqueo': 'Could not turn on the lock', 'Hace falta tu Face ID para quitarlo': 'Your Face ID is needed to turn it off',
  'Bloqueo con Face ID activado': 'Face ID lock on', 'Bloqueo desactivado': 'Lock off', 'Bloqueo con Face ID': 'Face ID lock',

  // add, amounts, detail
  'Comprar': 'Buy', 'Dejar de seguir': 'Stop following', '401(k), IRA, Roth, pensión': '401(k), IRA, Roth, pension',
  'Buscar': 'Search', 'Buscar activo': 'Search asset', 'Todo': 'All',
  'Para buscar cualquier acción o ETF de EE. UU., conecta Finnhub en': 'To search any US stock or ETF, connect Finnhub in',
  'Otro activo': 'Other asset', 'Inmueble, fondo, negocio…': 'Property, fund, business…', 'Valor': 'Value', 'Opcional': 'Optional',
  'Departamento, fondo…': 'Apartment, fund…', 'Valor que tú defines': 'A value you set', 'Cargando precio…': 'Loading price…',
  'Costo': 'Cost', 'Costo promedio': 'Average cost', 'Solo seguir, sin comprar': 'Just follow, don’t buy',
  'Saldo inicial': 'Opening balance', 'Posición inicial': 'Opening position', 'Ingreso': 'Income', 'Depósito': 'Deposit',
  'Venta': 'Sale', 'Compra': 'Buy', 'Registrar': 'Record', 'Precio': 'Price', 'Operación': 'Trade', 'Nueva operación': 'New trade',
  'Con este cambio una venta quedaría sin unidades.': 'With this change a sale would have nothing to sell.',
  'Las unidades se suman a tu posición con su valor de ese día.': 'The units join your position at their value that day.',
  'Se suma a tu saldo.': 'Added to your balance.', 'No cambia tu cantidad de acciones.': 'Your number of shares stays the same.',
  'Antes borra el retiro que depende de esto': 'First delete the withdrawal that depends on this',
  'Antes borra la venta que depende de esta compra': 'First delete the sale that depends on this buy',
  'Fecha': 'Date', 'Lo que ya tenías antes de registrar movimientos.': 'What you already had before recording anything.',
  'Interés anual': 'Annual interest',
  'La tasa anual (APY) de tu cuenta de ahorro. Cada mes, en la fecha de hoy, la app suma al saldo el interés de ese mes. Si el banco cambia la tasa, cámbiala aquí.':
    'Your savings account’s annual rate (APY). Every month, on today’s date, the app adds that month’s interest to the balance. If the bank changes the rate, change it here.',
  'Quitar interés': 'Remove interest', 'Plan de retiro': 'Retirement plan', 'Saldo actual': 'Current balance', 'Fidelity 401(k)…': 'Fidelity 401(k)…',
  'El saldo queda fijo hasta que lo actualices.': 'The balance stays as it is until you update it.',
  'Saldo actual de tu estado de cuenta': 'Current balance on your statement', 'Tipo de cuenta': 'Account type', 'Se mueve con': 'Follows',
  'Total aportado': 'Total contributed', 'El gráfico necesita tu llave de Twelve Data': 'The chart needs your Twelve Data key',
  'Ganancia realizada': 'Realized gain', 'Intereses': 'Interest', 'Recompensas': 'Rewards', 'Dividendos': 'Dividends',
  'Movimientos': 'Activity', 'Operaciones': 'Trades', 'Valor manual': 'Manual value', 'Compras': 'Buys', 'Ventas': 'Sales',
  'Dividendo': 'Dividend', 'Recompensa': 'Reward', 'Interés': 'Interest', 'sin costo': 'no cost',
  'Registrar compra': 'Record a buy', 'Registrar venta': 'Record a sale', 'Registrar dividendo': 'Record a dividend', 'Registrar recompensa': 'Record a reward',
  'Ganancia': 'Gain', 'Peso': 'Weight', 'Sin precio en vivo': 'No live price',
  'Máximo histórico': 'All-time high', 'Máximo de 52 semanas': '52-week high', 'Mínimo de 52 semanas': '52-week low',
  'Distancia al máximo': 'From the high', 'Capitalización': 'Market cap', 'Volumen': 'Volume',

  // settings
  'No válida': 'Not valid', 'Moneda': 'Currency', 'Copia guardada': 'Copy saved',
  'Una versión por día (como empezó ese día) y una antes de cada borrado, importación o restauración. Se guardan las 20 más recientes en este iPhone.':
    'One version a day (as the day began) and one before every wipe, import or restore. The 20 most recent are kept on this iPhone.',
  'Versiones guardadas': 'Saved versions', 'Todavía no hay versiones. Se crea una cada día que abres la app.': 'No versions yet. One is made every day you open the app.',
  'Toca otra vez para restaurar': 'Tap again to restore', 'Antes de restaurar': 'Before restoring', 'Versión restaurada': 'Version restored',
  'Antes de importar': 'Before importing', 'Antes de borrar': 'Before wiping', 'Ocultar importes': 'Hide amounts',
  'Ordenar activos por valor': 'Sort assets by value', 'Ordenar por valor': 'Sort by value',
  'Barra': 'Bar', 'Anillo': 'Ring', 'Lista': 'List', 'Auto': 'Auto', 'Claro': 'Light', 'Oscuro': 'Dark', 'Azul': 'Blue', 'Tema': 'Theme', 'Idioma': 'Language',
  'Portfolio importado': 'Portfolio imported', 'Ese archivo no es una copia de Portfolio': 'That file is not a Portfolio copy',
  'Nunca': 'Never', 'Borrar todo': 'Delete everything', 'Portfolio borrado': 'Portfolio deleted', 'Ver versiones': 'See versions',
  'Toca otra vez para borrar': 'Tap again to delete', 'Números': 'Numbers',
  'Para mover un activo, mantenlo pulsado y arrástralo. Al hacerlo, el orden por valor se desactiva.': 'To move an asset, hold it and drag it. Doing so turns off sorting by value.',
  'Acciones en vivo': 'Live stocks', 'Llave de Finnhub': 'Finnhub key', 'Llave gratuita en': 'Free key at',
  'Da precio en tiempo real de acciones y ETFs de EE. UU.': 'Gives real-time prices for US stocks and ETFs.',
  'Gráficos de acciones': 'Stock charts', 'Llave de Twelve Data': 'Twelve Data key',
  'Da el histórico de acciones y ETFs, y el aproximado de plata, platino y paladio. Crypto y oro no la necesitan.':
    'Gives history for stocks and ETFs, and the approximate one for silver, platinum and palladium. Crypto and gold do not need it.',
  'Datos': 'Data', 'Guardar en Archivos': 'Save to Files', 'Última copia fuera': 'Last copy outside', 'Importar copia': 'Import a copy',
  'Todo se guarda solo y al instante en este iPhone, con una segunda copia interna y versiones diarias. Si borras la app de la pantalla de inicio se pierde todo: guarda una copia en Archivos (iCloud Drive). Si hay cambios sin copiar, la app te lo recuerda cada semana.':
    'Everything saves itself instantly on this iPhone, with a second internal copy and daily versions. If you delete the app from the home screen everything is lost: save a copy to Files (iCloud Drive). If there are changes not yet copied, the app reminds you every week.',
  'Precios de Coinbase, CoinGecko, gold-api.com, Finnhub, Twelve Data y open.er-api.com.': 'Prices from Coinbase, CoinGecko, gold-api.com, Finnhub, Twelve Data and open.er-api.com.',
  'Datos recuperados de la copia interna': 'Data recovered from the internal copy', 'Atrás': 'Back', 'Cerrar': 'Close',

  // targets
  'Para llegar al objetivo': 'To reach the target', 'Menos': 'Less', 'Más': 'More', 'Suma 100 %': 'Adds up to 100 %',
  'Quitar objetivo': 'Remove target', 'Distribución objetivo': 'Target allocation',

  // what's new
  'Elige cómo ver tu distribución': 'Choose how to see your allocation',
  'En Ajustes → Distribución: Barra, Anillo o Lista. Toca una clase para ver solo sus activos.': 'In Settings → Allocation: Bar, Ring or List. Tap a class to see only its assets.',
  'Actívalo en Ajustes: la app pide tu cara al abrirla, y tu balance se difumina al salir de la app.': 'Turn it on in Settings: the app asks for your face when it opens, and your balance blurs when you leave the app.',
  'Sigue activos que aún no tienes: al añadir uno, toca «Solo seguir, sin comprar».': 'Follow assets you don’t own yet: when adding one, tap “Just follow, don’t buy”.',
  'Tus operaciones en el gráfico': 'Your trades on the chart', 'Tus compras y ventas aparecen como puntos; desliza el dedo encima para verlas.': 'Your buys and sales show as dots; slide your finger over them to see them.',
  'Versión 1.0': 'Version 1.0', 'Las versiones ahora van por número: 1.1, 1.2… y después de 1.9 llega la 2.0.': 'Versions now go by number: 1.1, 1.2… and after 1.9 comes 2.0.',
  'Fechas MM/DD/YYYY': 'Dates as MM/DD/YYYY', 'Todas las fechas se muestran como mes/día/año.': 'All dates show as month/day/year.',
  'Compras y ventas': 'Buys and sales', 'Registra cada operación con su fecha. El costo promedio y la ganancia realizada se calculan solos.': 'Record every trade with its date. Average cost and realized gain work themselves out.',
  'Dividendos e intereses': 'Dividends and interest', 'Anota dividendos y recompensas, y ponle a tu Cash la tasa de tu cuenta de ahorro: el interés se abona cada mes.': 'Record dividends and rewards, and give your Cash your savings rate: interest is added every month.',
  'Escribir cifras, más cómodo': 'Easier typing of amounts', 'Con el teclado abierto todo cabe en pantalla.': 'With the keyboard up, everything fits on screen.',
  'Inglés y español': 'English and Spanish', 'Tema claro u oscuro': 'Light or dark theme',
  'Elige el idioma en Ajustes → Idioma.': 'Choose the language in Settings → Language.',
  'Fíjalo en Ajustes → Tema, o deja que siga a tu iPhone.': 'Set it in Settings → Theme, or let it follow your iPhone.',
  'Tu meta, debajo del rendimiento': 'Your goal, below performance', 'El inicio queda más limpio: primero tus activos, luego cómo van y tu meta.': 'A cleaner home: your assets first, then how they are doing and your goal.',
  'Bloqueo de Portfolio': 'Portfolio lock',
  'Cada activo, con su cuenta': 'Every asset, with its sum', 'Debajo del nombre ves cantidad × precio, y a la derecha lo que vale lo tuyo.': 'Under the name you see quantity × price, and on the right what yours is worth.',
  'Tarjetas con profundidad': 'Cards with depth', 'Al tocar la meta, el rendimiento o la distribución, la tarjeta se inclina hacia tu dedo.': 'When you press the goal, performance or allocation, the card leans towards your finger.',
  'Tema Azul': 'Blue theme', 'Luz azul de fondo y tarjetas de vidrio. Actívalo en Ajustes → Tema → Azul.': 'Blue light behind and glass cards. Turn it on in Settings → Theme → Blue.',
  'Tu portfolio en vivo: crypto, acciones, metales y efectivo.': 'Your portfolio, live: crypto, stocks, metals and cash.',
  'del token PAXG': 'the PAXG token',
}));

// ---- sentences with numbers or names in them ---------------------------------------

// "2 años y 3 meses" → "2 years and 3 months"
const dur = s => s
  .replace(/(\d+) años?/g, (_, n) => `${n} ${n === '1' ? 'year' : 'years'}`)
  .replace(/(\d+) mes(es)?/g, (_, n) => `${n} ${n === '1' ? 'month' : 'months'}`)
  .replace(/ y /g, ' and ').replace(/^ya$/, 'now');
const tr = s => (EN.has(s) ? EN.get(s) : s);

const PATTERNS = [
  [/^hace (\d+) min$/, (_, n) => `${n} min ago`],
  [/^hace (\d+) h$/, (_, n) => `${n} h ago`],
  [/^(\d+) clases$/, (_, n) => `${n} classes`],
  [/^(\d+) (activo|activos)$/, (_, n) => `${n} ${n === '1' ? 'asset' : 'assets'}`],
  [/^desde (.+)$/, (_, d) => `since ${d}`],
  [/^Sin histórico: (.+)$/, (_, n) => `No history: ${n.replace(/ y (\d+) más$/, ' and $1 more').split(', ').map(tr).join(', ')}`],
  [/^Sin copia fuera del iPhone desde hace (\d+) días$/, (_, n) => `No copy outside your iPhone for ${n} days`],
  [/^Histórico aproximado a partir (.+)\.$/, (_, w) => `Approximate history from ${tr(w).replace(/^del ETF /, 'the ETF ')}.`],
  [/^(.+) eliminado$/, (_, n) => `${tr(n)} deleted`],
  [/^Dejaste de seguir (.+)$/, (_, n) => `Stopped following ${tr(n)}`],
  [/^Siguiendo (.+)$/, (_, n) => `Following ${tr(n)}`],
  [/^(.+) · Seguimiento$/, (_, s) => `${s} · Watchlist`],
  [/^(.+) · por oz troy$/, (_, s) => `${s} · per troy oz`],
  [/^(.+) · (Crypto|Acciones|Metales|Efectivo|Retiro|Otros)$/, (_, s, k) => `${s} · ${tr(k)}`],
  [/^Se suma a tu posición actual \((.+)\)\.$/, (_, q) => `Added to your current position (${q}).`],
  [/^Hoy (.+)$/, (_, p) => `Today ${p}`],
  [/^Vale (.+)$/, (_, v) => `Worth ${v}`],
  [/^Recibes (.+)$/, (_, v) => `You receive ${v}`],
  [/^Pagas (.+)$/, (_, v) => `You pay ${v}`],
  [/^En esa fecha tenías (.+)\.$/, (_, q) => `On that date you had ${q}.`],
  [/^Ganancia de esta venta: (.+)$/, (_, g) => `Gain on this sale: ${g}`],
  [/^(Compra|Venta|Dividendo|Recompensa|Interés|Depósito|Retiro|Posición inicial|Saldo inicial) (.+?)( · (.+))?$/, (_, k, rest, _t, d) => `${tr(k)} ${rest}${d ? ' · ' + d : ''}`],
  [/^≈ (.+) al mes · (.+) al año$/, (_, m, y) => `≈ ${m} a month · ${y} a year`],
  [/^Para que se mueva con el (.+) necesitas la llave de Finnhub \(Ajustes\)\. Mientras tanto queda fijo\.$/, (_, i) => `To follow the ${i} you need a Finnhub key (Settings). Until then it stays fixed.`],
  [/^Entre actualizaciones, el saldo se moverá como el (.+) \((.+)\)\. Actualízalo de vez en cuando con el de tu estado de cuenta\.$/, (_, i, s) => `Between updates, the balance moves with the ${i} (${s}). Update it now and then from your statement.`],
  [/^Saldo actualizado el (.+?)\. Desde entonces el (.+) (subió|bajó) (.+)\.$/, (_, d, i, v, p) => `Balance updated on ${d}. Since then the ${i} has ${v === 'subió' ? 'risen' : 'fallen'} ${p}.`],
  [/^Saldo actualizado el (.+)\.$/, (_, d) => `Balance updated on ${d}.`],
  [/^Próximo abono el (.+): unos (.+)\. Se suma solo al saldo cada mes\.$/, (_, d, v) => `Next credit on ${d}: about ${v}. It is added to the balance every month.`],
  [/^Versión (.+?)( · )?$/, (_, v, dot) => `Version ${v}${dot || ''}`],
  [/^Llegas en (.+)$/, (_, w) => `You get there in ${w}`],
  [/^en (.+)$/, (_, d) => `in ${dur(d)}`],
  [/^(.+) de (.+)$/, (_, a, b) => (/\d/.test(a) && /\d/.test(b) ? `${a} of ${b}` : null)],
  [/^¡Lo lograste! (.+): (.+)$/, (_, n, m) => `You made it! ${n}: ${m}`],
  [/^Nuevo hito: (.+)$/, (_, m) => `New milestone: ${m}`],
  [/^(.+) más al mes$/, (_, v) => `${v} more a month`],
  [/^llegas en (.+)\.$/, (_, d) => `you get there in ${dur(d)}.`],
  [/^llegas (.+) antes\.$/, (_, d) => `you get there ${dur(d)} sooner.`],
  [/^Para llegar en (\d+) años$/, (_, n) => `To get there in ${n} years`],
  [/^(.+) al mes$/, (_, v) => `${v} a month`],
  [/^(.+) % al año$/, (_, v) => `${v} % a year`],
  [/^Meta creada: (.+)$/, (_, n) => `Goal created: ${n}`],
  [/^Máximo (.+)$/, (_, d) => `High ${tr(d)}`],
  [/^Mínimo (.+)$/, (_, d) => `Low ${tr(d)}`],
  [/^Objetivo de (.+)$/, (_, k) => `Target for ${tr(k)}`],
  [/^ahora (.+)$/, (_, p) => `now ${p}`],
  [/^Suma (\d+) % · faltan (\d+)$/, (_, t, n) => `Adds up to ${t} % · ${n} to go`],
  [/^Suma (\d+) % · sobran (\d+)$/, (_, t, n) => `Adds up to ${t} % · ${n} over`],
  [/^(Comprar|Vender) (.+)$/, (_, k, v) => `${k === 'Comprar' ? 'Buy' : 'Sell'} ${v}`],
  // Last resort for "a · b" labels (account type · index): translate each side.
  [/^(.+) · (.+)$/, (_, a, b) => (EN.has(a) || EN.has(b) ? `${tr(a)} · ${tr(b)}` : null)],
];
EN.set('del día', 'of the day');
EN.set('Vender', 'Sell');

/** English for a Spanish text, or null when there is none. */
export function english(s) {
  // Text that follows a link or a bold part may start with ". " or ", ".
  const key = s.trim().replace(/^[.,;:]\s*/, '');
  if (!key) return null;
  if (EN.has(key)) return EN.get(key);
  for (const [re, fn] of PATTERNS) {
    if (!fn) continue;
    const m = key.match(re);
    if (m) { const out = fn(...m); if (out != null) return out; }
  }
  return null;
}

// ---- applying it --------------------------------------------------------------------

// Any letter at all: "1S" and "1A" (the chart ranges) have only one.
const LETTERS = /[A-Za-zÁÉÍÓÚÑáéíóúñ¿¡]/;
const ATTRS = ['aria-label', 'placeholder', 'title'];

function swapText(node) {
  const v = node.data;
  if (!LETTERS.test(v)) return;
  const en = english(v);
  if (en == null || en === v.trim()) return;
  const lead = v.match(/^[\s.,;:]*/)[0], tail = v.match(/\s*$/)[0];
  node.data = lead + en + tail;
}

function swapAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !LETTERS.test(v)) continue;
    const en = english(v);
    if (en != null && en !== v) el.setAttribute(a, en);
  }
}

function walk(root) {
  if (root.nodeType === 3) { swapText(root); return; }
  if (root.nodeType !== 1) return;
  if (root.closest && root.closest('[data-no-i18n], script, style')) return;
  swapAttrs(root); // inputs too: their placeholder and label, never what was typed
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === 3) swapText(n);
    else if (n.matches('script, style, textarea, [data-no-i18n]')) continue;
    else swapAttrs(n);
  }
}

/** Translate the page now and everything added to it from here on. */
export function startI18n() {
  document.documentElement.lang = LANG;
  if (!isEn) return;
  document.title = 'Portfolio';
  const desc = document.querySelector('meta[name="description"]');
  if (desc) { const en = english(desc.content); if (en) desc.content = en; }
  walk(document.body);
  new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') swapText(m.target);
      else if (m.type === 'attributes') swapAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
