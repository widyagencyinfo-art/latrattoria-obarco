/* La Trattoria · web hecha por Widy · portada (index.html). Los datos están en datos.js; los pedidos, en pedir.js */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  function pintarEstado() {
    const e = estado();
    $$('[data-estado]').forEach((el) => {
      el.classList.toggle('abierto', e.abierto);
      el.classList.toggle('cerrado', !e.abierto);
      el.querySelector('span').textContent = el.closest('.nav') && innerWidth < 700 ? e.corto : e.txt;
    });
  }
  pintarEstado();
  setInterval(pintarEstado, 60000);

  const tabla = $('[data-horario]');
  const hoy = ahoraMadrid().dia;
  if (tabla) [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
    const tr = document.createElement('tr');
    if (d === hoy) tr.className = 'hoy';
    const franjas = HORARIO[d].length ? HORARIO[d].map(([a, c]) => `${a} – ${bonita(c)}`).join(' · ') : 'Cerrado';
    tr.innerHTML = `<td>${DIAS[d]}</td><td>${franjas}</td>`;
    tabla.appendChild(tr);
  });

  const D = DOMICILIO;
  const txtEnvio = () => [
    D.envio == null ? `Repartimos en ${D.zona} y alrededores: los gastos de envío te los confirmamos al recibir el pedido.` : `Repartimos en ${D.zona}. Envío: ${euros(D.envio)}.`,
    D.minimo ? `Pedido mínimo a domicilio: ${euros(D.minimo)}.` : '',
  ].join(' ').trim();
  const pon = (sel, t) => { const el = $(sel); if (el) el.textContent = t; };
  pon('[data-envio-nota]', txtEnvio());
  pon('[data-zona]', txtEnvio() + ` Pagas al recibirlo: ${D.pagos.join(', ').toLowerCase()}.`);
  pon('[data-zona-corta]', D.envio == null ? `${D.zona} y alrededores. El envío te lo confirmamos con el pedido.` : `${D.zona} · envío ${euros(D.envio)}${D.minimo ? ` · mínimo ${euros(D.minimo)}` : ''}`);
  pon('[data-pagos-txt]', D.pagos.join(', '));


  let catActiva = 'pizzas';
  let busca = '';
  const tabs = $('[data-tabs]');
  const cartaEl = $('[data-carta]');

  [{ id: 'todo', nombre: 'Todo' }, ...CATS].forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.role = 'tab';
    b.textContent = c.nombre;
    b.setAttribute('aria-selected', c.id === catActiva);
    b.addEventListener('click', () => {
      catActiva = c.id;
      $$('.tab', tabs).forEach((t) => t.setAttribute('aria-selected', t === b));
      pintarCarta();
    });
    tabs.appendChild(b);
  });


  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function boton(x, tam, precio) {
    return `<span class="precio">${tam === 'm' ? '<i>M</i>' : tam === 'f' ? '<i>F</i>' : ''}${precio == null ? 'Consultar' : euros(precio)}</span>`;
  }
  function pintarCarta() {
    const q = norm(busca.trim());
    cartaEl.innerHTML = '';
    let total = 0;
    CATS.forEach((cat) => {
      if (catActiva !== 'todo' && catActiva !== cat.id) return;
      const items = CARTA.filter((x) => x.c === cat.id && (!q || norm(x.n + ' ' + x.d).includes(q)));
      if (!items.length) return;
      total += items.length;
      const h = document.createElement('h3');
      h.className = 'cat-titulo';
      h.innerHTML = `${cat.nombre} <small>${cat.nota}</small>`;
      cartaEl.appendChild(h);
      items.forEach((x, i) => {
        const el = document.createElement('article');
        el.className = 'item' + (x.img ? ' con-foto' : '');
        el.style.animationDelay = `${Math.min(i, 8) * 35}ms`;
        const tags = (x.t || []).map((t) => `<span class="mini">${t}</span>`).join('');
        const foto = x.img ? `<img class="item-foto" src="img/${x.img}-sm.webp" alt="" loading="lazy">` : '';
        let botones;
        if (x.c === 'pizzas' && x.m) {
          botones = boton(x, 'm', x.m) + (x.f ? boton(x, 'f', x.f) : '<span class="consultar">Familiar: consultar</span>');
        } else botones = boton(x, 'u', x.p);
        el.innerHTML = `${foto}<div class="item-txt"><h4>${x.n} ${tags}</h4>${x.d ? `<p>${x.d}</p>` : ''}</div><div class="item-btns">${botones}</div>`;
        cartaEl.appendChild(el);
      });
    });
    if (!total) cartaEl.innerHTML = `<p class="vacio">No encontramos «${busca}». Escríbenos por WhatsApp: combinamos ingredientes a tu gusto.</p>`;
  }
  $('[data-buscar]').addEventListener('input', (e) => { busca = e.target.value; pintarCarta(); });

  pintarCarta();

  /* ---------- enlaces directos a WhatsApp ---------- */
  $$('[data-wa]').forEach((a) => { a.href = wa(a.dataset.wa); });

  /* ---------- reservar (solo en la portada) ---------- */
  if ($('[data-reserva]')) {
  const R = { personas: '2', fecha: null, hora: null };
  const personasEl = $('[data-personas]');
  ['1', '2', '3', '4', '5', '6', '7', '8+'].forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opt'; b.textContent = p;
    b.setAttribute('aria-pressed', p === '2');
    b.addEventListener('click', () => {
      R.personas = p;
      $$('.opt', personasEl).forEach((o) => o.setAttribute('aria-pressed', o === b));
      resumen();
    });
    personasEl.appendChild(b);
  });

  function franjas(d) {
    const out = [];
    const comida = HORARIO[d].find(([a]) => aMin(a) < 17 * 60);
    if (comida) {
      const horas = [];
      for (let m = aMin(comida[0]); m <= aMin(comida[1]) - 60; m += 30) horas.push(m);
      out.push({ nombre: 'Comida', horas });
    }
    const cena = HORARIO[d].find(([a]) => aMin(a) >= 17 * 60);
    if (cena) {
      const horas = [];
      for (let m = Math.max(aMin(cena[0]), 20 * 60); m <= aMin(cena[1]) - 60; m += 30) horas.push(m);
      out.push({ nombre: 'Cena', horas });
    }
    return out;
  }

  const diasEl = $('[data-dias]');
  const horasEl = $('[data-horas]');
  const { fecha: base, min: ahoraMin } = ahoraMadrid();
  const DIAS_R = [];
  for (let i = 0; i < 14; i++) {
    const f = new Date(base); f.setDate(base.getDate() + i);
    const d = f.getDay();
    let hs = franjas(d);
    if (i === 0) hs = hs.map((g) => ({ ...g, horas: g.horas.filter((m) => m > ahoraMin + 30) })).filter((g) => g.horas.length);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opt dia';
    b.innerHTML = `<small>${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS_CORTOS[d]}</small><b>${f.getDate()}</b><small>${MESES[f.getMonth()]}</small>`;
    b.disabled = !hs.length;
    b.title = !HORARIO[d].length ? 'Martes: cerrado por descanso' : '';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => elegirDia(b, f, hs));
    diasEl.appendChild(b);
    DIAS_R.push({ b, f, hs });
  }
  function elegirDia(b, f, hs, horaPreferida) {
    R.fecha = f; R.hora = null;
    $$('.opt', diasEl).forEach((o) => o.setAttribute('aria-pressed', o === b));
    horasEl.innerHTML = '';
    hs.forEach((g) => {
      const t = document.createElement('span');
      t.className = 'franja'; t.textContent = g.nombre;
      horasEl.appendChild(t);
      g.horas.forEach((m) => {
        const h = document.createElement('button');
        h.type = 'button'; h.className = 'opt'; h.textContent = hhmm(m);
        h.setAttribute('aria-pressed', 'false');
        h.addEventListener('click', () => {
          R.hora = hhmm(m);
          $$('.opt', horasEl).forEach((o) => o.setAttribute('aria-pressed', o === h));
          resumen();
        });
        horasEl.appendChild(h);
        if (horaPreferida && hhmm(m) === horaPreferida) h.click();
      });
    });
    b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    resumen();
  }
  horasEl.innerHTML = '<p class="aviso">Elige primero el día.</p>';
  const primero = DIAS_R.find((x) => !x.b.disabled);
  if (primero) elegirDia(primero.b, primero.f, primero.hs);

  // atajos: «Esta noche» (primer día con cena, 21:00) y «Comida del finde» (sábado o domingo, 14:00)
  $$('[data-preset]').forEach((btn) => btn.addEventListener('click', () => {
    const tipo = btn.dataset.preset;
    $$('[data-preset]').forEach((o) => o.classList.toggle('on', o === btn));
    const x = DIAS_R.find(({ f, hs }) => tipo === 'hoy'
      ? hs.some((g) => g.nombre === 'Cena')
      : (f.getDay() === 6 || f.getDay() === 0) && hs.some((g) => g.nombre === 'Comida'));
    if (!x) return;
    const grupo = x.hs.find((g) => g.nombre === (tipo === 'hoy' ? 'Cena' : 'Comida'));
    const pref = tipo === 'hoy' ? '21:00' : '14:00';
    elegirDia(x.b, x.f, x.hs, grupo.horas.map(hhmm).includes(pref) ? pref : hhmm(grupo.horas[0]));
  }));

  const form = $('[data-reserva]');
  function fechaTxt(f) { return `${DIAS[f.getDay()].toLowerCase()} ${f.getDate()} de ${MESES_L[f.getMonth()]}`; }
  function resumen() {
    const el = $('[data-resumen]');
    if (!R.fecha) { el.textContent = ''; return; }
    const p = R.personas === '1' ? '1 persona' : `${R.personas} personas`;
    el.innerHTML = R.hora
      ? `Mesa para <b>${p}</b>, el <b>${fechaTxt(R.fecha)}</b> a las <b>${R.hora}</b>.`
      : `Mesa para <b>${p}</b>, el <b>${fechaTxt(R.fecha)}</b>. Elige la hora.`;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = form.nombre.value.trim();
    form.nombre.classList.toggle('error', !nombre);
    if (!R.fecha || !R.hora) { $('[data-resumen]').innerHTML = '<b class="rojo">Elige día y hora para la reserva.</b>'; return; }
    if (!nombre) { form.nombre.focus(); return; }
    const nota = form.nota.value.trim();
    const p = R.personas === '1' ? '1 persona' : `${R.personas} personas`;
    const txt = `¡Hola, La Trattoria! Quiero reservar mesa:\n• ${p}\n• ${fechaTxt(R.fecha)}\n• A las ${R.hora}\n• A nombre de ${nombre}${nota ? `\n• Nota: ${nota}` : ''}\n¿Me la confirmáis? Gracias.`;
    window.open(wa(txt), '_blank', 'noopener');
  });

  }

  /* ---------- reseñas (reales, de Google; recortadas) ---------- */
  const RESENAS = [
    ['Marta F.', 'Hace 5 meses', 'Una pizza carbonara buenísima. Pedimos la familiar para compartir entre 2. El queso está cremoso, el tomate se nota de calidad y el bacon tiene mucho sabor. La chica que nos atendió fue muy amable.'],
    ['Miguel', 'Hace 5 meses', '¡Menuda sorpresa! No esperaba encontrar este restaurante italiano tan auténtico. No miento si digo que fue la mejor pizza que he comido nunca. El trato de Alfredo, excepcional.'],
    ['Óscar R.', 'Hace 8 años', 'Calzone y focaccia espectaculares. En el resto de Galicia no encontré nada parecido a la focaccia de La Trattoria.'],
    ['Jesús', 'Hace 8 meses', 'Pizzas muy ricas y baratas. El tamaño estándar está muy bien para una persona y me gustó que dejasen elegir media pizza de un tipo y otra media de otro. Para repetir.'],
    ['Delta N.', 'Hace 8 meses', 'Pizzería de toda la vida. Fieles a sus pizzas de siempre. No las había probado y he repetido dos veces. La camarera, muy atenta y con suma paciencia.'],
    ['Belén S.', 'Hace 6 meses', 'La pizza estaba riquísima, la masa increíble y el trato súper bien. Todo perfecto.'],
    ['Fido K.', 'Hace 4 años', 'Muy buenas pizzas, como siempre. La focaccia rústica, un éxito. Masa muy rica. Buenos ingredientes y en abundancia. 100 % recomendable.'],
    ['Zurima M.', 'Hace 6 meses', 'Las mejores pizzas de la comarca de Valdeorras, insuperable.'],
    ['Geovana C.', 'Hace 6 meses', '¡La pizza perfecta! El lugar muy acogedor, ¡me siento en Italia!'],
  ];
  const resEl = $('[data-resenas]');
  if (resEl) {
  RESENAS.forEach(([n, cuando, t]) => {
    const f = document.createElement('figure');
    f.className = 'resena';
    f.innerHTML = `<span class="stars" aria-label="5 estrellas">★★★★★</span><blockquote>«${t}»</blockquote>
      <figcaption><span class="avatar">${n[0]}</span><span><b>${n}</b>${cuando} · Google</span></figcaption>`;
    resEl.appendChild(f);
  });
  const paso = () => ($('.resena', resEl)?.offsetWidth || 340) + 16;
  $('[data-res-prev]').addEventListener('click', () => resEl.scrollBy({ left: -paso() }));
  $('[data-res-next]').addEventListener('click', () => resEl.scrollBy({ left: paso() }));

  }

  /* ---------- reveal, nav, año ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  $$('.reveal').forEach((el) => io.observe(el));
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solida', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  $('[data-year]').textContent = new Date().getFullYear();
})();
