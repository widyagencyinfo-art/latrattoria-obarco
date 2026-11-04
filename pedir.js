/* La Trattoria · página de pedidos (pedir.html). La carta, el horario y el reparto vienen de datos.js */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = DOMICILIO;
  const DESTACADOS = ['Cuatro quesos', 'Focaccia cuatro quesos', 'Regina Margherita', 'Pollo', 'Spaghetti carbonara', 'Gnocchi con burrata'];
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
  $('[data-minimo-corto]').textContent = D.minimo ? `Pedido mínimo ${euros(D.minimo)}` : `${D.zona} y alrededores`;
  $('[data-nota-envio]').textContent = D.envio == null ? `Repartimos en ${D.zona} y alrededores. Los gastos de envío te los confirmamos con el pedido.` : `Repartimos en ${D.zona}. Envío: ${euros(D.envio)}.`;

  /* ---------- carta ---------- */
  const menu = $('[data-menu]');
  const cats = $('[data-cats]');
  const fila = (x) => {
    const tags = (x.t || []).map((t) => `<span class="etiq${/novedad|picante/i.test(t) ? ' roja' : ''}">${t}</span>`).join(' ');
    const foto = x.img
      ? `<span class="producto-foto"><img src="img/${x.img}-sm.webp" alt="" loading="lazy"><span class="mas" data-mas="${x.id}" aria-hidden="true">+</span></span>`
      : `<span class="producto-sinfoto"><span class="mas" data-mas="${x.id}" aria-hidden="true">+</span></span>`;
    return `<button type="button" class="producto" data-id="${x.id}" data-busca="${norm(x.n + ' ' + x.d)}" aria-label="${x.n}, ver y añadir">
      <span class="producto-txt">${tags ? `<span>${tags}</span>` : ''}<b>${x.n}</b>${x.d ? `<p>${x.d}</p>` : ''}<span class="producto-precio">${desdeTxt(x)}</span></span>${foto}</button>`;
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
    const rapido = e.target.closest('[data-mas]') && !tamanos(x).length;
    if (rapido) anadir(x, 'u', 1); else abrirHoja(x);
  });

  /* ---------- ficha de producto ---------- */
  const hoja = $('[data-hoja]'), velo = $('[data-velo]');
  let H = null;
  function abrirHoja(x) {
    H = { x, tam: tamanos(x).length ? 'm' : 'u', cant: 1 };
    $('[data-hoja-foto]').innerHTML = x.img ? `<img src="img/${x.img}.webp" alt="${x.n}">` : '';
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
      return `<li class="linea">${x.img ? `<img class="linea-foto" src="img/${x.img}-sm.webp" alt="">` : '<span class="linea-foto"></span>'}<span class="linea-txt"><b>${x.n}</b><small>${tam === 'm' ? 'Mediana · ' : tam === 'f' ? 'Familiar · ' : ''}${p == null ? 'precio al confirmar' : euros(p * c)}</small></span>
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
    $('[data-enviar]').href = wa(txt);
  }

  // antes de abrir WhatsApp: que no falte nada para poder llevarlo
  $('[data-enviar]').addEventListener('click', (e) => {
    const err = $('[data-error]');
    const casa = modo === 'domicilio';
    const { n, sub } = cuentas();
    if (!n) { e.preventDefault(); err.textContent = 'Añade algo de la carta para hacer el pedido.'; return; }
    const faltan = [...(casa ? ['dir'] : []), 'nombre', 'tel'].filter((k) => !val(k) || (k === 'tel' && val(k).replace(/\D/g, '').length < 9));
    GUARDA.forEach((k) => $(`[data-f="${k}"]`).classList.toggle('mal', faltan.includes(k)));
    if (faltan.length) {
      e.preventDefault();
      const nombres = { nombre: 'tu nombre', tel: 'un teléfono', dir: 'la dirección' };
      err.textContent = `Falta ${faltan.map((k) => nombres[k]).join(', ').replace(/, ([^,]*)$/, ' y $1')} para poder ${casa ? 'llevártelo' : 'preparártelo'}.`;
      $(`[data-f="${faltan[0]}"]`).focus();
      return;
    }
    if (casa && D.minimo && sub < D.minimo) { e.preventDefault(); err.textContent = `El pedido mínimo a domicilio es de ${euros(D.minimo)}.`; return; }
    err.textContent = '';
    guardar();
  });

  /* ---------- barra superior ---------- */
  const top = $('[data-top]');
  const onScroll = () => top.classList.toggle('solida', scrollY > 150);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  pintar();
})();
