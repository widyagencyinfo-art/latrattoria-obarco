/* La Trattoria · datos comunes de la portada (index.html) y de los pedidos (pedir.html):
   carta, horario, reparto y WhatsApp. Si cambia un precio o el horario, se cambia SOLO aquí. */
const WA = '34667754998'; // ⚠️ confirmar con Alfredo a qué número quiere los pedidos y reservas

/* ---------- reparto a domicilio · ⚠️ confirmar con Alfredo ----------
   envio: gastos de envío en € (null = «te lo confirmamos») · minimo: pedido mínimo en € (null = sin mínimo) */
const DOMICILIO = { zona: 'O Barco de Valdeorras', envio: null, minimo: null, pagos: ['Efectivo', 'Tarjeta', 'Bizum'] };

/* ---------- pedidos online: se guardan en la base de datos de Widy y Alfredo los ve en panel.html ----------
   La clave es la pública (solo deja crear pedidos y seguirlos; el resto pide el PIN del panel). */
const API_URL = 'https://kncmckkgurbjuisdqhdf.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuY21ja2tndXJianVpc2RxaGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODYyNzEsImV4cCI6MjA5NTM2MjI3MX0.39-22ThglIljBPDmWoM28V4jh2ZNGlR2uK_E_BLHv58';
async function api(fn, body = {}, ms = 9000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${API_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const wa = (txt) => `https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;
const euros = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/* ---------- horario (0 = domingo) · el de su cartel de Instagram ---------- */
const HORARIO = {
  1: [['18:30', '23:30']], 2: [], 3: [['18:30', '23:30']], 4: [['18:30', '23:30']], 5: [['18:30', '23:30']],
  6: [['13:00', '15:30'], ['18:30', '24:00']], 0: [['13:00', '15:30'], ['18:30', '24:00']],
};
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const bonita = (h) => (h === '24:00' ? '00:00' : h);

// hora de O Barco, esté donde esté quien mire
function ahoraMadrid() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { dia, min: (+p.hour % 24) * 60 + +p.minute, fecha: new Date(+p.year, +p.month - 1, +p.day) };
}

function estado() {
  const { dia, min } = ahoraMadrid();
  for (const [a, c] of HORARIO[dia]) {
    if (min >= aMin(a) && min < aMin(c)) {
      const falta = aMin(c) - min;
      return falta <= 45
        ? { abierto: true, txt: `Abierto · cierra en ${falta} min`, corto: `Cierra en ${falta} min` }
        : { abierto: true, txt: `Abierto ahora · hasta las ${bonita(c)}`, corto: `Abierto ahora` };
    }
  }
  const luego = HORARIO[dia].find(([a]) => aMin(a) > min);
  if (luego) return { abierto: false, txt: `Cerrado · abrimos a las ${luego[0]}`, corto: `Abre a las ${luego[0]}` };
  for (let i = 1; i <= 7; i++) {
    const d = (dia + i) % 7;
    if (HORARIO[d].length) {
      const cuando = i === 1 ? 'mañana' : 'el ' + DIAS[d].toLowerCase();
      return { abierto: false, txt: `Cerrado · abrimos ${cuando} a las ${HORARIO[d][0][0]}`, corto: `Abre ${cuando} ${HORARIO[d][0][0]}` };
    }
  }
}

/* ---------- carta ----------
   Precios e ingredientes: su carta actual (foto que mandó Alfredo el 14-oct-2026).
   p: null = plato sin precio en la carta → se pide igual y el precio se confirma por WhatsApp. */
const CATS = [
  { id: 'pizzas', nombre: 'Pizzas', nota: 'Mediana · Familiar' },
  { id: 'focaccias', nombre: 'Focaccias', nota: 'La especialidad' },
  { id: 'pastas', nombre: 'Pasta y lasaña', nota: 'Y además…' },
  { id: 'tablas', nombre: 'Tablas', nota: 'Para compartir' },
  { id: 'postres', nombre: 'Postres', nota: 'Dolci' },
];
const P = (n, d, m, f, img, t) => ({ c: 'pizzas', n, d, m, f, img, t });
const CARTA = [
  P('Regina Margherita', 'Mozzarella, tomate y aceitunas.', 7.8, 13.8, 'margherita-caja'),
  P('Romana', 'Mozzarella, tomate, jamón york y aceitunas.', 8.8, 15.9, null),
  P('Calabresa', 'Mozzarella, tomate, champiñones, jamón york y aceitunas.', 9.3, 16.2, null),
  P('San Daniele', 'Mozzarella, tomate, jamón serrano y aceitunas.', 9.9, 16.8, null),
  P('Vegetal', 'Mozzarella, tomate, pimiento rojo, champiñones, espárragos y aceitunas.', 9.3, 16.5, null, ['Veggie']),
  P('Tropical', 'Mozzarella, tomate, jamón york y piña.', 9.8, 17.8, null),
  P('Cuatro estaciones', 'Mozzarella, tomate, jamón york, pimientos, champiñones, salchichón y aceitunas.', 9.5, 17.8, null),
  P('Corleone', 'Mozzarella, tomate, salchichón, chorizo, beicon y aceitunas.', 9.8, 16.8, null),
  P('Capricciosa', 'Mozzarella, tomate, salchichón, beicon, champiñones y aceitunas.', 10, 18.2, null),
  P('Bolognese', 'Mozzarella, tomate y salsa boloñesa.', 10.8, 18.9, null),
  P('Barbacoa', 'Mozzarella, tomate, salsa barbacoa y carne picada.', 10.8, 18.9, null),
  P('Trattoria', 'Mozzarella, tomate, jamón york, champiñones, pimientos, espárragos, huevo y aceitunas.', 10.9, 18.8, null, ['La de la casa']),
  P('Marinera', 'Mozzarella, tomate, gambas, anchoas, palitos de cangrejo y atún.', 10.9, 18.8, null),
  P('Cuatro quesos', 'Mozzarella, queso azul, parmigiano y emmental.', 11, 19, 'cuatro-quesos'),
  P('Salmón', 'Mozzarella, tomate, salmón y alcaparras.', 12, 19.9, null),
  P('Carbonara', 'Mozzarella, tomate, nata, beicon y trozos de parmigiano.', 11, 18.8, null, ['Muy pedida']),
  P('Napolitana', 'Mozzarella, tomate, anchoas, cebolla y aceitunas.', 9.3, 16.5, null),
  P('Peperoni', 'Mozzarella, tomate, peperoni y aceitunas.', 9.3, 16.5, null),
  P('Diávola', 'Mozzarella, tomate, salchichón picante y aceitunas.', 9, 16, null, ['Picante']),
  P('Tarantina', 'Mozzarella, tomate, salchicha, pimiento y aceitunas.', 9.8, 16.3, null),
  P('Pomodorini', 'Mozzarella, tomate, tomatitos y rúcula.', 9, 16.5, null),
  P('Atún', 'Mozzarella, tomate, atún y aceitunas.', 9, 16.5, null),
  P('Pollo', 'Mozzarella, tomate, pollo, champiñones y nata.', 10, 18.8, 'pizza-pollo'),
  P('Calzone', 'Cerrada y dorada al horno: mozzarella, tomate, jamón york y un ingrediente a elegir.', 9.5, 16.8, null, ['Clásica']),
  { c: 'pizzas', n: 'Vegana', d: 'Tomate, queso vegano, champiñones, pimientos y espárragos.', p: 11, img: null, t: ['Especial'] },
  { c: 'focaccias', n: 'Focaccia rústica', d: 'Jamón, queso y tomate.', p: 14.5, img: null, t: ['La favorita'] },
  { c: 'focaccias', n: 'Focaccia campestre', d: 'Salchichón, beicon y tomate en rodajas.', p: 15.7, img: null },
  { c: 'focaccias', n: 'Focaccia cuatro quesos', d: 'Mozzarella, queso azul, parmigiano y emmental.', p: 16.5, img: 'focaccia-cuatro-quesos' },
  { c: 'focaccias', n: 'Focaccia barbacoa', d: 'Carne picada, salsa barbacoa y orégano.', p: 16.5, img: null },
  { c: 'focaccias', n: 'Focaccia galega', d: 'Chorizo casero, mozzarella y tomate.', p: 16, img: null },
  { c: 'focaccias', n: 'Focaccia nuggets', d: 'Mozzarella, tomate y nuggets. La de los peques.', p: 15, img: null },
  { c: 'focaccias', n: 'Focaccia carbonara', d: 'Mozzarella, tomate, beicon, parmigiano y nata.', p: 17, img: null },
  { c: 'pastas', n: 'Gnocchi con burrata', d: 'Pesto genovés, tomate italiano y burrata cremosa en el centro.', p: null, img: 'gnocchi-burrata', t: ['Novedad'] },
  { c: 'pastas', n: 'Spaghetti carbonara', d: 'Con beicon y lluvia de parmigiano.', p: null, img: 'spaghetti-carbonara' },
  { c: 'pastas', n: 'Spaghetti boloñesa', d: 'Con nuestra salsa boloñesa.', p: null, img: null },
  { c: 'pastas', n: 'Lasaña', d: 'Cremosa, tradicional e irresistible.', p: null, img: null },
  { c: 'tablas', n: 'Tabla de embutidos', d: 'Perfecta para compartir.', p: null, img: null },
  { c: 'tablas', n: 'Tabla de quesos', d: 'Perfecta para compartir.', p: null, img: null },
  { c: 'tablas', n: 'Tabla mixta', d: 'Embutidos y quesos.', p: null, img: null },
  { c: 'postres', n: 'Pannacotta', d: '', p: 3.9, img: null },
  { c: 'postres', n: 'Tiramisú', d: '', p: 4.9, img: null },
];
CARTA.forEach((x, i) => { x.id = i; });
