/* La Trattoria · panel de pedidos de Alfredo (panel.html). Lee y cambia los pedidos con su PIN. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* nada */ } } };
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = (iso, mas = 0) => new Date(new Date(iso).getTime() + mas * 60000).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const haceMin = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const haceTxt = (iso) => { const m = haceMin(iso); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h ${m % 60} min`; };
  const fechaLarga = (d) => { const [y, m, dd] = d.split('-').map(Number); const f = new Date(y, m - 1, dd); return `${DIAS[f.getDay()].toLowerCase()} ${dd} de ${MESES_L[m - 1]}`; };

  let PIN = LS.get('trattoria-pin');
  let DATOS = null;            // última respuesta del servidor
  let DIA = null;              // null = hoy; si no, «2026-11-10»
  let vistos = new Set(JSON.parse(LS.get('trattoria-vistos') || '[]'));
  let primeraCarga = true;
  let ultimaFirma = '';
  let tab = 'nuevos';
  const abiertos = new Set(); // pedidos con la tarjeta desplegada en «Terminados»

  /* ---------- toast ---------- */
  let tt;
  const toast = (t) => { const el = $('[data-toast]'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, 2200); };

  /* ---------- sonido (se genera aquí, sin archivos) ---------- */
  let ctx = null;
  let sonidoOn = LS.get('trattoria-sonido') !== 'no';
  const sonidoListo = () => ctx && ctx.state === 'running';
  function desbloquear() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state !== 'running') ctx.resume(); } catch (e) { /* sin audio */ }
    setTimeout(pintarAvisoSonido, 300);
  }
  function timbre() {
    if (!sonidoOn || !sonidoListo()) return;
    const t0 = ctx.currentTime;
    [[880, 0], [1175, .18], [1568, .36], [880, .9], [1175, 1.08], [1568, 1.26]].forEach(([f, t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + t); g.gain.exponentialRampToValueAtTime(0.6, t0 + t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + .32);
      o.connect(g).connect(ctx.destination); o.start(t0 + t); o.stop(t0 + t + .35);
    });
    if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  }
  function pintarAvisoSonido() {
    $('[data-activar-sonido]').hidden = !sonidoOn || sonidoListo() || !DATOS;
    $('[data-sonido]').textContent = sonidoOn ? '🔔' : '🔕';
  }
  document.addEventListener('pointerdown', desbloquear, { passive: true });
  $('[data-activar-sonido]').addEventListener('click', () => { desbloquear(); setTimeout(timbre, 200); });
  $('[data-sonido]').addEventListener('click', () => { sonidoOn = !sonidoOn; LS.set('trattoria-sonido', sonidoOn ? 'si' : 'no'); pintarAvisoSonido(); toast(sonidoOn ? 'Sonido activado' : 'Sonido desactivado'); });
  $('[data-probar-sonido]').addEventListener('click', () => { desbloquear(); sonidoOn = true; LS.set('trattoria-sonido', 'si'); setTimeout(timbre, 150); pintarAvisoSonido(); });

  // pantalla siempre encendida mientras el panel está abierto
  let lock = null;
  async function pantallaEncendida() { try { if ('wakeLock' in navigator && !document.hidden) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no soportado */ } }

  /* ---------- entrada: la primera vez (con el enlace de activación) Alfredo crea su contraseña ---------- */
  let ACTIVAR = (location.hash.match(/activar=([a-z0-9]+)/i) || [])[1] || null;
  const clave = $('[data-clave]'), clave2 = $('[data-clave2]');
  function modoLogin() {
    const nueva = !!ACTIVAR;
    $('[data-login-tit]').textContent = nueva ? 'Crea tu contraseña' : 'Panel de pedidos';
    $('[data-login-sub]').textContent = nueva ? 'Es la primera vez que entras. Elige una contraseña de al menos 6 letras o números.' : 'Escribe tu contraseña';
    $('[data-repetir-wrap]').hidden = !nueva;
    clave.setAttribute('autocomplete', nueva ? 'new-password' : 'current-password');
    $('[data-clave-et]').textContent = nueva ? 'Contraseña nueva' : 'Contraseña';
    $('[data-login-boton]').textContent = nueva ? 'Guardar y entrar' : 'Entrar';
  }
  $('[data-ver-clave]').addEventListener('click', (e) => {
    const ver = clave.type === 'password';
    clave.type = clave2.type = ver ? 'text' : 'password';
    e.currentTarget.textContent = ver ? 'Ocultar' : 'Ver';
  });
  const errLogin = (t) => { $('[data-login-error]').textContent = t; };
  $('[data-login-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    desbloquear();
    const c = clave.value.trim();
    const boton = $('[data-login-boton]');
    if (ACTIVAR) {
      if (c.length < 6) { errLogin('Tiene que tener al menos 6 letras o números.'); clave.focus(); return; }
      if (c !== clave2.value.trim()) { errLogin('Las dos contraseñas no coinciden.'); clave2.focus(); return; }
      boton.disabled = true; errLogin('');
      let r = null;
      try { r = await api('trattoria_activar', { codigo: ACTIVAR, clave: c }); } catch (er) { r = null; }
      boton.disabled = false;
      if (!r) { errLogin('Sin conexión. Prueba otra vez.'); return; }
      if (r.error === 'codigo') { ACTIVAR = null; history.replaceState(null, '', location.pathname); modoLogin(); errLogin('Este enlace ya se usó. Entra con tu contraseña o pídenos uno nuevo.'); return; }
      if (r.error) { errLogin(r.error === 'espera' ? 'Demasiados intentos. Espera unos minutos.' : 'Tiene que tener al menos 6 letras o números.'); return; }
      ACTIVAR = null; history.replaceState(null, '', location.pathname);
      PIN = c; clave.value = clave2.value = '';
      await cargar(true);
      toast('✓ Contraseña guardada');
      return;
    }
    if (!c) { errLogin('Escribe tu contraseña.'); clave.focus(); return; }
    boton.disabled = true; errLogin('');
    PIN = c;
    const ok = await cargar(true);
    boton.disabled = false;
    if (ok) clave.value = ''; else PIN = null;
  });
  function mostrarLogin(msg) {
    $('[data-app]').hidden = true; $('[data-login]').hidden = false;
    modoLogin(); errLogin(msg || '');
    setTimeout(() => clave.focus(), 50);
  }

  // cambiar la contraseña desde Ajustes
  $('[data-cambiar-clave]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = $('[data-nueva]').value.trim(), n2 = $('[data-nueva2]').value.trim(), err = $('[data-cambiar-error]');
    if (n.length < 6) { err.textContent = 'Al menos 6 letras o números.'; return; }
    if (n !== n2) { err.textContent = 'Las dos no coinciden.'; return; }
    let r = null;
    try { r = await api('trattoria_cambiar_clave', { actual: PIN, nueva: n }); } catch (er) { r = null; }
    if (!r || r.error) { err.textContent = !r ? 'Sin conexión. Prueba otra vez.' : 'No se ha podido cambiar.'; return; }
    PIN = n; LS.set('trattoria-pin', PIN);
    $('[data-nueva]').value = $('[data-nueva2]').value = ''; err.textContent = '';
    toast('✓ Contraseña cambiada');
  });
  $('[data-salir]').addEventListener('click', () => { LS.del('trattoria-pin'); PIN = null; cerrarAjustes(); mostrarLogin(); });

  /* ---------- servidor ---------- */
  async function panel(accion, datos = {}) { return api('trattoria_panel', { pin: PIN, accion, datos }); }

  async function cargar(desdeLogin) {
    if (!PIN) { mostrarLogin(); return false; }
    let r;
    try { r = await panel('pedidos', DIA ? { dia: DIA } : {}); } catch (e) {
      $('[data-aviso-red]').hidden = !DATOS; if (desdeLogin) errLogin('Sin conexión. Prueba otra vez.');
      return false;
    }
    $('[data-aviso-red]').hidden = true;
    if (r && r.error === 'pin') { LS.del('trattoria-pin'); mostrarLogin(desdeLogin ? 'Contraseña incorrecta' : ''); return false; }
    LS.set('trattoria-pin', PIN);
    DATOS = r;
    if ($('[data-app]').hidden) { $('[data-login]').hidden = true; $('[data-app]').hidden = false; pantallaEncendida(); }
    // ¿hay pedidos nuevos que no habíamos visto?
    const nuevos = r.pedidos.filter((p) => p.estado === 'nuevo' && !vistos.has(p.id));
    r.pedidos.forEach((p) => vistos.add(p.id));
    LS.set('trattoria-vistos', JSON.stringify([...vistos].slice(-300)));
    if (nuevos.length && !primeraCarga) { timbre(); avisoNotificacion(nuevos.length); if (innerWidth < 900) cambiarTab('nuevos'); mostrarAlarma(nuevos); }
    // al abrir el panel con pedidos sin aceptar y el sonido bloqueado: el aviso grande sirve para desbloquearlo
    else if (primeraCarga && !DIA && r.pedidos.some((p) => p.estado === 'nuevo') && !sonidoListo()) mostrarAlarma(r.pedidos.filter((p) => p.estado === 'nuevo'));
    primeraCarga = false;
    const firma = JSON.stringify([r.pedidos, r.ajustes, DIA]);
    if (firma !== ultimaFirma) { ultimaFirma = firma; pintar(); }
    pintarAvisoSonido();
    return true;
  }

  function mostrarAlarma(lista) {
    const ult = lista[lista.length - 1];
    $('[data-alarma-tit]').textContent = lista.length > 1 ? `${lista.length} pedidos` : `#${ult.num}`;
    const piezas = (ult.lineas || []).reduce((s, l) => s + l.c, 0);
    $('[data-alarma-det]').textContent = lista.length > 1
      ? 'Están esperando a que los aceptes'
      : `${ult.modo === 'domicilio' ? '🛵 A domicilio' : '🏃 Para recoger'} · ${ult.nombre} · ${piezas} ${piezas === 1 ? 'cosa' : 'cosas'}`;
    $('[data-alarma]').hidden = false;
  }
  $('[data-alarma-ver]').addEventListener('click', () => {
    desbloquear(); $('[data-alarma]').hidden = true; cambiarTab('nuevos');
    const primero = $('[data-lista="nuevos"] .pedido'); if (primero) primero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function avisoNotificacion(n) {
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('La Trattoria', { body: n > 1 ? `${n} pedidos nuevos` : '¡Pedido nuevo!', icon: 'img/logo.png' });
    } catch (e) { /* nada */ }
  }

  /* ---------- pintar ---------- */
  const GRUPO = { nuevo: 'nuevos', aceptado: 'marcha', listo: 'marcha', en_camino: 'marcha', entregado: 'hechos', rechazado: 'hechos' };
  const ETIQ = { nuevo: 'Nuevo', aceptado: 'En el horno', listo: 'Listo', en_camino: 'De camino', entregado: 'Entregado', rechazado: 'Rechazado' };

  function totalDe(p) {
    const env = p.modo === 'domicilio' && p.envio ? +p.envio : 0;
    return +p.subtotal + env;
  }
  function cambioTxt(p) {
    if (p.pago !== 'Efectivo' || !p.cambio) return '';
    const con = parseFloat(String(p.cambio).replace(',', '.').replace(/[^\d.]/g, ''));
    const tot = totalDe(p);
    if (!con || p.sin_precio) return ` · paga con ${esc(p.cambio)}`;
    return ` · paga con ${euros(con)} → <b>llevar ${euros(Math.max(0, con - tot))} de cambio</b>`;
  }

  function tarjeta(p) {
    const casa = p.modo === 'domicilio';
    const grupo = GRUPO[p.estado];
    const plegada = grupo === 'hechos' && !abiertos.has(p.id);
    const programado = p.hora && !/antes posible/i.test(p.hora);
    const llega = p.aceptado_en && p.minutos ? hora(p.aceptado_en, p.minutos) : null;
    const lineas = (p.lineas || []).map((l) => `<li><b>${l.c}×</b><span>${esc(l.n)}${l.tam === 'm' ? ' <em>mediana</em>' : l.tam === 'f' ? ' <em>familiar</em>' : ''}</span><small>${l.p == null ? 'precio a poner' : euros(l.p * l.c)}</small></li>`).join('');
    const telLimpio = String(p.tel).replace(/\D/g, '');
    const tel34 = telLimpio.length === 9 ? '34' + telLimpio : telLimpio;
    const mapa = casa && p.dir ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.dir + ', ' + DOMICILIO.zona)}` : null;
    const total = `${euros(totalDe(p))}${p.sin_precio ? ' + pasta/tablas' : ''}${casa && p.envio == null ? ' + envío' : ''}`;

    let acciones = '';
    if (p.estado === 'nuevo') {
      const esp = DATOS.ajustes.espera;
      const ops = [...new Set([20, 30, 40, 50, 60, esp])].sort((a, b) => a - b);
      acciones = `<p class="acc-tit">Aceptar · ¿en cuánto ${casa ? 'llega' : 'está listo'}?</p>
        <div class="tiempos">${ops.map((m) => `<button type="button" class="b-min${m === esp ? ' sugerido' : ''}" data-acc="aceptado" data-min="${m}" data-id="${p.id}"><b>${m}</b><small>min</small></button>`).join('')}</div>
        <button type="button" class="b-texto-rojo" data-rechazar="${p.id}">No puedo atenderlo</button>`;
    } else if (p.estado === 'aceptado') {
      acciones = casa
        ? `<button type="button" class="b-grande b-azul" data-acc="en_camino" data-id="${p.id}">🛵 Sale ya · De camino</button>`
        : `<button type="button" class="b-grande b-azul" data-acc="listo" data-id="${p.id}">✅ Listo para recoger</button>`;
    } else if (p.estado === 'listo' || p.estado === 'en_camino') {
      acciones = `<button type="button" class="b-grande b-verde" data-acc="entregado" data-id="${p.id}">${casa ? 'Entregado' : 'Recogido'} ✓</button>`;
    }
    const atras = { aceptado: 'nuevo', listo: 'aceptado', en_camino: 'aceptado', entregado: casa ? 'en_camino' : 'listo', rechazado: 'nuevo' }[p.estado];
    const avisar = avisoWA(p, tel34);

    return `<article class="pedido est-${p.estado}${plegada ? ' plegada' : ''}" data-pedido="${p.id}">
      <header class="p-cab" data-plegar="${p.id}">
        <span class="p-num">#${p.num}</span>
        <span class="p-modo ${casa ? 'casa' : 'local'}">${casa ? '🛵 Domicilio' : '🏃 Recoger'}</span>
        <span class="p-est">${ETIQ[p.estado]}</span>
        <span class="p-hace" data-hace="${p.creado}">${hora(p.creado)} · ${haceTxt(p.creado)}</span>
      </header>
      ${plegada ? `<p class="p-plegada">${esc(p.nombre)} · ${total}${p.estado === 'rechazado' && p.motivo ? ' · ' + esc(p.motivo) : ''}</p>` : `
      ${programado ? `<p class="p-programado">⏰ Lo quiere para: <b>${esc(p.hora)}</b></p>` : ''}
      ${llega && ['aceptado', 'listo', 'en_camino'].includes(p.estado) ? `<p class="p-llega">${casa ? 'Prometido en casa' : 'Prometido listo'} a las <b>${llega}</b></p>` : ''}
      <ul class="p-lineas">${lineas}</ul>
      ${p.nota ? `<p class="p-nota">📝 ${esc(p.nota)}</p>` : ''}
      <div class="p-total"><span>Total</span><b>${total}</b></div>
      <p class="p-pago">${casa ? `💶 ${esc(p.pago || '')}${cambioTxt(p)}` : 'Paga en el local'}</p>
      <div class="p-cliente">
        <b>${esc(p.nombre)}</b>
        ${casa ? `<a class="p-dir" href="${mapa}" target="_blank" rel="noopener">📍 ${esc(p.dir)}</a>` : ''}
        <div class="p-contacto">
          <a href="tel:+${tel34}">📞 ${esc(p.tel)}</a>
          <a href="${avisar.url}" target="_blank" rel="noopener">💬 ${avisar.txt}</a>
        </div>
      </div>
      ${p.estado === 'rechazado' && p.motivo ? `<p class="p-motivo">Motivo: ${esc(p.motivo)}</p>` : ''}
      <div class="p-acciones">${acciones}</div>
      <footer class="p-pie">
        ${atras ? `<button type="button" class="b-mini" data-acc="${atras}" data-id="${p.id}" data-atras>↩ Deshacer</button>` : '<span></span>'}
        <button type="button" class="b-mini" data-imprimir="${p.id}">🖨 Ticket</button>
      </footer>`}
    </article>`;
  }

  function avisoWA(p, tel34) {
    const casa = p.modo === 'domicilio';
    const llega = p.aceptado_en && p.minutos ? hora(p.aceptado_en, p.minutos) : null;
    const hola = `Hola ${p.nombre}, somos La Trattoria 🍕`;
    const m = {
      nuevo: [`${hola} Hemos recibido tu pedido nº ${p.num}.`, 'WhatsApp'],
      aceptado: [`${hola} Tu pedido nº ${p.num} está confirmado${llega ? (casa ? ` y llega sobre las ${llega}` : ` y estará listo sobre las ${llega}`) : ''}. ¡Gracias!`, 'Avisar: confirmado'],
      listo: [`${hola} Tu pedido nº ${p.num} ya está listo para recoger en Rúa San Mauro, 29. ¡Te esperamos!`, 'Avisar: listo'],
      en_camino: [`${hola} Tu pedido nº ${p.num} ya va de camino. ¡Que aproveche!`, 'Avisar: de camino'],
      entregado: [`${hola} ¡Gracias por tu pedido! Esperamos que te haya gustado.`, 'WhatsApp'],
      rechazado: [`${hola} Lo sentimos, no podemos atender tu pedido nº ${p.num}${p.motivo ? ': ' + p.motivo.toLowerCase() : ''}.`, 'Avisar por WhatsApp'],
    }[p.estado];
    return { url: `https://wa.me/${tel34}?text=${encodeURIComponent(m[0])}`, txt: m[1] };
  }

  function pintar() {
    if (!DATOS) return;
    const ps = DATOS.pedidos;
    const g = { nuevos: [], marcha: [], hechos: [] };
    ps.forEach((p) => g[GRUPO[p.estado]].push(p));
    g.nuevos.sort((a, b) => new Date(a.creado) - new Date(b.creado));   // el más antiguo primero
    g.marcha.sort((a, b) => new Date(a.aceptado_en || a.creado) - new Date(b.aceptado_en || b.creado));
    Object.entries(g).forEach(([k, lista]) => {
      $(`[data-lista="${k}"]`).innerHTML = lista.length ? lista.map(tarjeta).join('') : `<p class="vacio">${{ nuevos: 'No hay pedidos nuevos. Cuando entre uno, suena y aparece aquí.', marcha: 'Nada en marcha ahora mismo.', hechos: 'Todavía no hay pedidos terminados.' }[k]}</p>`;
      $$(`[data-n="${k}"]`).forEach((b) => { b.textContent = lista.length; });
    });
    $('[data-pestanas] [data-tab="nuevos"]').classList.toggle('alarma', g.nuevos.length > 0);
    document.title = g.nuevos.length ? `(${g.nuevos.length}) ¡Pedido nuevo! · La Trattoria` : 'Pedidos · La Trattoria';
    // resumen de la jornada
    const validos = ps.filter((p) => p.estado !== 'rechazado' && p.jornada === DATOS.jornada);
    const caja = ps.filter((p) => p.estado === 'entregado' && p.jornada === DATOS.jornada).reduce((s, p) => s + totalDe(p), 0);
    $('[data-resumen]').textContent = `${DIA ? fechaLarga(DIA) : 'Hoy'} · ${validos.length} pedido${validos.length === 1 ? '' : 's'} · ${euros(caja)}`;
    // pausa
    const pausado = DATOS.ajustes.pausado;
    const sw = $('[data-recibir]');
    sw.setAttribute('aria-pressed', !pausado);
    sw.querySelector('span').textContent = pausado ? 'Pedidos online en pausa' : 'Recibiendo pedidos online';
    $('[data-recibir-accion]').textContent = pausado ? 'Reanudar' : 'Pausar';
    $('[data-aviso-pausa]').hidden = !pausado;
    $('[data-aviso-historial]').hidden = !DIA;
    if (DIA) $('[data-historial-txt]').textContent = `Estás viendo los pedidos del ${fechaLarga(DIA)}.`;
  }

  /* ---------- acciones sobre los pedidos ---------- */
  async function cambiarEstado(id, estado, extra = {}) {
    const p = DATOS.pedidos.find((x) => x.id === id); if (!p) return;
    const antes = { ...p };
    Object.assign(p, { estado, ...extra });
    if (estado === 'aceptado' && !p.aceptado_en) p.aceptado_en = new Date().toISOString();
    ultimaFirma = ''; pintar();
    try {
      const r = await panel('estado', { id, estado, ...extra });
      if (!r || !r.ok) throw new Error();
      cargar();
    } catch (e) { Object.assign(p, antes); pintar(); toast('No se ha guardado. Revisa la conexión y vuelve a tocar.'); }
  }

  document.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-acc]');
    if (acc) {
      const id = +acc.dataset.id, est = acc.dataset.acc;
      const extra = acc.dataset.min ? { minutos: +acc.dataset.min } : {};
      cambiarEstado(id, est, extra);
      if (!acc.hasAttribute('data-atras')) {
        const msg = { aceptado: `Aceptado · ${extra.minutos} min`, en_camino: 'De camino', listo: 'Listo para recoger', entregado: 'Terminado' }[est];
        if (msg) toast(`✓ ${msg}`);
      }
      return;
    }
    const rech = e.target.closest('[data-rechazar]');
    if (rech) { abrirDialogo(+rech.dataset.rechazar); return; }
    const imp = e.target.closest('[data-imprimir]');
    if (imp) { imprimir(+imp.dataset.imprimir); return; }
    const pl = e.target.closest('[data-plegar]');
    if (pl && !e.target.closest('a,button')) {
      const id = +pl.dataset.plegar; const p = DATOS.pedidos.find((x) => x.id === id);
      if (p && GRUPO[p.estado] === 'hechos') { abiertos.has(id) ? abiertos.delete(id) : abiertos.add(id); pintar(); }
    }
  });

  /* ---------- rechazar ---------- */
  let rechId = null, motivo = '';
  const dialogo = $('[data-dialogo]'), velo = $('[data-velo]');
  function abrirDialogo(id) { rechId = id; motivo = ''; $$('[data-motivos] button').forEach((b) => b.classList.remove('on')); $('[data-motivo-otro]').value = ''; dialogo.hidden = false; velo.hidden = false; }
  function cerrarDialogo() { dialogo.hidden = true; if ($('[data-ajustes]').hidden) velo.hidden = true; }
  $('[data-motivos]').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; motivo = b.textContent; $$('[data-motivos] button').forEach((x) => x.classList.toggle('on', x === b)); });
  $('[data-dialogo-no]').addEventListener('click', cerrarDialogo);
  $('[data-dialogo-si]').addEventListener('click', () => {
    const m = $('[data-motivo-otro]').value.trim() || motivo;
    cambiarEstado(rechId, 'rechazado', { motivo: m }); cerrarDialogo(); toast('Pedido rechazado');
  });

  /* ---------- ticket para imprimir ---------- */
  function imprimir(id) {
    const p = DATOS.pedidos.find((x) => x.id === id); if (!p) return;
    const casa = p.modo === 'domicilio';
    $('[data-ticket]').innerHTML = `<h1>La Trattoria</h1><p>Pedido nº ${p.num} · ${hora(p.creado)}</p><h2>${casa ? 'A DOMICILIO' : 'PARA RECOGER'}</h2>
      ${p.hora ? `<p><b>Para:</b> ${esc(p.hora)}</p>` : ''}<hr>
      ${(p.lineas || []).map((l) => `<p class="tl"><b>${l.c}×</b> ${esc(l.n)}${l.tam === 'm' ? ' (M)' : l.tam === 'f' ? ' (F)' : ''}<span>${l.p == null ? '—' : euros(l.p * l.c)}</span></p>`).join('')}
      <hr><p class="tl"><b>TOTAL</b><span>${euros(totalDe(p))}${p.sin_precio ? ' +' : ''}</span></p>
      ${p.nota ? `<p><b>Nota:</b> ${esc(p.nota)}</p>` : ''}<hr>
      <p><b>${esc(p.nombre)}</b> · ${esc(p.tel)}</p>${casa ? `<p>${esc(p.dir)}</p><p>Pago: ${esc(p.pago || '')}${p.cambio ? ' · con ' + esc(p.cambio) : ''}</p>` : ''}`;
    window.print();
  }

  /* ---------- pausa ---------- */
  async function ajustar(cambio, msg) {
    const antes = { ...DATOS.ajustes };
    Object.assign(DATOS.ajustes, cambio); ultimaFirma = ''; pintar();
    try { const r = await panel('ajustes', cambio); if (!r || !r.ok) throw new Error(); if (msg) toast(msg); } catch (e) { DATOS.ajustes = antes; pintar(); toast('No se ha guardado. Revisa la conexión.'); }
  }
  $('[data-recibir]').addEventListener('click', () => {
    const pausar = !DATOS.ajustes.pausado;
    if (pausar && !confirm('¿Pausar los pedidos online? Los clientes verán que ahora no se puede pedir por la web.')) return;
    ajustar({ pausado: pausar }, pausar ? 'Pedidos en pausa' : 'Volvemos a recibir pedidos');
  });
  $('[data-reanudar]').addEventListener('click', () => ajustar({ pausado: false }, 'Volvemos a recibir pedidos'));

  /* ---------- ajustes ---------- */
  const panelAj = $('[data-ajustes]');
  function abrirAjustes() { panelAj.hidden = false; velo.hidden = false; pintarAjustes(); }
  function cerrarAjustes() { panelAj.hidden = true; velo.hidden = true; }
  $('[data-abrir-ajustes]').addEventListener('click', abrirAjustes);
  $('[data-cerrar-ajustes]').addEventListener('click', cerrarAjustes);
  velo.addEventListener('click', () => { cerrarAjustes(); cerrarDialogo(); });

  function pintarEspera() {
    if (!DATOS) return;
    $('[data-espera]').innerHTML = [20, 30, 40, 50, 60, 75, 90].map((m) => `<button type="button" data-esp="${m}" aria-pressed="${m === DATOS.ajustes.espera}">${m} min</button>`).join('');
  }
  function pintarAjustes() {
    if (!DATOS || panelAj.hidden) return;
    const a = DATOS.ajustes;
    $('[data-espera]').innerHTML = [20, 30, 40, 50, 60, 75, 90].map((m) => `<button type="button" data-esp="${m}" aria-pressed="${m === a.espera}">${m} min</button>`).join('');
    $('[data-agotados]').innerHTML = CATS.map((c) => `<details ${c.id === 'pizzas' ? '' : 'open'}><summary>${c.nombre} <small>${CARTA.filter((x) => x.c === c.id && a.agotados.includes(x.n)).length || ''}</small></summary>${CARTA.filter((x) => x.c === c.id).map((x) => `
      <label class="agot-fila"><span>${esc(x.n)}</span><input type="checkbox" data-agot="${esc(x.n)}" ${a.agotados.includes(x.n) ? 'checked' : ''}><i></i></label>`).join('')}</details>`).join('');
    const dias = DATOS.dias || [];
    $('[data-dias]').innerHTML = dias.length ? dias.map((d) => `<button type="button" data-dia="${d.jornada}" aria-pressed="${(DIA || DATOS.hoy) === d.jornada}"><b>${d.jornada === DATOS.hoy ? 'Hoy' : fechaLarga(d.jornada)}</b><span>${d.n} pedidos · ${euros(+d.caja)}</span></button>`).join('') : '<p class="ayuda">Aquí saldrán los días con pedidos.</p>';
  }
  $('[data-espera]').addEventListener('click', (e) => { const b = e.target.closest('[data-esp]'); if (b) { ajustar({ espera: +b.dataset.esp }, `Tiempo de espera: ${b.dataset.esp} min`); pintarEspera(); } });
  $('[data-agotados]').addEventListener('change', (e) => {
    const c = e.target.closest('[data-agot]'); if (!c) return;
    const set = new Set(DATOS.ajustes.agotados);
    c.checked ? set.add(c.dataset.agot) : set.delete(c.dataset.agot);
    ajustar({ agotados: [...set] }, c.checked ? `${c.dataset.agot}: agotado` : `${c.dataset.agot}: disponible otra vez`);
  });
  $('[data-dias]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dia]'); if (!b) return;
    DIA = b.dataset.dia === DATOS.hoy ? null : b.dataset.dia;
    cerrarAjustes(); cambiarTab('hechos'); cargar();
  });
  $('[data-volver-hoy]').addEventListener('click', () => { DIA = null; cambiarTab('nuevos'); cargar(); });

  /* ---------- pestañas (móvil) ---------- */
  function cambiarTab(t) {
    tab = t;
    $$('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === t));
    $$('[data-col]').forEach((c) => c.classList.toggle('activa', c.dataset.col === t));
  }
  $('[data-pestanas]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) cambiarTab(b.dataset.tab); });
  cambiarTab('nuevos');

  /* ---------- arranque y refresco ---------- */
  // pedir permiso de notificaciones al primer toque (para cuando la pestaña está detrás)
  document.addEventListener('pointerdown', () => { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* nada */ } }, { once: true });
  setInterval(() => { if (PIN && !$('[data-app]').hidden) cargar(); }, 8000);
  // mientras haya pedidos sin aceptar, vuelve a sonar cada 25 s
  setInterval(() => { if (DATOS && !DIA && DATOS.pedidos.some((p) => p.estado === 'nuevo')) timbre(); }, 25000);
  // los «hace X min» se actualizan solos, sin repintar las tarjetas
  setInterval(() => { $$('[data-hace]').forEach((el) => { el.textContent = `${hora(el.dataset.hace)} · ${haceTxt(el.dataset.hace)}`; }); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pantallaEncendida(); if (PIN) cargar(); } });

  if (ACTIVAR) mostrarLogin(); else if (PIN) cargar(); else mostrarLogin();
})();
