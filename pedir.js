/* La Trattoria · carta y pedidos por teléfono (pedir.html).
   13-nov: Alfredo quiere los pedidos SOLO por llamada → aquí no hay carrito ni seguimiento: carta con precios,
   fotos, anuncios de la casa y botones para llamar. La carta, el horario, el envío y los teléfonos vienen de datos.js */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = DOMICILIO;
  const DESTACADOS = ['Cuatro quesos', 'Focaccia cuatro quesos', 'Regina Margherita', 'Pollo', 'Spaghetti carbonara', 'Gnocchi con burrata'];
  const ICONO_TEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3h3l1.5 4.5-2.2 1.4a12 12 0 0 0 6.2 6.2l1.4-2.2L21 14.4v3A2.6 2.6 0 0 1 18.4 20 16.4 16.4 0 0 1 4 5.6 2.6 2.6 0 0 1 6.6 3Z"/></svg>';
  // inicial para los platos sin foto (sin «Focaccia», «Spaghetti», «Tabla de»…)
  const inicial = (x) => x.n.replace(/^(focaccia|spaghetti|tabla de|tabla)\s+/i, '').charAt(0).toUpperCase();
  const monograma = (x, cls) => `<span class="${cls} mono mono-${x.c}" aria-hidden="true"><span>${inicial(x)}</span></span>`;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const precioTxt = (x) => (x.m != null
    ? `<span class="pr"><i>M</i>${euros(x.m)}</span>${x.f != null ? `<span class="pr"><i>F</i>${euros(x.f)}</span>` : ''}`
    : x.p != null ? `<span class="pr">${euros(x.p)}</span>` : '<small>Precio: pregúntanos al llamar</small>');
  const pagosTxt = D.pagos.join(' o ').toLowerCase();

  /* ---------- botones de llamar ---------- */
  $$('[data-tels]').forEach((el) => {
    el.innerHTML = TELS.map((t, i) => `<a class="boton-llamar${i ? ' secundario' : ''}" href="tel:${t.tel}">${ICONO_TEL}<span><small>Llamar · ${t.tipo.toLowerCase()}</small><b>${t.n}</b></span></a>`).join('');
  });
  $$('[data-tels-cortos]').forEach((el) => {
    el.innerHTML = TELS.map((t, i) => `<a class="boton-llamar${i ? ' secundario' : ''}" href="tel:${t.tel}">${ICONO_TEL}<b>${t.n}</b></a>`).join('');
  });

  /* ---------- estado, envío y pago ---------- */
  function pintarEstado() {
    const e = estado();
    $$('[data-estado]').forEach((el) => { el.classList.toggle('abierto', e.abierto); el.classList.toggle('cerrado', !e.abierto); el.querySelector('span').textContent = e.txt; });
  }
  pintarEstado(); setInterval(pintarEstado, 60000);
  const envio = D.envio == null ? 'a confirmar' : euros(D.envio);
  $('[data-envio-corto]').textContent = `Envío ${envio}`;
  $$('[data-envio-txt]').forEach((el) => { el.textContent = envio + (D.minimo ? ` · mínimo ${euros(D.minimo)}` : ''); });
  $$('[data-pagos-txt]').forEach((el, i) => { el.textContent = i === 0 ? pagosTxt.charAt(0).toUpperCase() + pagosTxt.slice(1) : pagosTxt; });

  /* ---------- carta ---------- */
  const menu = $('[data-menu]');
  const cats = $('[data-cats]');
  const fila = (x) => {
    const tags = (x.t || []).map((t) => `<span class="etiq${/novedad|picante/i.test(t) ? ' roja' : ''}">${t}</span>`).join(' ');
    const foto = x.img
      ? `<span class="producto-foto"><img src="img/${x.img}-sm.webp" alt="" loading="lazy"></span>`
      : `<span class="producto-foto mono mono-${x.c}"><span class="mono-letra" aria-hidden="true">${inicial(x)}</span></span>`;
    return `<button type="button" class="producto" data-id="${x.id}" data-busca="${norm(x.n + ' ' + x.d)}" aria-label="${x.n}, ver detalles">
      <span class="producto-txt">${tags ? `<span>${tags}</span>` : ''}<b>${x.n}</b>${x.d ? `<p>${x.d}</p>` : ''}<span class="producto-precio">${precioTxt(x)}</span></span>${foto}</button>`;
  };
  const destacados = DESTACADOS.map((n) => CARTA.find((x) => x.n === n)).filter(Boolean);
  let html = `<section class="sec-menu" id="sec-destacados" data-sec><h2>Lo más pedido</h2><p class="sub">Lo que más repiten nuestros clientes</p><div class="carrusel">${destacados.map((x) => `
    <button type="button" class="tarjeta" data-id="${x.id}" aria-label="${x.n}, ver detalles"><span class="tarjeta-foto">${x.img ? `<img src="img/${x.img}-sm.webp" alt="" loading="lazy">` : ''}<span class="popular">Popular</span></span><b>${x.n}</b><span class="precio">${x.m != null ? 'Desde ' + euros(x.m) : x.p != null ? euros(x.p) : 'Pregúntanos'}</span></button>`).join('')}</div></section>`;
  CATS.forEach((c) => {
    const items = CARTA.filter((x) => x.c === c.id);
    html += `<section class="sec-menu" id="sec-${c.id}" data-sec><h2>${c.nombre} <span class="cuenta">${items.length}</span></h2><p class="sub">${c.id === 'pizzas' ? '<b>M</b> mediana · <b>F</b> familiar · combinamos ingredientes a tu gusto' : c.nota}</p><div class="productos">${items.map(fila).join('')}</div></section>`;
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
    sin.textContent = `No encontramos «${e.target.value}». Llámanos: combinamos ingredientes a tu gusto.`;
  });

  /* ---------- ficha del plato: foto grande, precios y llamar ---------- */
  const hoja = $('[data-hoja]'), velo = $('[data-velo]');
  function abrirHoja(x) {
    $('[data-hoja-foto]').innerHTML = x.img ? `<img src="img/${x.img}.webp" alt="${x.n}">` : monograma(x, 'hoja-mono');
    $('[data-hoja-nombre]').textContent = x.n;
    $('[data-hoja-desc]').textContent = x.d || '';
    const ops = x.m != null
      ? [['Mediana', 'Perfecta para uno', x.m], ...(x.f != null ? [['Familiar', 'Para compartir entre dos', x.f]] : [])]
      : [['Precio', '', x.p]];
    $('[data-hoja-precios]').innerHTML = ops.map(([n, sub, p]) => `<div class="opcion"><span><b>${n}</b>${sub ? `<small>${sub}</small>` : ''}</span><b>${p == null ? 'Pregúntanos' : euros(p)}</b></div>`).join('');
    hoja.hidden = false; velo.hidden = false; document.body.classList.add('bloqueo');
  }
  function cerrarHoja() { hoja.hidden = true; velo.hidden = true; document.body.classList.remove('bloqueo'); }
  menu.addEventListener('click', (e) => { const el = e.target.closest('[data-id]'); if (el) abrirHoja(CARTA[+el.dataset.id]); });
  $('[data-hoja-cerrar]').addEventListener('click', cerrarHoja);
  velo.addEventListener('click', cerrarHoja);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !hoja.hidden) cerrarHoja(); });

  /* ---------- barra superior ---------- */
  const top = $('[data-top]');
  const onScroll = () => top.classList.toggle('solida', scrollY > 150);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();
