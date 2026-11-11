/* La Trattoria · página de pedidos (pedir.html). La carta, el horario y el reparto vienen de datos.js */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = DOMICILIO;
  const DESTACADOS = ['Cuatro quesos', 'Focaccia cuatro quesos', 'Regina Margherita', 'Pollo', 'Spaghetti carbonara', 'Gnocchi con burrata'];
  // inicial para los platos sin foto (sin «Focaccia», «Spaghetti», «Tabla de»…)
  const inicial = (x) => x.n.replace(/^(focaccia|spaghetti|tabla de|tabla)\s+/i, '').charAt(0).toUpperCase();
  const monograma = (x, cls) => `<span class="${cls} mono mono-${x.c}" aria-hidden="true"><span>${inicial(x)}</span></span>`;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tamanos = (x) => (x.m != null ? [['m', 'Mediana', 'Perfecta para uno', x.m], ...(x.f != null ? [['f', 'Familiar', 'Para compartir entre dos', x.f]] : [])] : []);
  const precioDe = (x, tam) => (tam === 'm' ? x.m : tam === 'f' ? x.f : x.p);
  const nombreDe = (x, tam) => x.n + (tam === 'm' ? ' (mediana)' : tam === 'f' ? ' (familiar)' : '');
  const desdeTxt = (x) => (x.m != null ? (x.f != null ? `${euros(x.m)} <small>· familiar ${euros(x.f)}</small>` : euros(x.m)) : x.p != null ? euros(x.p) : '<small>Precio al confirmar</small>');

  /* ---------- estado y datos de entrega ---------- */
  function pintarEstado() {
    const e = estado();
    $$('[data-estado]').forEach((el) => { el.classList.toggle('abierto', e.abierto); el.classList.toggle('cerrado', !e.abierto); el.querySelector('span').textContent = e.txt; });
  }
  pintarEstado(); setInterval(pintarEstado, 60000);
  $('[data-envio-corto]').textContent = D.envio == null ? 'Envío a confirmar' : `Envío ${euros(D.envio)}`;
  $('[data-minimo-corto]').textContent = D.minimo ? `Pedido mínimo ${euros(D.minimo)}` : 'O Barco y alrededores';
  $('[data-nota-envio]').textContent = D.envio == null ? `Repartimos en ${D.zona} y alrededores. Los gastos de envío te los confirmamos con el pedido.` : `Repartimos en ${D.zona}. Envío: ${euros(D.envio)}.`;

  /* ---------- carta ---------- */
  const menu = $('[data-menu]');
  const cats = $('[data-cats]');
  const fila = (x) => {
    const tags = (x.t || []).map((t) => `<span class="etiq${/novedad|picante/i.test(t) ? ' roja' : ''}">${t}</span>`).join(' ');
    const foto = x.img
      ? `<span class="producto-foto"><img src="img/${x.img}-sm.webp" alt="" loading="lazy"><span class="mas" data-mas="${x.id}" aria-hidden="true">+</span></span>`
      : `<span class="producto-foto mono mono-${x.c}"><span class="mono-letra" aria-hidden="true">${inicial(x)}</span><span class="mas" data-mas="${x.id}" aria-hidden="true">+</span></span>`;
    return `<button type="button" class="producto" data-id="${x.id}" data-busca="${norm(x.n + ' ' + x.d)}" aria-label="${x.n}, ver y añadir">
      <span class="producto-txt">${tags ? `<span>${tags}</span>` : ''}<b>${x.n}</b>${x.d ? `<p>${x.d}</p>` : ''}<span class="producto-precio">${desdeTxt(x)}</span><span class="agot">Agotado hoy</span></span>${foto}</button>`;
  };
  const destacados = DESTACADOS.map((n) => CARTA.find((x) => x.n === n)).filter(Boolean);
  let html = `<section class="sec-menu" id="sec-destacados" data-sec><h2>Lo más pedido</h2><p class="sub">Lo que más repiten nuestros clientes</p><div class="carrusel">${destacados.map((x) => `
    <button type="button" class="tarjeta" data-id="${x.id}" aria-label="${x.n}, ver y añadir"><span class="tarjeta-foto">${x.img ? `<img src="img/${x.img}-sm.webp" alt="" loading="lazy">` : ''}<span class="popular">Popular</span><span class="mas" data-mas="${x.id}" aria-hidden="true">+</span></span><b>${x.n}</b><span class="precio">${x.m != null ? euros(x.m) : x.p != null ? euros(x.p) : 'Precio al confirmar'}</span></button>`).join('')}</div></section>`;
  CATS.forEach((c) => {
    const items = CARTA.filter((x) => x.c === c.id);
    html += `<section class="sec-menu" id="sec-${c.id}" data-sec><h2>${c.nombre} <span class="cuenta">${items.length}</span></h2><p class="sub">${c.id === 'pizzas' ? 'Mediana o familiar · combinamos ingredientes a tu gusto' : c.nota}</p><div class="productos">${items.map(fila).join('')}</div></section>`;
  });
  menu.innerHTML = html + '<p class="sin-resultados" data-sin hidden></p>';
  cats.innerHTML = [['destacados', 'Lo más pedido'], ...CATS.map((c) => [c.id, c.nombre])].map(([id, n]) => `<a href="#sec-${id}" data-cat="${id}">${n}</a>`).join('');

  /* ---------- lo que Alfredo cambia desde su panel: pausa, tiempo de espera y platos agotados ---------- */
  let CONF = { pausado: false, espera: 40, agotados: [] };
  const agotado = (x) => CONF.agotados.includes(x.n);
  function aplicarConf() {
    $('[data-pausa]').hidden = !CONF.pausado;
    $('[data-tiempo]').textContent = `Listo en ~${CONF.espera} min`;
    $$('[data-id]', menu).forEach((el) => el.classList.toggle('agotado', agotado(CARTA[+el.dataset.id])));
    [...pedido.keys()].forEach((k) => { if (agotado(CARTA[+k.split('|')[0]])) pedido.delete(k); });
    pintar();
  }
  const cargarConf = () => api('trattoria_config').then((c) => { if (c) { CONF = { ...CONF, ...c }; aplicarConf(); } }).catch(() => {});

  // pestaña activa según lo que se ve
  const marcar = (id) => {
    $$('a', cats).forEach((a) => a.classList.toggle('on', a.dataset.cat === id));
    const a = $(`[data-cat="${id}"]`, cats);
    if (a) cats.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
  };
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) marcar(e.target.id.replace('sec-', '')); });
  }, { rootMargin: '-130px 0px -65% 0px' });
  $$('[data-sec]').forEach((s) => io.observe(s));
  marcar('destacados');

  // buscador
  $('[data-buscar]').addEventListener('input', (e) => {
    const q = norm(e.target.value.trim());
    let hay = 0;
    $('#sec-destacados').hidden = !!q;
    $$('.sec-menu').forEach((s) => {
      if (s.id === 'sec-destacados') return;
      let n = 0;
      $$('.producto', s).forEach((p) => { const ok = !q || p.dataset.busca.includes(q); p.hidden = !ok; n += ok; });
      s.hidden = !n; hay += n;
    });
    const sin = $('[data-sin]');
    sin.hidden = !!hay;
    sin.textContent = `No encontramos «${e.target.value}». Escríbelo en la nota del pedido: combinamos ingredientes a tu gusto.`;
  });

  /* ---------- pedido ---------- */
  const pedido = new Map(); // "id|tam" → cantidad
  let modo = 'domicilio';
  let pago = D.pagos[0];
  const clave = (id, tam) => `${id}|${tam}`;
  const toastEl = $('[data-toast]');
  let tt;
  const toast = (t) => { toastEl.textContent = t; toastEl.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toastEl.hidden = true; }, 1600); };

  function anadir(x, tam, cant) {
    const k = clave(x.id, tam);
    pedido.set(k, (pedido.get(k) || 0) + cant);
    pintar();
    toast(`✓ Añadido: ${cant > 1 ? cant + ' × ' : ''}${nombreDe(x, tam)}`);
    $$(`[data-mas="${x.id}"]`, menu).forEach((m) => { m.classList.remove('late'); void m.offsetWidth; m.classList.add('late'); });
    const bar = $('[data-ver-pedido]'); bar.classList.remove('pop'); void bar.offsetWidth; bar.classList.add('pop');
  }

  // clic en un plato (o en su +)
  menu.addEventListener('click', (e) => {
    const el = e.target.closest('[data-id]');
    if (!el) return;
    const x = CARTA[+el.dataset.id];
    if (agotado(x)) { toast(`Hoy no nos queda ${x.n}. ¡Mañana más!`); return; }
    const rapido = e.target.closest('[data-mas]') && !tamanos(x).length;
    if (rapido) anadir(x, 'u', 1); else abrirHoja(x);
  });

  /* ---------- ficha de producto ---------- */
  const hoja = $('[data-hoja]'), velo = $('[data-velo]');
  let H = null;
  function abrirHoja(x) {
    H = { x, tam: tamanos(x).length ? 'm' : 'u', cant: 1 };
    $('[data-hoja-foto]').innerHTML = x.img ? `<img src="img/${x.img}.webp" alt="${x.n}">` : monograma(x, 'hoja-mono');
    $('[data-hoja-nombre]').textContent = x.n;
    $('[data-hoja-desc]').textContent = x.d || '';
    const ops = tamanos(x);
    $('[data-hoja-tam]').hidden = !ops.length;
    $('[data-hoja-ops]').innerHTML = ops.map(([t, n, sub, p]) => `<label class="opcion"><input type="radio" name="tam" value="${t}" ${t === 'm' ? 'checked' : ''}><span><b>${n}</b><small>${sub}</small></span><b>${euros(p)}</b></label>`).join('');
    pintarHoja();
    hoja.hidden = false; velo.hidden = false; document.body.classList.add('bloqueo');
  }
  function cerrarHoja() { hoja.hidden = true; velo.hidden = true; if (!$('[data-carrito]').classList.contains('abierto')) document.body.classList.remove('bloqueo'); }
  function pintarHoja() {
    const p = precioDe(H.x, H.tam);
    $('[data-hoja-cant]').textContent = H.cant;
    $('[data-hoja-precio]').textContent = p == null ? '' : euros(p * H.cant);
  }
  $('[data-hoja-ops]').addEventListener('change', (e) => { H.tam = e.target.value; pintarHoja(); });
  $('[data-hoja-mas]').addEventListener('click', () => { H.cant++; pintarHoja(); });
  $('[data-hoja-menos]').addEventListener('click', () => { H.cant = Math.max(1, H.cant - 1); pintarHoja(); });
  $('[data-hoja-anadir]').addEventListener('click', () => { anadir(H.x, H.tam, H.cant); cerrarHoja(); });
  $('[data-hoja-cerrar]').addEventListener('click', cerrarHoja);
  velo.addEventListener('click', cerrarHoja);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !hoja.hidden) cerrarHoja(); });

  /* ---------- carrito ---------- */
  const carrito = $('[data-carrito]');
  $('[data-ver-pedido]').addEventListener('click', () => { carrito.classList.add('abierto'); document.body.classList.add('bloqueo'); });
  $$('[data-cerrar-carrito]').forEach((b) => b.addEventListener('click', () => { carrito.classList.remove('abierto'); document.body.classList.remove('bloqueo'); }));

  $('[data-lineas]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, c = (pedido.get(k) || 0) + (+b.dataset.d);
    c > 0 ? pedido.set(k, c) : pedido.delete(k);
    pintar();
  });

  $$('[data-modo]').forEach((b) => b.addEventListener('click', () => {
    modo = b.dataset.modo;
    $$('[data-modo]').forEach((o) => o.setAttribute('aria-pressed', o.dataset.modo === modo));
    $('[data-error]').textContent = '';
    pintar();
  }));

  const pagosEl = $('[data-pagos]');
  pagosEl.innerHTML = D.pagos.map((x) => `<button type="button" data-pago="${x}" aria-pressed="${x === pago}">${x}</button>`).join('');
  pagosEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pago]'); if (!b) return;
    pago = b.dataset.pago;
    $$('[data-pago]', pagosEl).forEach((o) => o.setAttribute('aria-pressed', o === b));
    pintar();
  });

  // horas: lo antes posible + franjas de hoy (o del próximo día que abrimos)
  const selHora = $('[data-f="hora"]');
  (function horas() {
    const { dia, min } = ahoraMadrid();
    const opts = ['Lo antes posible'];
    let d = dia, salto = 0;
    const slots = (dd, desde) => HORARIO[dd].flatMap(([a, c]) => { const out = []; for (let m = Math.max(aMin(a) + 30, desde); m <= aMin(c) - 15; m += 15) out.push(m); return out; });
    let s = slots(d, Math.ceil((min + 30) / 15) * 15);
    while (!s.length && salto < 7) { salto++; d = (dia + salto) % 7; s = slots(d, 0); }
    const pref = salto === 0 ? 'Hoy' : salto === 1 ? 'Mañana' : DIAS[d];
    s.forEach((m) => opts.push(`${pref} a las ${hhmm(m)}`));
    selHora.innerHTML = opts.map((o) => `<option>${o}</option>`).join('');
  })();

  // nombre, teléfono y dirección se recuerdan en este móvil para el siguiente pedido
  const GUARDA = ['nombre', 'tel', 'dir'];
  const val = (k) => $(`[data-f="${k}"]`).value.trim();
  try { const g = JSON.parse(localStorage.getItem('trattoria-datos') || '{}'); GUARDA.forEach((k) => { if (g[k]) $(`[data-f="${k}"]`).value = g[k]; }); } catch (e) { /* sin almacenamiento */ }
  const guardar = () => { try { localStorage.setItem('trattoria-datos', JSON.stringify(Object.fromEntries(GUARDA.map((k) => [k, val(k)])))); } catch (e) { /* nada */ } };
  $$('[data-f]').forEach((i) => i.addEventListener('input', () => { i.classList.remove('mal'); pintar(); }));
  selHora.addEventListener('change', pintar);

  function cuentas() {
    let n = 0, sub = 0, sinPrecio = false;
    pedido.forEach((c, k) => { const [id, tam] = k.split('|'); const p = precioDe(CARTA[+id], tam); n += c; if (p == null) sinPrecio = true; else sub += c * p; });
    const envio = modo === 'domicilio' && D.envio ? D.envio : 0;
    return { n, sub, sinPrecio, total: sub + envio };
  }

  function pintar() {
    const { n, sub, sinPrecio, total } = cuentas();
    const casa = modo === 'domicilio';
    // líneas
    $('[data-lineas]').innerHTML = [...pedido].map(([k, c]) => {
      const [id, tam] = k.split('|'); const x = CARTA[+id]; const p = precioDe(x, tam);
      return `<li class="linea">${x.img ? `<img class="linea-foto" src="img/${x.img}-sm.webp" alt="">` : monograma(x, 'linea-foto')}<span class="linea-txt"><b>${x.n}</b><small>${tam === 'm' ? 'Mediana · ' : tam === 'f' ? 'Familiar · ' : ''}${p == null ? 'precio al confirmar' : euros(p * c)}</small></span>
        <span class="cantidad"><button type="button" data-k="${k}" data-d="-1" aria-label="Quitar uno">−</button><b>${c}</b><button type="button" data-k="${k}" data-d="1" aria-label="Añadir uno">+</button></span></li>`;
    }).join('');
    $('[data-vacio]').hidden = n > 0;
    $$('.mas-cosas').forEach((b) => { b.hidden = !n; });
    // marcas de «ya en el pedido» en la carta
    const porId = {}; pedido.forEach((c, k) => { const id = k.split('|')[0]; porId[id] = (porId[id] || 0) + c; });
    $$('[data-mas]', menu).forEach((m) => { const c = porId[m.dataset.mas]; m.textContent = c || '+'; m.classList.toggle('en-pedido', !!c); });
    // entrega y pago
    $('[data-dir-wrap]').hidden = !casa;
    $('[data-nota-envio]').hidden = !casa;
    $('[data-nota-recoger]').hidden = casa;
    $('[data-pago-bloque]').hidden = !casa;
    $('[data-pago-local]').hidden = casa;
    $('[data-enviar-sub]').textContent = casa ? 'Pagas al repartidor al recibirlo' : 'Pagas en el local al recogerlo';
    $('[data-como-2t]').textContent = casa ? 'Te lo llevamos' : 'Lo recoges';
    $('[data-como-2]').textContent = casa ? 'y lo sigues en directo' : 'te avisamos al estar listo';
    $('[data-cambio-wrap]').hidden = !(casa && pago === 'Efectivo');
    // resumen
    const tot = euros(total) + (casa && D.envio == null ? ' + envío' : '');
    $('[data-subtotal]').textContent = euros(sub) + (sinPrecio ? ' + pasta/tablas' : '');
    $('[data-fila-envio]').hidden = !casa;
    $('[data-envio]').textContent = D.envio == null ? 'A confirmar' : euros(D.envio);
    $('[data-total]').textContent = tot;
    $('[data-total-boton]').textContent = euros(total);
    $('[data-aviso-precio]').hidden = !sinPrecio;
    $('[data-ver-n]').textContent = n;
    $('[data-ver-total]').textContent = euros(total);
    $('[data-ver-pedido]').hidden = !n;
    document.body.classList.toggle('con-pedido', n > 0);
    $('[data-enviar]').classList.toggle('apagado', !n);
    if (!n && innerWidth < 960 && carrito.classList.contains('abierto')) { /* se queda abierto con el aviso de vacío */ }
    enlace();
  }

  let textoWA = '';
  function enlace() {
    const { sub, sinPrecio, total } = cuentas();
    const casa = modo === 'domicilio';
    const lineas = [...pedido].map(([k, c]) => { const [id, tam] = k.split('|'); return `• ${c} × ${nombreDe(CARTA[+id], tam)}`; }).join('\n');
    const txt = [
      `¡Hola, La Trattoria! Quiero hacer un pedido ${casa ? 'A DOMICILIO' : 'para RECOGER en el local'}:`,
      lineas,
      `Total aprox.: ${euros(casa && D.envio ? total : sub)}${casa && D.envio ? ' (envío incluido)' : casa ? ' + envío' : ''}${sinPrecio ? ' + la pasta/tabla (decidme el precio)' : ''}`,
      '',
      `• Para: ${selHora.value.toLowerCase()}`,
      casa ? `• Dirección: ${val('dir')}` : null,
      `• Nombre: ${val('nombre')}`,
      `• Teléfono: ${val('tel')}`,
      casa ? `• Pago: ${pago.toLowerCase()}${pago === 'Efectivo' && val('cambio') ? ` (pago con ${val('cambio')})` : ''}` : null,
      val('nota') ? `• Nota: ${val('nota')}` : null,
      '',
      '¿Me lo confirmáis? Gracias.',
    ].filter((l) => l !== null).join('\n');
    textoWA = txt;
  }

  /* ---------- hacer el pedido: se guarda en el panel de Alfredo y se sigue en directo ---------- */
  let enviando = false;
  $('[data-enviar]').addEventListener('click', async () => {
    if (enviando) return;
    const err = $('[data-error]');
    const casa = modo === 'domicilio';
    const { n, sub, sinPrecio } = cuentas();
    if (CONF.pausado) { err.textContent = 'Ahora mismo no aceptamos pedidos online. Llámanos al 988 32 63 21.'; return; }
    if (!n) { err.textContent = 'Añade algo de la carta para hacer el pedido.'; return; }
    const faltan = [...(casa ? ['dir'] : []), 'nombre', 'tel'].filter((k) => !val(k) || (k === 'tel' && val(k).replace(/\D/g, '').length < 9));
    GUARDA.forEach((k) => $(`[data-f="${k}"]`).classList.toggle('mal', faltan.includes(k)));
    if (faltan.length) {
      const nombres = { nombre: 'tu nombre', tel: 'un teléfono', dir: 'la dirección' };
      err.textContent = `Falta ${faltan.map((k) => nombres[k]).join(', ').replace(/, ([^,]*)$/, ' y $1')} para poder ${casa ? 'llevártelo' : 'preparártelo'}.`;
      $(`[data-f="${faltan[0]}"]`).focus();
      return;
    }
    if (casa && D.minimo && sub < D.minimo) { err.textContent = `El pedido mínimo a domicilio es de ${euros(D.minimo)}.`; return; }
    err.textContent = '';
    guardar();
    const datos = {
      modo, nombre: val('nombre'), tel: val('tel'), dir: casa ? val('dir') : '', hora: selHora.value,
      pago: casa ? pago : 'En el local', cambio: casa && pago === 'Efectivo' ? val('cambio') : '', nota: val('nota'),
      lineas: [...pedido].map(([k, c]) => { const [id, tam] = k.split('|'); const x = CARTA[+id]; return { n: x.n, tam: tam === 'u' ? '' : tam, c, p: precioDe(x, tam) }; }),
      subtotal: sub, envio: casa ? D.envio : null, sin_precio: sinPrecio,
    };
    enviando = true;
    const boton = $('[data-enviar]');
    boton.classList.add('cargando'); $('[data-enviar-txt]').textContent = 'Enviando…';
    let r = null;
    try { r = await api('trattoria_crear_pedido', { p: datos }); } catch (e) { r = null; }
    enviando = false;
    boton.classList.remove('cargando'); $('[data-enviar-txt]').textContent = 'Hacer pedido';
    if (r && r.codigo) {
      const ult = { codigo: r.codigo, token: r.token, num: r.num, modo, nombre: datos.nombre, desde: Date.now(), espera: r.espera };
      try { localStorage.setItem('trattoria-ultimo', JSON.stringify(ult)); } catch (e) { /* nada */ }
      pedido.clear(); pintar();
      carrito.classList.remove('abierto');
      abrirSeguir(ult, { estado: 'nuevo', num: r.num, modo });
      return;
    }
    if (r && r.error === 'pausado') { CONF.pausado = true; aplicarConf(); err.textContent = 'Ahora mismo no aceptamos pedidos online. Llámanos al 988 32 63 21.'; return; }
    if (r && r.error === 'muchos') { err.textContent = 'Ya nos han llegado varios pedidos desde este teléfono. Llámanos si necesitas algo más.'; return; }
    if (r && r.error === 'telefono') { $('[data-f="tel"]').classList.add('mal'); err.textContent = 'Revisa el teléfono: necesitamos uno de 9 cifras.'; return; }
    // sin conexión con el panel: que el pedido no se pierda, va por WhatsApp
    abrirSeguir(null, { estado: 'whatsapp' });
  });

  /* ---------- seguimiento del pedido ---------- */
  const seguir = $('[data-seguir]');
  let SEG = null, segTimer = null;
  const PASOS_CASA = [['nuevo', 'Pedido enviado'], ['aceptado', 'Confirmado · en el horno'], ['en_camino', 'De camino a tu casa'], ['entregado', 'Entregado']];
  const PASOS_LOCAL = [['nuevo', 'Pedido enviado'], ['aceptado', 'Confirmado · en el horno'], ['listo', 'Listo para recoger'], ['entregado', 'Recogido']];
  const horaDe = (iso, mas) => { const d = new Date(new Date(iso).getTime() + (mas || 0) * 60000); return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }); };

  function pintarSeguir(e) {
    const casa = (e.modo || SEG?.modo) === 'domicilio';
    const num = e.num || SEG?.num;
    const ico = $('[data-seguir-icono]'), tit = $('[data-seguir-tit]'), sub = $('[data-seguir-sub]');
    $('[data-seguir-num]').textContent = num ? `Pedido nº ${num}` : '';
    $('[data-seguir-ayuda]').hidden = true;
    $('[data-seguir-pie]').hidden = e.estado === 'whatsapp';
    let waTxt = num ? `Hola, La Trattoria. Os escribo por mi pedido nº ${num}${SEG?.nombre ? ' (a nombre de ' + SEG.nombre + ')' : ''}.` : textoWA;
    $('[data-seguir-wa-txt]').textContent = 'Escribir por WhatsApp';
    const llega = e.aceptado_en && e.minutos ? horaDe(e.aceptado_en, e.minutos) : null;
    const t = {
      nuevo: ['🍕', '¡Pedido enviado!', 'Ya lo tenemos en el restaurante. En un momento lo confirmamos y te decimos la hora.'],
      aceptado: ['👨‍🍳', 'Confirmado, ¡al horno!', llega ? (casa ? `Llega a tu casa sobre las <b>${llega}</b>.` : `Estará listo sobre las <b>${llega}</b>.`) : 'Lo estamos preparando.'],
      listo: casa ? ['📦', 'Listo, sale ya', 'Tu pedido sale ahora mismo del horno.'] : ['✅', '¡Listo para recoger!', 'Te esperamos en <b>Rúa San Mauro, 29</b>.'],
      en_camino: ['🛵', 'De camino', 'El repartidor va hacia tu casa. ¡Prepara la mesa!'],
      entregado: ['😋', '¡Que aproveche!', casa ? 'Pedido entregado. Gracias por pedir directo al restaurante.' : 'Gracias por pedir directo al restaurante.'],
      rechazado: ['😔', 'No podemos atender tu pedido', (e.motivo ? `Motivo: <b>${e.motivo}</b>. ` : '') + 'Llámanos y buscamos una solución.'],
      whatsapp: ['📲', 'Último paso: envíalo por WhatsApp', 'No hemos podido enviarlo desde aquí. Pulsa el botón verde: se abre WhatsApp con tu pedido ya escrito.'],
    }[e.estado] || ['🍕', 'Tu pedido', ''];
    ico.textContent = t[0]; tit.textContent = t[1]; sub.innerHTML = t[2];
    if (e.estado === 'whatsapp') { waTxt = textoWA; $('[data-seguir-wa-txt]').textContent = 'Enviar pedido por WhatsApp'; }
    $('[data-seguir-wa]').href = wa(waTxt);
    $('[data-seguir-wa]').classList.toggle('principal', e.estado === 'whatsapp' || e.estado === 'rechazado');
    // pasos
    const pasos = casa ? PASOS_CASA : PASOS_LOCAL;
    const est = e.estado === 'listo' && casa ? 'aceptado' : e.estado;
    const i = pasos.findIndex(([k]) => k === est);
    $('[data-pasos]').hidden = i < 0;
    $('[data-pasos]').innerHTML = pasos.map(([, n], j) => `<li class="${j < i ? 'hecho' : j === i ? 'ahora' : ''}"><i></i><span>${n}</span></li>`).join('');
    // si en 8 minutos nadie lo ha confirmado, que el cliente tenga a mano llamar
    if (e.estado === 'nuevo' && SEG && Date.now() - SEG.desde > 8 * 60000) $('[data-seguir-ayuda]').hidden = false;
    pintarEnCurso(e);
  }

  async function refrescarSeguir() {
    if (!SEG) return;
    try {
      const e = await api('trattoria_seguir', { c: SEG.codigo, tk: SEG.token });
      if (e) { SEG.ultimo = e; pintarSeguir(e); if (['entregado', 'rechazado'].includes(e.estado)) clearInterval(segTimer); }
    } catch (er) { /* sin red: se reintenta */ }
  }

  function abrirSeguir(ult, e) {
    if (ult) SEG = ult;
    seguir.hidden = false; document.body.classList.add('bloqueo');
    pintarSeguir(e || SEG.ultimo || { estado: 'nuevo' });
    clearInterval(segTimer);
    if (SEG && e?.estado !== 'whatsapp') { refrescarSeguir(); segTimer = setInterval(() => { if (!document.hidden) refrescarSeguir(); }, 8000); }
  }
  $('[data-seguir-cerrar]').addEventListener('click', () => { seguir.hidden = true; document.body.classList.remove('bloqueo'); });

  // barrita de arriba con el pedido en curso
  function pintarEnCurso(e) {
    const b = $('[data-en-curso]');
    const vivo = SEG && e && !['entregado', 'rechazado', 'whatsapp'].includes(e.estado);
    b.hidden = !vivo;
    if (vivo) {
      const txt = { nuevo: 'enviado, esperando confirmación', aceptado: 'confirmado, en el horno', listo: SEG.modo === 'domicilio' ? 'sale ya' : 'listo para recoger', en_camino: 'de camino' }[e.estado] || '';
      $('[data-en-curso-txt]').textContent = `Tu pedido nº ${SEG.num}: ${txt}`;
    }
  }
  $('[data-en-curso]').addEventListener('click', () => abrirSeguir(null, null));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (SEG) refrescarSeguir(); cargarConf(); } });

  // ¿hay un pedido de hoy sin terminar en este móvil?
  try {
    const u = JSON.parse(localStorage.getItem('trattoria-ultimo') || 'null');
    if (u && Date.now() - u.desde < 8 * 3600000) {
      SEG = u;
      api('trattoria_seguir', { c: u.codigo, tk: u.token }).then((e) => {
        if (!e) return;
        SEG.ultimo = e; pintarEnCurso(e);
        if (!['entregado', 'rechazado'].includes(e.estado)) segTimer = setInterval(() => { if (!document.hidden) refrescarSeguir(); }, 15000);
      }).catch(() => {});
    }
  } catch (e) { /* nada */ }

  /* ---------- barra superior ---------- */
  const top = $('[data-top]');
  const onScroll = () => top.classList.toggle('solida', scrollY > 150);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  pintar();
  cargarConf();
})();
