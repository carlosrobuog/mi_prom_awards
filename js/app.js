/* PROM AWARDS 2026 — prototipo visual navegable (estado local, sin backend) */
(() => {
  'use strict';
  const { icon, ui, statuette, mark } = PA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const first = (n) => n.split(' ')[0];

  /* =====================================================================
     ESTADO (en memoria; la fuente de verdad es Supabase)
     ===================================================================== */
  const DB = PA.db;
  const fresh = () => ({
    authed: false,                  // hay sesión de Supabase
    user: null,                     // id de MI participante (null = sesión sin perfil)
    isAdmin: false,
    participants: [],
    categories: [],
    settings: { name: 'PROM AWARDS 2026', date: '2026-12-20T01:00:00Z', open: true },
    selections: {},                 // { userId: { catId: participantId } }  (ronda 1)
    runoffSel: {},                  // { catId: participantId }              (desempate vigente)
    allVotes: [],                   // admin: todos los votos de la ronda 1
    allRunoff: []                   // admin: todos los votos de desempates
  });
  let S = fresh();
  const applyBundle = (b) => {
    S = fresh();
    S.authed = b.authed; S.isAdmin = b.isAdmin;
    if (b.settings) S.settings = b.settings;
    S.categories = b.categories; S.participants = b.participants;
    S.user = b.me ? b.me.id : null;
    if (b.me) S.selections[b.me.id] = b.selections;
    S.runoffSel = b.runoffSel; S.allVotes = b.allVotes; S.allRunoff = b.allRunoff;
  };
  const refresh = async () => applyBundle(await DB.load());
  const errMsg = (e) => {
    const m = String((e && e.message) || e || '');
    if (/Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa «Ya tengo cuenta».';
    if (/password/i.test(m) && /(least|short|weak|characters)/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/valid email|invalid email|Unable to validate email/i.test(m)) return 'Escribe un correo válido.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento y reintenta.';
    if (/row-level security|permission denied|42501/i.test(m)) return 'No tienes permiso para esa acción.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión con el servidor. Reintenta.';
    return 'Algo salió mal. Intenta de nuevo.';
  };

  const P = (id) => S.participants.find((p) => p.id === id);
  const activeCats = () => S.categories.filter((c) => c.active);
  const me = () => P(S.user);
  const mySel = () => (S.selections[S.user] = S.selections[S.user] || {});
  const hasSel = (c) => !!(mySel()[c.id] && P(mySel()[c.id]));          // voto de la ronda 1
  const doneCount = () => activeCats().filter(hasSel).length;
  const roster = () => S.participants.filter((p) => p.active && p.status === 'approved');
  /* Elegibles: pueden recibir votos. Los administradores nunca lo son. */
  const eligible = () => roster().filter((p) => p.eligible);
  const eventDate = () => new Date(S.settings.date);
  const toLocalInput = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  /* ¿Se puede votar en esta categoría ahora? Ronda 1: votación abierta. Desempate: solo si el admin lo abrió */
  const votable = (c) => (c.round > 1 ? c.runoffOpen : S.settings.open);
  const selOf = (c) => (c.round > 1 ? S.runoffSel[c.id] : mySel()[c.id]);

  /* Votos reales de la ronda vigente de cada categoría (solo el admin recibe todos) */
  const votes = (catId) => {
    const c = S.categories.find((x) => x.id === catId), out = {};
    eligible().forEach((p) => { out[p.id] = 0; });
    const rows = !c ? [] : c.round > 1 ? S.allRunoff.filter((r) => r.category_id === catId && r.round === c.round) : S.allVotes.filter((r) => r.category_id === catId);
    rows.forEach((r) => { if (r.nominee_id in out) out[r.nominee_id]++; });
    return out;
  };
  const catTotal = (catId) => Object.values(votes(catId)).reduce((a, b) => a + b, 0);
  const totalNoms = () => S.allVotes.length;
  /* Resultado de una categoría: none | winner | shared | tie | runoff */
  const outcome = (c) => {
    const v = votes(c.id), max = Math.max(0, ...Object.values(v));
    const leaders = Object.keys(v).filter((id) => v[id] === max && max > 0);
    if (c.runoffOpen) return { state: 'runoff', leaders, max, v };
    if (!max) return { state: 'none', leaders: [], winners: [], max: 0, v };
    if (leaders.length === 1) return { state: 'winner', leaders, winners: leaders, max, v };
    if (c.sharedWin) return { state: 'shared', leaders, winners: leaders, max, v };
    return { state: 'tie', leaders, winners: [], max, v };
  };
  /* Cuántas categorías activas votó cada participante (admin) */
  const votedCount = (pid) => {
    const ok = new Set(activeCats().map((c) => c.id)), seen = new Set();
    S.allVotes.forEach((v) => { if (v.voter_id === pid && ok.has(v.category_id)) seen.add(v.category_id); });
    return seen.size;
  };
  const hasDone = (p) => { const n = activeCats().length; return n > 0 && votedCount(p.id) >= n; };

  /* =====================================================================
     UTILIDADES DE INTERFAZ: toasts, modales, partículas
     ===================================================================== */
  const toastEl = $('#toast');
  let toastT;
  const toast = (msg, kind = '') => {
    toastEl.innerHTML = `<div class="toast-in ${kind}">${kind === 'warn' ? '' : ui('check')}<span>${esc(msg)}</span></div>`;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 2600);
  };

  const modalRoot = $('#modal-root');
  let lastFocus = null;
  const openModal = (html, cls = '') => {
    lastFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="backdrop" data-act="modal-bg"><div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mt">${html}</div></div>`;
    document.body.classList.add('lock');
    const f = $('[autofocus], input, textarea, .btn', modalRoot);
    requestAnimationFrame(() => f && f.focus({ preventScroll: true }));
  };
  const closeModal = () => {
    modalRoot.innerHTML = '';
    document.body.classList.remove('lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalRoot.firstChild) closeModal();
    if (e.key === 'Tab' && modalRoot.firstChild) {
      const f = $$('button:not([disabled]), input, textarea, select, [href]', modalRoot);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  /* Partículas doradas muy sutiles */
  const dust = (() => {
    const cv = $('#dust'), cx = cv.getContext('2d');
    let W = 0, H = 0, parts = [], target = 40, raf = 0, last = 0;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
    const mk = (burst) => {
      const d = Math.min(devicePixelRatio || 1, 2);
      const p = { x: Math.random() * W, y: burst ? H * 0.46 : Math.random() * H, r: (Math.random() * 1.3 + 0.4) * d, a: Math.random() * 0.45 + 0.1, vx: (Math.random() - 0.5) * 0.12 * d, vy: -(Math.random() * 0.25 + 0.05) * d, ph: Math.random() * 6.28, life: burst ? 1 : 0 };
      if (burst) { const an = Math.random() * 6.28, sp = (Math.random() * 3.2 + 0.8) * d; p.vx = Math.cos(an) * sp; p.vy = Math.sin(an) * sp - 1.2 * d; p.r *= 1.5; p.a = 0.9; p.life = 1; p.burst = true; }
      return p;
    };
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 28) return; last = t;
      cx.clearRect(0, 0, W, H);
      while (parts.filter((p) => !p.burst).length < target) parts.push(mk(false));
      parts = parts.filter((p) => !(p.burst && p.life <= 0));
      for (const p of parts) {
        p.ph += 0.02; p.x += p.vx + Math.sin(p.ph) * 0.12; p.y += p.vy;
        if (p.burst) { p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.035; p.life -= 0.011; }
        else if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        const a = p.burst ? Math.max(p.life, 0) * p.a : p.a * (0.6 + 0.4 * Math.sin(p.ph * 1.6));
        cx.beginPath(); cx.fillStyle = `rgba(244,214,117,${a.toFixed(3)})`; cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
      }
    };
    addEventListener('resize', size); size();
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduce) raf = requestAnimationFrame(frame); });
    if (!reduce) raf = requestAnimationFrame(frame);
    return {
      density(n) { target = reduce ? 0 : n; },
      burst() { if (reduce) return; for (let i = 0; i < 140; i++) parts.push(mk(true)); }
    };
  })();

  /* =====================================================================
     COMPONENTES COMUNES
     ===================================================================== */
  const brand = (to = '') => `<a class="brand" href="#/${to}" aria-label="PROM AWARDS 2026, inicio">${mark()}<span>PROM AWARDS</span></a>`;
  const orn = () => '<div class="orn" aria-hidden="true"><i></i><b></b><i></i></div>';
  const medal = (k) => `<span class="medal">${icon(k)}</span>`;
  const hue = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const pic = (p, cls = '', alt = null, eager = false) => p.photo
    ? `<img class="${cls}" src="${esc(p.photo)}" alt="${esc(alt == null ? p.name : alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`
    : `<span class="${cls} ph-ico" style="--h:${hue(p.id)}" role="img" aria-label="${esc(alt == null ? p.name : alt)}">${icon(p.icon || 'star')}</span>`;
  const avatar = (p, cls = '') => pic(p, `av ${cls}`);
  const randIcon = () => PA.ICON_KEYS[Math.floor(Math.random() * PA.ICON_KEYS.length)];
  const catNum = (c) => pad(S.categories.indexOf(c) + 1);

  const LOGOUT = `<button class="btn btn-sm btn-out" data-act="logout" aria-label="Cerrar sesión">${ui('out')}<span><span class="long">Cerrar sesión</span><span class="short">Salir</span></span></button>`;
  const backBtn = (href) => `<a class="btn btn-sm btn-ghost back-btn" href="${href}" aria-label="Volver a la página anterior">${ui('back')}<span>Volver</span></a>`;
  const appBar = (active, back) => {
    const u = me();
    return `<div class="wrap bar-in">
      <div class="bar-l">${back ? backBtn(back) : ''}${brand('dashboard')}</div>
      <nav class="bar-nav" aria-label="Principal">
        <a href="#/dashboard" class="${active === 'dash' ? 'on' : ''}">Mi espacio</a>
        <a href="#/categorias" class="${active === 'cats' ? 'on' : ''}">Categorías</a>
        <a href="#/resumen" class="${active === 'sum' ? 'on' : ''}">Mis votos</a>
        ${S.isAdmin ? '<a href="#/admin">Administración</a>' : ''}
      </nav>
      <div class="bar-user">
        <span class="bar-name">${esc(first(u.name))}</span>
        ${avatar(u, 'av-sm')}
        ${LOGOUT}
      </div>
    </div>`;
  };

  const statusChip = (done) => done
    ? `<span class="chip chip-ok">${ui('check')}Completada</span>`
    : '<span class="chip">Pendiente</span>';

  /* =====================================================================
     VISTAS
     ===================================================================== */
  const views = {};

  /* ---------- 1. LANDING ---------- */
  views[''] = () => {
    const cats = activeCats();
    const open = S.settings.open;
    const d = eventDate();
    const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const dateTxt = `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
    const timeTxt = `${pad(d.getHours())}:${pad(d.getMinutes())} h`;
    return {
      title: 'PROM AWARDS 2026',
      dust: 70,
      headClass: 'nav',
      head: `<div class="wrap nav-in">
        ${brand()}
        <nav class="nav-links" aria-label="Secciones">
          <a href="#/" data-act="scroll" data-to="#categorias">Categorías</a>
          <a href="#/" data-act="scroll" data-to="#evento">El evento</a>
          <a href="#/" data-act="scroll" data-to="#como">Cómo participar</a>
        </nav>
        ${S.isAdmin ? `<span class="nav-btns"><a class="btn btn-sm" href="#/admin">Administración</a>${LOGOUT.replace('btn-out', 'btn-ghost')}</span>` : S.user ? `<span class="nav-btns"><a class="btn btn-sm" href="#/dashboard">Mi espacio</a>${LOGOUT.replace('btn-out', 'btn-ghost')}</span>` : '<a class="btn btn-sm" href="#/acceso">Entrar</a>'}
      </div>`,
      html: `
      <section class="hero" id="inicio">
        <div class="hero-light" aria-hidden="true"><i class="beam"></i><i class="pool"></i><i class="carpet"></i></div>
        <div class="hero-stage">
          <div class="statue rise" style="--d:.1s">${statuette('h')}</div>
        </div>
        <div class="wrap hero-copy">
          <p class="eyebrow rise" style="--d:.5s">Edición ${d.getFullYear()} · Reencuentro de promoción</p>
          <h1 class="display rise" style="--d:.65s"><span class="gold-text">PROM AWARDS</span><span class="year">${orn()}<b>${d.getFullYear()}</b>${orn()}</span></h1>
          <p class="tagline rise" style="--d:.85s">Una promoción. Muchas historias. Grandes ganadores.</p>
          <p class="lede rise" style="--d:1s">Llegó el momento de reconocer a los personajes que hicieron inolvidable nuestra promoción.</p>
          <div class="actions rise" style="--d:1.15s">
            <a class="btn btn-lg" href="#/acceso">Entrar a los premios</a>
            <a class="btn btn-ghost btn-lg" href="#/" data-act="scroll" data-to="#categorias">Conocer las categorías</a>
          </div>
        </div>
        <button class="scroll-cue" data-act="scroll" data-to="#evento" aria-label="Ver información del evento">${ui('down')}</button>
      </section>

      <section class="sec sec-alt" id="evento"><div class="wrap">
        <header class="sec-head"><p class="eyebrow">La gala</p><h2 class="h2">Cuenta regresiva al reencuentro</h2>${orn()}</header>
        <div class="count" data-count aria-label="Cuenta regresiva" role="timer">
          <div><b data-u="d">00</b><span>Días</span></div><em>:</em>
          <div><b data-u="h">00</b><span>Horas</span></div><em>:</em>
          <div><b data-u="m">00</b><span>Minutos</span></div><em>:</em>
          <div><b data-u="s">00</b><span>Segundos</span></div>
        </div>
        <dl class="facts">
          <div><dt>Fecha del reencuentro</dt><dd>${esc(dateTxt)}<small>${timeTxt}</small></dd></div>
          <div><dt>Votaciones</dt><dd class="${open ? 'is-open' : 'is-closed'}"><i class="dot"></i>${open ? 'Abiertas' : 'Cerradas'}</dd></div>
          <div><dt>Edición</dt><dd>${d.getFullYear()}</dd></div>
          <div><dt>Categorías</dt><dd>${cats.length}</dd></div>
        </dl>
      </div></section>

      <section class="sec" id="categorias"><div class="wrap">
        <header class="sec-head"><p class="eyebrow">Las categorías</p><h2 class="h2">Cada promoción tiene sus personajes</h2>${orn()}</header>
        <ol class="cat-index">
          ${cats.map((c, i) => `<li><a href="#/acceso" class="cat-line"><span class="n">${pad(i + 1)}</span>${icon(c.icon, 'ci')}<span class="t">${esc(c.name)}</span>${ui('next', 'go')}</a></li>`).join('')}
        </ol>
        <div class="center"><a class="btn" href="#/acceso">Votar por mis compañeros</a></div>
      </div></section>

      <section class="sec sec-alt" id="como"><div class="wrap">
        <header class="sec-head"><p class="eyebrow">Cómo participar</p><h2 class="h2">Tres pasos hacia la alfombra roja</h2>${orn()}</header>
        <ol class="steps">
          <li><span class="step-n">I</span><h3>Regístrate</h3><p>Crea tu perfil con tu nombre, tu alias y una fotografía. Sin trámites.</p></li>
          <li><span class="step-n">II</span><h3>Vota</h3><p>Elige a un compañero por categoría, tocando su fotografía. Tu voto se guarda al instante.</p></li>
          <li><span class="step-n">III</span><h3>Conoce a los ganadores</h3><p>Cuando el organizador cierre la votación, gana quien tenga más votos en cada categoría.</p></li>
        </ol>
      </div></section>

      `,
      footClass: 'foot closing',
      foot: `<div class="wrap foot-in">
        <div class="foot-l">${brand()}<p>Una promoción. Muchas historias.</p></div>
        <a class="foot-admin" href="#/admin">${ui('lock')}Administración</a>
      </div>`,
      mount: () => {
        startCountdown();
        const nav = $('#site-head');
        const onScroll = () => nav && nav.classList.toggle('solid', scrollY > 40);
        onScroll(); addEventListener('scroll', onScroll, { passive: true });
        cleanup.push(() => removeEventListener('scroll', onScroll));
      }
    };
  };

  let cdTimer;
  const startCountdown = () => {
    const el = $('[data-count]');
    if (!el) return;
    const tick = () => {
      let s = Math.max(0, Math.floor((eventDate() - Date.now()) / 1000));
      const v = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
      for (const k in v) { const b = $(`[data-u="${k}"]`, el); if (b) b.textContent = pad(v[k]); }
    };
    tick(); clearInterval(cdTimer); cdTimer = setInterval(tick, 1000);
    cleanup.push(() => clearInterval(cdTimer));
  };

  /* ---------- 2. ACCESO (registro simple + login) ---------- */
  let accessMode = 'registro';     // registro | entrar | perfil
  let afterLogin = null;           // destino pedido antes de iniciar sesión (p. ej. 'admin')
  let reg = { photo: null, icon: randIcon() };
  const resetReg = () => { reg = { photo: null, icon: randIcon() }; };
  const regPreview = () => reg.photo
    ? `<img src="${esc(reg.photo)}" alt="Tu fotografía">`
    : `<span class="ph-ico" style="--h:${hue(reg.icon)}" aria-hidden="true">${icon(reg.icon)}</span>`;
  views.acceso = () => {
    const adminIntent = afterLogin === 'admin' && !(S.authed && !S.user);
    if (adminIntent) accessMode = 'entrar';
    else if (S.authed && !S.user) accessMode = 'perfil';
    else if (accessMode === 'perfil') accessMode = 'registro';
    const m = accessMode, profile = m === 'registro' || m === 'perfil', creds = m !== 'perfil';
    return {
      title: 'Acceso · PROM AWARDS 2026',
      dust: 40,
      html: `
      <section class="access">
        <div class="access-art" aria-hidden="true"><div class="art-light"></div>${statuette('a')}</div>
        <div class="access-pane">
          <a class="btn btn-sm btn-ghost back-link" href="#/">${ui('back')}Volver</a>
          <div class="access-card rise">
            ${mark()}
            <p class="eyebrow">${adminIntent ? 'Administración' : m === 'entrar' ? 'Acceso del participante' : m === 'perfil' ? 'Último paso' : 'Registro de la promoción'}</p>
            <h1 class="h1">${adminIntent ? 'Acceso de administración.' : m === 'entrar' ? 'Bienvenido de vuelta.' : m === 'perfil' ? 'Completa tu perfil.' : 'Únete a los PROM AWARDS.'}</h1>
            <p class="muted">${adminIntent ? 'Entra con la cuenta de administrador.' : m === 'entrar' ? 'Entra con tu correo y tu contraseña.' : 'Cuéntanos quién eres. El organizador revisará tu solicitud antes de darte acceso.'}</p>
            ${orn()}
            ${m === 'perfil' || adminIntent ? '' : `<div class="tabs" role="tablist" aria-label="Acceso">
              <button type="button" role="tab" class="tab ${m === 'registro' ? 'on' : ''}" aria-selected="${m === 'registro'}" data-act="acc-mode" data-k="registro">Crear cuenta</button>
              <button type="button" role="tab" class="tab ${m === 'entrar' ? 'on' : ''}" aria-selected="${m === 'entrar'}" data-act="acc-mode" data-k="entrar">Ya tengo cuenta</button>
            </div>`}
            <form id="access-form" autocomplete="on" novalidate>
              ${profile ? `
              <div class="avatar-up">
                <div class="avatar-prev" id="reg-prev">${regPreview()}</div>
                <div class="avatar-ctl">
                  <label class="btn btn-sm btn-ghost file">${ui('upload')}Subir fotografía<input id="reg-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
                  <button type="button" class="btn btn-sm btn-ghost" data-act="reg-dice" id="reg-dice" ${reg.photo ? 'hidden' : ''}>${ui('refresh')}Otro icono</button>
                  <button type="button" class="btn btn-sm btn-ghost" data-act="reg-nophoto" id="reg-nophoto" ${reg.photo ? '' : 'hidden'}>${ui('trash')}Quitar</button>
                </div>
                <p class="fine" id="reg-hint">${reg.photo ? 'Así te verán tus compañeros.' : 'Opcional. Si no subes una, te damos un icono al azar.'}</p>
              </div>
              <label class="field"><span class="label">Nombre completo</span><input id="f-name" type="text" autocomplete="name" maxlength="80" placeholder="Ej. Lucía Fernández Rojas" required></label>
              <label class="field"><span class="label">Alias</span><input id="f-alias" type="text" maxlength="40" placeholder="Ej. Lucha" required></label>` : ''}
              ${creds ? `
              <label class="field"><span class="label">Correo</span><input id="f-email" type="email" autocomplete="email" inputmode="email" placeholder="tucorreo@ejemplo.com" required></label>
              <label class="field"><span class="label">Contraseña</span><input id="f-pass" type="password" autocomplete="${m === 'entrar' ? 'current-password' : 'new-password'}" minlength="6" placeholder="${m === 'entrar' ? 'Tu contraseña' : 'Mínimo 6 caracteres'}" required></label>` : ''}
              <button class="btn btn-block" type="submit" id="acc-go">${m === 'entrar' ? 'Entrar' : 'Enviar solicitud'}</button>
            </form>
            <p class="fine">${m === 'perfil' ? '<a href="#/acceso" data-act="acc-out">Usar otra cuenta</a>' : 'El organizador aprobará tu solicitud.'}</p>
          </div>
        </div>
      </section>`,
      mount: () => {
        const form = $('#access-form'), btn = $('#acc-go');
        const file = $('#reg-file');
        if (file) file.addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          if (f.size > 12 * 1024 * 1024) { toast('La imagen es muy pesada (máx. 12 MB).', 'warn'); return; }
          try { reg.photo = await shrink(f); setRegPhoto(); } catch (err) { toast('No se pudo leer la imagen.', 'warn'); }
        });
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = (id) => ($(id) ? $(id).value.trim() : '');
          const name = v('#f-name'), alias = v('#f-alias'), email = v('#f-email').toLowerCase(), pass = $('#f-pass') ? $('#f-pass').value : '';
          if (profile && (name.length < 3 || !/\s/.test(name))) { toast('Escribe tu nombre completo.', 'warn'); $('#f-name').focus(); return; }
          if (profile && !alias) { toast('Escribe tu alias.', 'warn'); $('#f-alias').focus(); return; }
          if (creds && !/^\S+@\S+\.\S+$/.test(email)) { toast('Escribe un correo válido.', 'warn'); $('#f-email').focus(); return; }
          if (creds && pass.length < 6) { toast('La contraseña debe tener al menos 6 caracteres.', 'warn'); $('#f-pass').focus(); return; }
          const label = btn.innerHTML;
          btn.disabled = true; btn.innerHTML = '<i class="spin"></i>Un momento…';
          try {
            if (m === 'registro') {
              const session = await DB.signUp(email, pass);
              if (!session) { toast('Cuenta creada, pero el proyecto aún pide confirmar el correo. Avisa al administrador.', 'warn'); btn.disabled = false; btn.innerHTML = label; return; }
            } else if (m === 'entrar') {
              await DB.signIn(email, pass);
            }
            if (profile) await DB.createProfile({ name, alias, photo: reg.photo, icon: reg.icon });
            await refresh();
            const dest = afterLogin; afterLogin = null;
            if (S.isAdmin) { toast('Bienvenido a la administración.'); go('admin'); return; }
            if (dest === 'admin') toast('Esa cuenta no es de administrador.', 'warn');
            if (!S.user) { accessMode = 'perfil'; render(); return; }
            if (profile) resetReg();
            if (me().status !== 'approved') { toast('Solicitud enviada. Espera la aprobación del organizador.'); go('pendiente'); return; }
            toast(`Bienvenido, ${first(me().name)}.`);
            go('dashboard');
          } catch (err) {
            console.error(err); toast(errMsg(err), 'warn');
            btn.disabled = false; btn.innerHTML = label;
            if (m === 'registro') { try { await refresh(); if (S.authed && !S.user) { accessMode = 'perfil'; render(); } } catch (e2) { /* se queda en el formulario */ } }
          }
        });
      }
    };
  };
  const setRegPhoto = () => {
    $('#reg-prev').innerHTML = regPreview();
    $('#reg-dice').hidden = !!reg.photo; $('#reg-nophoto').hidden = !reg.photo;
    $('#reg-hint').textContent = reg.photo ? 'Así te verán tus compañeros.' : 'Opcional. Si no subes una, te damos un icono al azar.';
  };

  /* ---------- 3. DASHBOARD ---------- */
  views.dashboard = () => {
    const u = me(), cats = activeCats(), done = doneCount(), total = cats.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const open = S.settings.open;
    const runoffs = cats.filter((c) => c.runoffOpen);
    const next = cats.findIndex((c) => !hasSel(c));
    const complete = total > 0 && done === total;
    let cta;
    if (open) cta = done === 0
      ? `<a class="btn" href="#/nominar/1">Empezar a votar</a><a class="btn btn-ghost" href="#/categorias">Ver categorías</a>`
      : `<a class="btn" href="#/nominar/${(next < 0 ? 0 : next) + 1}">${complete ? 'Revisar mis votos' : 'Seguir votando'}</a><a class="btn btn-ghost" href="#/resumen">Ver mis votos</a>`;
    else if (runoffs.length) cta = `<a class="btn" href="#/nominar/${cats.indexOf(runoffs[0]) + 1}">Votar en el desempate</a><a class="btn btn-ghost" href="#/resumen">Ver mis votos</a>`;
    else cta = `<a class="btn btn-ghost" href="#/resumen">Ver mis votos</a>`;
    const head = open ? 'Las votaciones están abiertas.' : runoffs.length ? 'Hay un desempate abierto.' : 'Las votaciones están cerradas.';
    const text = open ? 'Elige a un compañero por categoría. Tu voto se guarda al tocarlo y puedes cambiarlo hasta que el organizador cierre la votación.'
      : runoffs.length ? `Hubo empate en ${runoffs.map((c) => '«' + esc(c.name) + '»').join(', ')}. Vota solo entre los empatados.`
      : 'Gracias por participar. El organizador anunciará a los ganadores.';
    const state = complete ? 'Votos completos' : 'Faltan votos';
    return {
      title: 'Mi espacio · PROM AWARDS 2026',
      dust: 30,
      headClass: 'bar',
      head: appBar('dash'),
      html: `
      <section class="wrap page">
        <section class="greet rise">
          <div class="greet-photo">${avatar(u, 'av-xl')}<i></i></div>
          <div><p class="eyebrow">PROM AWARDS 2026</p>
          <h1 class="h1">¡Hola, ${esc(first(u.name).toUpperCase())}!</h1>
          <p class="serif lede-s">Es momento de votar por los personajes de nuestra promoción.</p></div>
        </section>

        <section class="spot rise" style="--d:.12s">
          <div class="spot-text">
            <p class="eyebrow">${open ? 'Votación' : runoffs.length ? 'Desempate' : 'Votación cerrada'}</p>
            <h2 class="h2">${head}</h2>
            <p class="muted">${text}</p>
            <div class="actions">${cta}</div>
          </div>
          <div class="spot-art" aria-hidden="true">${statuette('d')}</div>
        </section>

        <section class="stats rise" style="--d:.2s" aria-label="Tu progreso">
          <div><b>${total}</b><span>Categorías disponibles</span></div>
          <div><b>${done}</b><span>Categorías votadas</span></div>
          <div class="stat-prog"><b>${pct}<small>%</small></b><span>Progreso</span><i class="meter"><u style="width:${pct}%"></u></i></div>
          <div><span class="chip ${complete ? 'chip-ok' : 'chip-warn'}">${complete ? ui('check') : '<i class="dot"></i>'}${state}</span><span>Estado</span></div>
        </section>

        <section class="rise" style="--d:.28s">
          <header class="row-head"><h2 class="h3">Categorías</h2><a class="link" href="#/categorias">Ver todas ${ui('next')}</a></header>
          <div class="mini-grid">
            ${cats.map((c, i) => {
              const sv = hasSel(c);
              return `<a class="mini ${sv ? 'done' : ''}" href="#/nominar/${i + 1}"><span class="n">${pad(i + 1)}</span><span class="t">${esc(c.name)}</span><i class="tick" aria-label="${sv ? 'Votada' : 'Pendiente'}">${sv ? ui('check') : ''}</i></a>`;
            }).join('')}
          </div>
        </section>
      </section>`
    };
  };

  /* ---------- 4. CATÁLOGO ---------- */
  let catFilter = 'all';
  views.categorias = () => {
    const cats = activeCats(), open = S.settings.open;
    const nDone = cats.filter(hasSel).length;
    const list = cats.filter((c) => catFilter === 'all' || (catFilter === 'done') === hasSel(c));
    return {
      title: 'Categorías · PROM AWARDS 2026',
      dust: 26,
      headClass: 'bar',
      head: appBar('cats', '#/dashboard'),
      html: `
      <section class="wrap page">
        <header class="page-head rise">
          <p class="eyebrow">${cats.length} categorías · ${nDone} votadas</p>
          <h1 class="h1">Las categorías.</h1>
          <p class="serif lede-s">Cada promoción tiene sus personajes. Llegó el momento de reconocerlos.</p>
          ${orn()}
        </header>
        <div class="tabs rise" role="tablist" aria-label="Filtrar categorías" style="--d:.1s">
          ${[['all', 'Todas', cats.length], ['pend', 'Pendientes', cats.length - nDone], ['done', 'Votadas', nDone]].map(([k, l, n]) => `<button role="tab" aria-selected="${catFilter === k}" class="tab ${catFilter === k ? 'on' : ''}" data-act="cat-filter" data-k="${k}">${l}<small>${n}</small></button>`).join('')}
        </div>
        <div class="cat-grid">
          ${list.length ? list.map((c) => {
            const i = cats.indexOf(c), sv = hasSel(c), nom = sv ? P(mySel()[c.id]) : null;
            return `<article class="cat-card ${sv ? 'done' : ''}" style="--d:${Math.min(i, 12) * 0.04}s" data-act="go" data-to="nominar/${i + 1}">
              <header><span class="n">${pad(i + 1)}</span>${medal(c.icon)}</header>
              <h2 class="cat-name">${esc(c.name)}</h2>
              <p class="cat-desc">“${esc(c.desc)}”</p>
              <footer>
                ${nom ? `<span class="nom">${avatar(nom, 'av-xs')}<span>${esc(nom.name)}</span></span>` : '<span class="chip">Pendiente</span>'}
                <a class="btn btn-sm ${sv ? 'btn-ghost' : ''}" href="#/nominar/${i + 1}">${!open ? 'Ver' : sv ? 'Cambiar' : 'Votar'}</a>
              </footer>
            </article>`;
          }).join('') : `<p class="empty">${catFilter === 'done' ? 'Aún no has votado en ninguna categoría.' : '¡Has votado en todas las categorías!'}</p>`}
        </div>
        <div class="actions center end"><a class="btn btn-ghost" href="#/dashboard">Volver al panel</a><a class="btn" href="#/resumen">Ver mis votos</a></div>
      </section>`
    };
  };

  /* ---------- 5. VOTAR ---------- */
  let navDir = 'next';
  views.nominar = (arg) => {
    const cats = activeCats();
    const n = Math.min(Math.max(parseInt(arg, 10) || 1, 1), cats.length);
    const c = cats[n - 1];
    if (!c) return views.categorias();
    const runoff = c.round > 1 && c.runoffOpen, can = votable(c), sel = selOf(c);
    const people = eligible().filter((p) => !runoff || c.runoffCandidates.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return {
      title: `${c.name} · PROM AWARDS 2026`,
      dust: 18,
      headClass: 'bar',
      head: appBar('cats', runoff ? '#/dashboard' : '#/categorias'),
      html: `
      <section class="wrap page nominate" data-cat="${c.id}">
        <div class="slide dir-${navDir}">
          <header class="nom-head">
            <div class="nom-title">
              <span class="nom-num gold-text" aria-hidden="true">${pad(n)}</span>
              <div>
                <p class="eyebrow">${runoff ? 'Desempate · solo entre los empatados' : `Categoría ${n} de ${cats.length}`}</p>
                <h1 class="h1 nom-h">${esc(c.name)}.</h1>
                <p class="serif lede-s">${esc(c.desc)}</p>
              </div>
              ${medal(c.icon)}
            </div>
            ${runoff ? '' : `<nav class="rail" aria-label="Categorías">
              ${cats.map((x, i) => `<a href="#/nominar/${i + 1}" class="rail-i ${hasSel(x) ? 'done' : ''} ${i + 1 === n ? 'cur' : ''}" aria-label="Categoría ${i + 1}: ${esc(x.name)}" ${i + 1 === n ? 'aria-current="step"' : ''}>${pad(i + 1)}</a>`).join('')}
            </nav>`}
          </header>
          <div class="nom-tools">
            <label class="search">${ui('search')}<span class="sr">Buscar compañero</span><input id="q" type="search" placeholder="BUSCAR COMPAÑERO..." autocomplete="off"></label>
            <div class="banner" id="banner" role="status" aria-live="polite"></div>
          </div>
          <div class="pgrid" id="pgrid">
            ${people.map((p, i) => {
              const self = p.id === S.user;
              return `<button class="pcard ${sel === p.id ? 'sel' : ''} ${self ? 'self' : ''}" data-act="pick" data-id="${p.id}" data-name="${esc((p.name + ' ' + p.alias).toLowerCase())}" aria-pressed="${sel === p.id}" ${can ? '' : 'disabled'} style="--i:${Math.min(i, 16)}">
                <span class="frame">${pic(p, '', 'Fotografía de ' + p.name, i < 8)}<i class="glow"></i></span>
                <span class="tick">${ui('check')}</span>
                <span class="cap"><b>${esc(p.name)}</b>${p.alias ? `<small class="alias">“${esc(p.alias)}”</small>` : ''}${self ? '<em>Eres tú</em>' : '<em class="on-sel">Tu voto</em>'}</span>
              </button>`;
            }).join('')}
          </div>
          <p class="empty" id="none" hidden>Ningún compañero coincide con tu búsqueda.</p>
        </div>
      </section>
      <nav class="dock actionbar" aria-label="${runoff ? 'Desempate' : 'Navegación entre categorías'}"><div class="wrap dock-in">
        <div class="dock-prog"><span>${runoff ? 'Desempate' : `Categoría ${n} de ${cats.length}`}</span><i class="meter"><u id="dock-bar" style="width:${runoff ? 100 : (n / cats.length) * 100}%"></u></i><small id="dock-done"></small></div>
        <div class="dock-btns">
          ${runoff
            ? `<a class="btn" href="#/dashboard"><span>Listo, volver al panel</span>${ui('next')}</a>`
            : `<button class="btn btn-ghost" data-act="nav-prev" ${n === 1 ? 'disabled' : ''}>${ui('back')}<span><span class="long">Categoría </span>anterior</span></button>
          <button class="btn" data-act="nav-next"><span>${n === cats.length ? 'Ver mis votos' : 'Siguiente<span class="long"> categoría</span>'}</span>${ui('next')}</button>`}
        </div>
      </div></nav>`,
      mount: () => {
        updateNominate();
        const q = $('#q');
        q.addEventListener('input', () => {
          const t = q.value.trim().toLowerCase();
          let shown = 0;
          $$('.pcard').forEach((b) => { const ok = !t || b.dataset.name.includes(t); b.hidden = !ok; if (ok) shown++; });
          $('#none').hidden = shown > 0;
        });
        const cur = $('.rail-i.cur');
        if (cur) cur.parentElement.scrollLeft = cur.offsetLeft - cur.parentElement.clientWidth / 2 + cur.clientWidth / 2;
      }
    };
  };

  const updateNominate = () => {
    const root = $('.nominate'); if (!root) return;
    const cats = activeCats(), c = cats.find((x) => x.id === root.dataset.cat);
    const sel = selOf(c);
    $$('.pcard').forEach((b) => { const on = b.dataset.id === sel; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    const ban = $('#banner');
    if (!votable(c)) {
      ban.className = 'banner';
      ban.innerHTML = `<span><em>${sel && P(sel) ? 'Tu voto: ' + esc(P(sel).name) + '. ' : ''}La votación está cerrada.</em></span>`;
    } else if (sel && P(sel)) {
      ban.className = 'banner on';
      ban.innerHTML = `${ui('check')}<span><b>TU VOTO</b><em>${esc(P(sel).name)}</em></span><small class="st" id="save-st"></small>`;
    } else {
      ban.className = 'banner';
      ban.innerHTML = `<span><em>Toca una fotografía para votar: se guarda sola. Si tocas otra, cambia tu voto.</em></span>`;
    }
    $$('.rail-i').forEach((a, i) => a.classList.toggle('done', hasSel(cats[i])));
    const d = doneCount();
    const dd = $('#dock-done'); if (dd) dd.textContent = `${d} de ${cats.length} votadas`;
  };

  /* ---------- 6. MIS VOTOS ---------- */
  views.resumen = () => {
    const cats = activeCats(), open = S.settings.open;
    const done = doneCount(), pend = cats.length - done;
    const runoffs = cats.filter((c) => c.runoffOpen);
    return {
      title: 'Mis votos · PROM AWARDS 2026',
      dust: 22,
      headClass: 'bar',
      head: appBar('sum', '#/dashboard'),
      html: `
      <section class="wrap page">
        <header class="page-head rise">
          <p class="eyebrow">${open ? 'Tu votación' : 'Votación cerrada'}</p>
          <h1 class="h1">Mis votos.</h1>
          <p class="serif lede-s">${open ? 'Tus votos se guardan solos. Puedes cambiarlos hasta que el organizador cierre la votación.' : 'La votación está cerrada. Estos son los votos que diste.'}</p>
          ${orn()}
        </header>
        <section class="stats compact rise" style="--d:.08s" aria-label="Totales">
          <div><b>${done}</b><span>Categorías votadas</span></div>
          <div><b>${pend}</b><span>Categorías pendientes</span></div>
        </section>
        ${runoffs.length ? `<section class="callout warn rise"><span>${ui('bell')}</span><span><b>Desempate abierto</b> ${runoffs.map((c) => `<a class="link" href="#/nominar/${cats.indexOf(c) + 1}">${esc(c.name)}</a>`).join(' · ')}</span></section>` : ''}
        <ul class="sum-list">
          ${cats.map((c, i) => {
            const sv = hasSel(c), nom = sv ? P(mySel()[c.id]) : null;
            return `<li class="sum-row ${sv ? '' : 'pending'}" style="--d:${Math.min(i, 14) * 0.035}s">
              <span class="n">${pad(i + 1)}</span>
              <span class="sum-cat">${icon(c.icon, 'ci')}<b>${esc(c.name)}</b></span>
              <span class="sum-nom">${nom ? `${avatar(nom, 'av-md')}<span>${esc(nom.name)}</span>` : '<i class="ghost-av"></i><span class="muted caps">Sin voto</span>'}</span>
              ${open ? `<a class="btn btn-sm btn-ghost" href="#/nominar/${i + 1}">${sv ? ui('edit') + 'Cambiar' : 'Votar'}</a>` : '<span></span>'}
            </li>`;
          }).join('')}
        </ul>
        <div class="actions center end">
          ${open ? '<a class="btn" href="#/categorias">Seguir votando</a>' : '<a class="btn btn-ghost" href="#/dashboard">Volver al panel</a>'}
        </div>
      </section>`
    };
  };

  /* ---------- SOLICITUD PENDIENTE / RECHAZADA ---------- */
  views.pendiente = () => {
    const u = me(), rej = u.status === 'rejected';
    return {
      title: 'Tu solicitud · PROM AWARDS 2026',
      dust: 30,
      html: `<section class="access"><div class="access-pane"><div class="access-card rise">
        ${mark()}
        <p class="eyebrow">${rej ? 'Solicitud no aprobada' : 'Solicitud enviada'}</p>
        ${avatar(u, 'av-xl')}
        <h1 class="h1">${rej ? 'No pudimos aprobar tu acceso.' : `¡Gracias, ${esc(first(u.name))}!`}</h1>
        <p class="muted">${rej ? 'Si crees que es un error, habla con el organizador.' : 'El organizador revisará tu solicitud. Cuando la apruebe podrás votar por tus compañeros. Esta pantalla se actualiza sola.'}</p>
        ${orn()}
        <div class="actions center">${rej ? '' : '<button class="btn" data-act="pend-check">Comprobar ahora</button>'}${LOGOUT.replace('btn-out', 'btn-ghost')}</div>
      </div></div></section>`,
      mount: () => {
        if (rej) return;
        const t = setInterval(async () => {
          try { await refresh(); } catch (e) { return; }
          if (me() && me().status === 'approved') { toast('¡Tu solicitud fue aprobada!'); go('dashboard'); }
        }, 15000);
        cleanup.push(() => clearInterval(t));
      }
    };
  };

  /* ---------- Campana de solicitudes (admin) ---------- */
  const pendingReqs = () => S.participants.filter((p) => p.status === 'pending');
  const bellBtn = () => {
    const n = pendingReqs().length;
    return `<button class="icon-btn bell" data-act="bell" aria-label="Solicitudes de acceso: ${n} pendientes">${ui('bell')}<b class="badge" id="bell-n" ${n ? '' : 'hidden'}>${n}</b></button>`;
  };
  const ago = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 1) return 'justo ahora';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
  };
  const bellModal = () => {
    const list = pendingReqs();
    openModal(`
      <header class="modal-head"><h2 class="h3" id="mt">Solicitudes de acceso</h2><button class="icon-btn" data-act="modal-close" aria-label="Cerrar">${ui('close')}</button></header>
      <div class="modal-body">
        ${list.length ? `<ul class="reqs">${list.map((p) => `<li class="req">
          ${avatar(p, 'av-md')}
          <span class="req-t"><b>${esc(p.name)}</b><em>${p.alias ? '“' + esc(p.alias) + '” · ' : ''}${ago(p.createdAt)}</em></span>
          <span class="req-a"><button class="btn btn-sm" data-act="req-ok" data-id="${p.id}">${ui('check')}Aprobar</button><button class="btn btn-sm btn-ghost" data-act="req-no" data-id="${p.id}">Rechazar</button></span>
        </li>`).join('')}</ul>` : '<p class="empty">No hay solicitudes pendientes.</p>'}
      </div>
      <div class="modal-actions">${list.length > 1 ? '<button class="btn btn-ghost" data-act="req-all">Aprobar todas</button>' : '<span></span>'}<button class="btn btn-ghost" data-act="modal-close">Cerrar</button></div>`, 'modal-lg');
  };
  const decide = async (id, status) => {
    try {
      await DB.setStatus(id, status); await refresh();
      toast(status === 'approved' ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
      render({ keep: true }); bellModal();
    } catch (e) { console.error(e); toast(errMsg(e), 'warn'); }
  };
  let seenPending = null;
  const startBellPoll = () => {
    seenPending = pendingReqs().length;
    const t = setInterval(async () => {
      try {
        const n = await DB.pendingCount(), el = $('#bell-n');
        if (el) { el.textContent = n; el.hidden = !n; }
        if (n > seenPending) toast('Nueva solicitud de acceso.');
        seenPending = n;
      } catch (e) { /* reintenta en el siguiente ciclo */ }
    }, 25000);
    cleanup.push(() => clearInterval(t));
  };

  /* =====================================================================
     ADMINISTRACIÓN
     ===================================================================== */
  const ADMIN_NAV = [['', 'Resumen', 'grid'], ['participantes', 'Participantes', 'users'], ['categorias', 'Categorías', 'tag'], ['nominaciones', 'Resultados', 'chart'], ['configuracion', 'Configuración', 'gear']];
  /* Avisos arriba del panel: empates por resolver y desempates en curso (solo con la votación cerrada) */
  const adminAlerts = () => {
    if (S.settings.open) return '';
    const cs = activeCats(), ties = cs.filter((c) => outcome(c).state === 'tie'), run = cs.filter((c) => c.runoffOpen);
    let h = '';
    if (ties.length) h += `<a class="alert warn" href="#/admin/nominaciones">${ui('bell')}<span><b>Empate en ${ties.length} ${ties.length === 1 ? 'categoría' : 'categorías'}.</b> ${esc(ties.map((c) => c.name).join(' · '))}. Decide si comparten el premio o abre un desempate.</span><i>Resolver ${ui('next')}</i></a>`;
    if (run.length) h += `<a class="alert" href="#/admin/nominaciones">${ui('chart')}<span><b>Desempate en curso en ${run.length} ${run.length === 1 ? 'categoría' : 'categorías'}.</b> ${esc(run.map((c) => c.name).join(' · '))}.</span><i>Ver ${ui('next')}</i></a>`;
    return h;
  };
  const adminShell = (key, title, sub, inner, actions = '') => `
    <section class="admin">
      <aside class="side">
        <div class="side-top">${brand('admin')}<span class="side-tag">Administración</span></div>
        <nav class="side-nav" aria-label="Administración">
          ${ADMIN_NAV.map(([k, l, ic]) => `<a href="#/admin${k ? '/' + k : ''}" class="${k === key ? 'on' : ''}" ${k === key ? 'aria-current="page"' : ''}>${ui(ic)}<span>${l}</span></a>`).join('')}
        </nav>
        <a class="side-back" href="#/">${ui('home')}<span>Volver al sitio</span></a>
      </aside>
      <div class="admin-main">
        ${adminAlerts()}
        <header class="admin-head rise"><div><p class="eyebrow">${sub}</p><h1 class="h1">${title}</h1></div><div class="actions">${actions}${bellBtn()}${LOGOUT.replace('btn-out', 'btn-ghost')}</div></header>
        ${inner}
      </div>
    </section>`;

  const adminStats = () => {
    const done = eligible().filter(hasDone).length, tot = eligible().length;
    return { done, tot, pct: tot ? Math.round((done / tot) * 100) : 0, cats: S.categories.filter((c) => c.active).length, noms: totalNoms() };
  };

  const adminDenied = () => ({
    title: 'Administración · PROM AWARDS',
    dust: 20,
    html: `<section class="access"><div class="access-pane"><div class="access-card rise">
      ${mark()}
      <p class="eyebrow">Administración</p>
      <h1 class="h1">Acceso restringido.</h1>
      <p class="muted">${S.authed ? 'Tu cuenta no tiene permisos de administrador.' : 'Inicia sesión con una cuenta de administrador para continuar.'}</p>
      ${orn()}
      <div class="actions center">${S.authed ? '<a class="btn" href="#/dashboard">Ir a mi espacio</a>' : '<a class="btn" href="#/acceso" data-act="acc-admin">Iniciar sesión</a>'}<a class="btn btn-ghost" href="#/">Volver al inicio</a></div>
    </div></div></section>`
  });
  views.admin = (sec) => {
    sec = sec || '';
    const map = { '': adminOverview, participantes: adminPeople, categorias: adminCats, nominaciones: adminNoms, configuracion: adminSettings };
    return (map[sec] || adminOverview)();
  };

  function adminOverview() {
    const s = adminStats();
    const pending = eligible().filter((p) => !hasDone(p));
    const leaders = S.categories.filter((c) => c.active).slice(0, 6).map((c) => {
      const v = votes(c.id), top = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
      return { c, p: top && top[1] ? P(top[0]) : null, n: top ? top[1] : 0 };
    });
    const days = (() => {
      const end0 = new Date(); end0.setHours(23, 59, 59, 999); const out = [];
      for (let i = 14; i >= 0; i--) { const e = new Date(end0); e.setDate(e.getDate() - i); out.push(S.allVotes.filter((v) => new Date(v.created_at) <= e).length); }
      return out;
    })();
    const mx = Math.max(...days, 1);
    const circ = 2 * Math.PI * 44;
    return {
      title: 'Administración · PROM AWARDS',
      dust: 14,
      html: adminShell('', 'Resumen general', S.settings.open ? 'Votación en curso' : 'Votación cerrada', `
        <section class="kpis rise" style="--d:.08s">
          <div><b>${s.tot}</b><span>Participantes registrados</span></div>
          <div><b>${s.cats}</b><span>Categorías</span></div>
          <div><b>${s.done}</b><span>Completaron su votación</span></div>
          <div class="kpi-ring">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="r-bg"/><circle cx="50" cy="50" r="44" class="r-fg" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - s.pct / 100)}"/></svg>
            <b>${s.pct}<small>%</small></b><span>Participación</span>
          </div>
          <div><b>${s.noms}</b><span>Votos recibidos</span></div>
        </section>
        <div class="two">
          <section class="panel rise" style="--d:.16s">
            <header class="row-head"><h2 class="h3">Votos acumulados</h2><span class="muted caps">Últimos 15 días</span></header>
            <svg class="bars" viewBox="0 0 300 120" preserveAspectRatio="none" role="img" aria-label="Gráfico de votos acumulados">
              ${days.map((v, i) => { const h = Math.max(4, (v / mx) * 108); return `<rect x="${i * 20 + 3}" y="${118 - h}" width="14" height="${h}" class="${i === days.length - 1 ? 'hi' : ''}"><title>${v} votos</title></rect>`; }).join('')}
            </svg>
          </section>
          <section class="panel rise" style="--d:.22s">
            <header class="row-head"><h2 class="h3">${S.settings.open ? 'Líderes por categoría' : 'Resultados por categoría'}</h2><a class="link" href="#/admin/nominaciones">Ver resultados ${ui('next')}</a></header>
            <ul class="leaders">
              ${leaders.map((l) => `<li>${l.p ? avatar(l.p, 'av-sm') : '<i class="ghost-av"></i>'}<span><b>${l.p ? esc(l.p.name) : 'Sin votos'}</b><em>${esc(l.c.name)}</em></span><strong>${l.n}</strong></li>`).join('')}
            </ul>
          </section>
        </div>
        <section class="panel rise" style="--d:.28s">
          <header class="row-head"><h2 class="h3">Pendientes de votar</h2><span class="muted caps">${pending.length} participantes</span></header>
          ${pending.length ? `<ul class="pend">${pending.map((p) => `<li>${avatar(p, 'av-sm')}<span>${esc(p.name)}</span></li>`).join('')}</ul>` : '<p class="muted">Todos los participantes completaron su votación.</p>'}
        </section>`)
    };
  }

  let pFilter = 'all', pQuery = '';
  function adminPeople() {
    const list = roster().filter((p) => (pFilter === 'all' || (p.eligible && (pFilter === 'done') === hasDone(p))) && (!pQuery || (p.name + ' ' + p.alias).toLowerCase().includes(pQuery.toLowerCase())));
    const nd = eligible().filter(hasDone).length;
    return {
      title: 'Participantes · Administración',
      dust: 14,
      html: adminShell('participantes', 'Participantes', `${roster().length} registrados`, `
        <div class="toolbar rise" style="--d:.06s">
          <label class="search">${ui('search')}<span class="sr">Buscar participante</span><input id="pq" type="search" placeholder="BUSCAR PARTICIPANTE..." value="${esc(pQuery)}" autocomplete="off"></label>
          <div class="tabs" role="tablist" aria-label="Filtrar participantes">
            ${[['all', 'Todos', roster().length], ['done', 'Completaron', nd], ['pend', 'Pendientes', eligible().length - nd]].map(([k, l, n]) => `<button role="tab" aria-selected="${pFilter === k}" class="tab ${pFilter === k ? 'on' : ''}" data-act="p-filter" data-k="${k}">${l}<small>${n}</small></button>`).join('')}
          </div>
        </div>
        <div class="agrid">
          ${list.map((p, i) => `<article class="acard" style="--d:${Math.min(i, 14) * 0.03}s">
            <span class="frame">${pic(p)}</span>
            <div class="acard-b"><b>${esc(p.name)}</b>${p.alias ? `<small class="alias">“${esc(p.alias)}”</small>` : ''}${!p.eligible ? `<span class="chip chip-ok">${ui('lock')}Administrador · no elegible</span>` : hasDone(p) ? `<span class="chip chip-ok">${ui('check')}Votó todo</span>` : `<span class="chip">${votedCount(p.id)} de ${activeCats().length}</span>`}</div>
            <button class="btn btn-sm btn-ghost btn-block" data-act="p-edit" data-id="${p.id}">${ui('edit')}Editar</button>
          </article>`).join('') || '<p class="empty">Ningún participante coincide con la búsqueda.</p>'}
        </div>`, `<button class="btn" data-act="p-add">${ui('plus')}Agregar participante</button>`),
      mount: () => {
        const q = $('#pq');
        q.addEventListener('input', () => {
          pQuery = q.value; const pos = q.selectionStart;
          render({ keep: true }); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos);
        });
      }
    };
  }

  let draft = null;  // { id|null, name, alias, photo, icon }
  const draftPrev = () => draft.photo ? `<img src="${esc(draft.photo)}" alt="Vista previa">` : `<span class="ph-ico" style="--h:${hue(draft.icon)}">${icon(draft.icon)}</span>`;
  const personModal = (id) => {
    const p = id ? P(id) : null;
    draft = { id, name: p ? p.name : '', alias: p ? p.alias : '', photo: p ? p.photo : null, icon: p && p.icon ? p.icon : randIcon() };
    openModal(`
      <header class="modal-head"><h2 class="h3" id="mt">${p ? 'Editar participante' : 'Agregar participante'}</h2><button class="icon-btn" data-act="modal-close" aria-label="Cerrar">${ui('close')}</button></header>
      <div class="modal-body">
        <div class="person-form">
          <div class="preview" id="preview">${draftPrev()}</div>
          <div class="person-fields">
            <label class="field"><span class="label">Nombre completo</span><input id="pn" type="text" maxlength="80" value="${esc(draft.name)}" placeholder="Ej. Lucía Fernández" autofocus></label>
            <label class="field"><span class="label">Alias</span><input id="pa" type="text" maxlength="40" value="${esc(draft.alias)}" placeholder="Ej. Lucha"></label>
            <div class="field"><span class="label">Fotografía</span>
              <label class="btn btn-sm btn-ghost file">${ui('upload')}Cargar fotografía<input id="pf" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
            </div>
          </div>
        </div>
        <p class="fine">${p && p.userId ? 'Esta persona tiene cuenta propia.' : 'Sin fotografía se usa un icono al azar.'}</p>
      </div>
      <div class="modal-actions">
        ${p ? `<button class="btn btn-danger btn-ghost" data-act="p-del" data-id="${p.id}">${ui('trash')}Eliminar</button>` : '<span></span>'}
        <div class="row"><button class="btn btn-ghost" data-act="modal-close">Cancelar</button><button class="btn" data-act="p-save">Guardar</button></div>
      </div>`, 'modal-lg');
    $('#pf').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { setDraftPhoto(await shrink(f)); } catch (err) { toast('No se pudo leer la imagen.', 'warn'); }
    });
  };
  const setDraftPhoto = (src) => { draft.photo = src; $('#preview').innerHTML = draftPrev(); };
  const shrink = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const s = 480 / Math.min(im.width, im.height), w = im.width * Math.min(1, s), h = im.height * Math.min(1, s);
        const cv = document.createElement('canvas'); cv.width = 480; cv.height = 480;
        const m = Math.min(im.width, im.height);
        cv.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 480, 480);
        res(cv.toDataURL('image/jpeg', 0.85));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  let nomCat = null, nomAll = false;
  function adminNoms() {
    const cats = activeCats(), open = S.settings.open;
    if (!nomCat || !cats.find((c) => c.id === nomCat)) nomCat = cats[0] && cats[0].id;
    const c = cats.find((x) => x.id === nomCat);
    const label = (x) => {
      if (open) return String(catTotal(x.id));
      const o = outcome(x);
      return { winner: 'Ganador', shared: 'Compartido', tie: 'Empate', runoff: 'Desempate', none: '—' }[o.state];
    };
    const names = (ids) => ids.map((id) => esc((P(id) || { name: '?' }).name)).join(' y ');
    let panel = '<p class="empty">No hay categorías.</p>';
    if (c) {
      const o = outcome(c);
      let rows = Object.entries(o.v).map(([id, n]) => ({ p: P(id), n })).filter((r) => r.p);
      if (c.round > 1) rows = rows.filter((r) => c.runoffCandidates.includes(r.p.id));
      rows.sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name, 'es'));
      const total = rows.reduce((a, r) => a + r.n, 0), mx = rows[0] ? Math.max(rows[0].n, 1) : 1;
      const shown = nomAll ? rows : rows.filter((r, i) => i < 8);
      let status = '';
      if (open) status = `<div class="callout">${ui('chart')}<span><b>Avance del ranking.</b> La votación sigue abierta; los ganadores se definen al cerrarla.</span></div>`;
      else if (o.state === 'runoff') status = `<div class="callout">${ui('chart')}<span><b>Desempate en curso</b> entre ${names(c.runoffCandidates)}. ${total} ${total === 1 ? 'voto recibido' : 'votos recibidos'}.</span></div>
        <div class="actions"><button class="btn" data-act="runoff-close" data-id="${c.id}">Cerrar desempate</button></div>`;
      else if (o.state === 'tie') status = `<div class="callout warn">${ui('bell')}<span><b>Empate:</b> ${names(o.leaders)} con ${o.max} ${o.max === 1 ? 'voto' : 'votos'} cada uno.</span></div>
        <div class="actions"><button class="btn" data-act="tie-shared" data-id="${c.id}">Que ganen todos los empatados</button><button class="btn btn-ghost" data-act="tie-runoff" data-id="${c.id}">Abrir desempate</button></div>
        <p class="fine">El desempate abre una votación solo en esta categoría, donde únicamente aparecen los empatados.</p>`;
      else if (o.state === 'none') status = `<div class="callout">${ui('chart')}<span>${c.round > 1 ? 'Nadie votó en el desempate.' : 'Esta categoría no recibió votos.'}</span></div>${c.round > 1 ? `<div class="actions"><button class="btn btn-ghost" data-act="runoff-reopen" data-id="${c.id}">Reabrir desempate</button></div>` : ''}`;
      else status = `<div class="callout ok">${ui('check')}<span><b>${o.state === 'shared' ? 'Ganan todos los empatados' : 'Ganador'}</b> con ${o.max} ${o.max === 1 ? 'voto' : 'votos'}.</span></div>
        <div class="winners">${o.winners.map((id) => { const w = P(id); return `<article class="winner">${avatar(w, 'av-xl')}<div><b>${esc(w.name)}</b>${w.alias ? `<em>“${esc(w.alias)}”</em>` : ''}</div><button class="btn btn-sm" data-act="diploma" data-cat="${c.id}" data-id="${w.id}">${ui('edit')}Generar diploma</button></article>`; }).join('')}</div>`;
      panel = `
        <header><p class="eyebrow">Categoría ${pad(cats.indexOf(c) + 1)} · ${total} ${total === 1 ? 'voto' : 'votos'}${c.round > 1 ? ' · desempate' : ''}</p><h2 class="h2">${esc(c.name)}.</h2><p class="serif lede-s">${esc(c.desc)}</p></header>
        ${status}
        ${total ? `<ol class="rbars">
          ${shown.map((r, i) => `<li class="${i === 0 && !open ? 'lead' : ''}" style="--i:${i}">
            <span class="pos">${pad(i + 1)}</span>${avatar(r.p, 'av-md')}
            <span class="rname"><b>${esc(r.p.name)}</b><i class="rbar"><u style="--w:${(r.n / mx) * 100}%"></u></i></span>
            <strong>${r.n}</strong></li>`).join('')}
        </ol>
        ${rows.length > 8 ? `<button class="btn btn-sm btn-ghost" data-act="nom-all">${nomAll ? 'Ver solo los 8 primeros' : `Ver los ${rows.length} participantes`}</button>` : ''}`
          : '<p class="empty">Aún no hay votos en esta categoría.</p>'}`;
    }
    return {
      title: 'Resultados · Administración',
      dust: 14,
      html: adminShell('nominaciones', open ? 'Avance de la votación' : 'Resultados', open ? 'Solo lo ve el administrador' : 'Votación cerrada', `
        <div class="results">
          <nav class="rcats" aria-label="Categorías">
            ${cats.map((x, i) => `<button class="rcat ${x.id === nomCat ? 'on' : ''}" data-act="nom-cat" data-id="${x.id}"><span class="n">${pad(i + 1)}</span><span>${esc(x.name)}</span><small>${label(x)}</small></button>`).join('')}
          </nav>
          <section class="rpanel rise">${panel}</section>
        </div>`, open ? `<button class="btn" data-act="close-votes">Cerrar votaciones</button>` : `<button class="btn btn-ghost" data-act="open-votes">Reabrir votaciones</button>`)
    };
  }

  /* ---------- Diploma ---------- */
  const diplomaHTML = (c, p, n, year) => `
    <div class="diploma">
      <div class="dip-frame">
        <p class="dip-top">PROM AWARDS ${year}</p>
        <h2 class="dip-title">Diploma de honor</h2>
        <div class="dip-body">
          <div class="dip-art">
            <div class="dip-photo">${pic(p, '', p.name, true)}</div>
            <div class="dip-statue" aria-hidden="true">${statuette('dp' + p.id.slice(0, 4), 'dip-stat')}</div>
          </div>
          <div class="dip-text">
            <p class="dip-small">Se otorga a</p>
            <p class="dip-name">${esc(p.name)}</p>
            ${p.alias ? `<p class="dip-alias">“${esc(p.alias)}”</p>` : ''}
            <p class="dip-small">por haber sido elegido</p>
            <p class="dip-cat">${esc(c.name)}</p>
            <p class="dip-year">Edición ${year}</p>
          </div>
        </div>
        <p class="dip-foot">${n} ${n === 1 ? 'voto' : 'votos'} de la promoción</p>
      </div>
    </div>`;
  const diplomaModal = (catId, pid) => {
    const c = S.categories.find((x) => x.id === catId), p = P(pid);
    if (!c || !p) return;
    const o = outcome(c), year = eventDate().getFullYear();
    openModal(`
      <header class="modal-head"><h2 class="h3" id="mt">Diploma · ${esc(p.name)}</h2><button class="icon-btn" data-act="modal-close" aria-label="Cerrar">${ui('close')}</button></header>
      <div class="modal-body">
        ${diplomaHTML(c, p, o.max, year)}
        <p class="fine">Pulsa «Imprimir / guardar PDF» y, en el destino de la impresora, elige «Guardar como PDF».</p>
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Cerrar</button><button class="btn" data-act="diploma-print" data-cat="${c.id}" data-id="${p.id}">${ui('upload')}Imprimir / guardar PDF</button></div>`, 'modal-lg');
  };
  const printDiploma = (catId, pid) => {
    const c = S.categories.find((x) => x.id === catId), p = P(pid);
    if (!c || !p) return;
    const root = document.createElement('div');
    root.id = 'print-root';
    root.innerHTML = diplomaHTML(c, p, outcome(c).max, eventDate().getFullYear());
    document.body.appendChild(root);
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); root.remove(); removeEventListener('afterprint', done); };
    addEventListener('afterprint', done);
    setTimeout(() => window.print(), 80);
  };

  let editCat = null;
  function adminCats() {
    const cats = S.categories;
    return {
      title: 'Categorías · Administración',
      dust: 14,
      html: adminShell('categorias', 'Categorías', `${cats.filter((c) => c.active).length} activas de ${cats.length}`, `
        <ul class="clist">
          ${cats.map((c, i) => `<li class="crow ${c.active ? '' : 'off'}" style="--d:${Math.min(i, 14) * 0.03}s">
            <span class="n">${pad(i + 1)}</span>${medal(c.icon)}
            <span class="crow-t"><b>${esc(c.name)}</b><em>${esc(c.desc)}</em></span>
            <button class="chip ${c.active ? 'chip-ok' : ''}" data-act="cat-toggle" data-id="${c.id}" aria-pressed="${c.active}" title="Cambiar estado">${c.active ? ui('check') + 'Activa' : 'Oculta'}</button>
            <span class="crow-n"><b>${catTotal(c.id)}</b><small>votos</small></span>
            <span class="crow-a">
              <button class="icon-btn" data-act="cat-up" data-id="${c.id}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ui('up')}</button>
              <button class="icon-btn" data-act="cat-down" data-id="${c.id}" aria-label="Bajar" ${i === cats.length - 1 ? 'disabled' : ''}>${ui('down')}</button>
              <button class="icon-btn" data-act="cat-edit" data-id="${c.id}" aria-label="Editar">${ui('edit')}</button>
              <button class="icon-btn danger" data-act="cat-del" data-id="${c.id}" aria-label="Eliminar">${ui('trash')}</button>
            </span>
          </li>`).join('')}
        </ul>`, `<button class="btn" data-act="cat-add">${ui('plus')}Crear categoría</button>`)
    };
  }
  const catModal = (id) => {
    const c = id ? S.categories.find((x) => x.id === id) : null;
    editCat = { id, icon: c ? c.icon : 'star', active: c ? c.active : true };
    openModal(`
      <header class="modal-head"><h2 class="h3" id="mt">${c ? 'Editar categoría' : 'Crear categoría'}</h2><button class="icon-btn" data-act="modal-close" aria-label="Cerrar">${ui('close')}</button></header>
      <div class="modal-body">
        <label class="field"><span class="label">Nombre</span><input id="cn" type="text" value="${c ? esc(c.name) : ''}" placeholder="Ej. El más puntual" autofocus></label>
        <label class="field"><span class="label">Descripción humorística</span><textarea id="cd" rows="3" placeholder="Una frase breve y divertida">${c ? esc(c.desc) : ''}</textarea></label>
        <div class="field"><span class="label">Icono</span>
          <div class="icon-pick">${PA.ICON_KEYS.map((k) => `<button type="button" class="ip ${k === editCat.icon ? 'on' : ''}" data-act="cat-icon" data-k="${k}" aria-label="Icono ${k}" aria-pressed="${k === editCat.icon}">${icon(k)}</button>`).join('')}</div>
        </div>
        <label class="switch"><input id="ca" type="checkbox" ${editCat.active ? 'checked' : ''}><i></i><span>Categoría activa para los participantes</span></label>
      </div>
      <div class="modal-actions"><span></span><div class="row"><button class="btn btn-ghost" data-act="modal-close">Cancelar</button><button class="btn" data-act="cat-save">Guardar</button></div></div>`, 'modal-lg');
  };

  function adminSettings() {
    return {
      title: 'Configuración · Administración',
      dust: 14,
      html: adminShell('configuracion', 'Configuración', 'Evento y participación', `
        <form class="panel form-narrow rise" id="settings" novalidate>
          <label class="field"><span class="label">Nombre del evento</span><input id="s-name" type="text" value="${esc(S.settings.name)}"></label>
          <label class="field"><span class="label">Fecha y hora del reencuentro</span><input id="s-date" type="datetime-local" value="${esc(toLocalInput(S.settings.date))}"></label>
          <label class="switch"><input id="s-open" type="checkbox" ${S.settings.open ? 'checked' : ''}><i></i><span>Votaciones abiertas</span></label>
          <p class="fine">Al cerrarlas, nadie puede votar ni cambiar su voto. Los ganadores y empates aparecen en Resultados.</p>
          <div class="actions"><button class="btn" type="submit">Guardar cambios</button></div>
        </form>`),
      mount: () => {
        $('#settings').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = $('#s-date').value;
          if (!d) { toast('Indica la fecha del reencuentro.', 'warn'); return; }
          const btn = $('#settings button[type=submit]'); btn.disabled = true;
          try {
            await DB.saveSettings({ name: $('#s-name').value.trim() || 'PROM AWARDS 2026', date: new Date(d).toISOString(), open: $('#s-open').checked });
            await refresh(); toast('Configuración guardada.');
          } catch (err) { console.error(err); toast(errMsg(err), 'warn'); }
          btn.disabled = false;
        });
      }
    };
  }

  /* =====================================================================
     ROUTER
     ===================================================================== */
  let cleanup = [];
  /* Cabecera y pie son marcos de página: se reemplaza todo salvo los nodos persistentes */
  const setSlot = (el, cls, html) => {
    [...el.children].forEach((c) => { if (!c.hasAttribute('data-persist')) c.remove(); });
    el.className = cls || '';
    if (html) el.insertAdjacentHTML('afterbegin', html);
  };
  const parse = () => {
    const [name = '', a, b] = location.hash.replace(/^#\/?/, '').split('/');
    return { name, a, b };
  };
  const go = (path) => { const h = '#/' + path; if (location.hash === h) render(); else location.hash = h; };

  function render(opts = {}) {
    cleanup.forEach((f) => f()); cleanup = [];
    let { name, a, b } = parse();
    if (name === 'exito') { history.replaceState(null, '', '#/resumen'); name = 'resumen'; }
    const needsUser = ['dashboard', 'categorias', 'nominar', 'resumen'];
    const mine = S.user && me();
    const homeOf = () => (S.isAdmin ? 'admin' : mine && mine.status === 'approved' ? 'dashboard' : 'pendiente');
    /* El administrador no vota: sus pantallas son las de administración */
    if (S.isAdmin && (needsUser.includes(name) || name === 'pendiente' || name === 'acceso')) { history.replaceState(null, '', '#/admin'); name = 'admin'; }
    if (name === 'admin' && !S.authed) { accessMode = 'entrar'; afterLogin = 'admin'; history.replaceState(null, '', '#/acceso'); name = 'acceso'; }
    if (needsUser.includes(name) && !mine) { history.replaceState(null, '', '#/acceso'); name = 'acceso'; }
    else if (needsUser.includes(name) && mine.status !== 'approved') { history.replaceState(null, '', '#/pendiente'); name = 'pendiente'; }
    if (name === 'acceso' && mine && afterLogin !== 'admin') { history.replaceState(null, '', '#/' + homeOf()); name = homeOf(); }
    if (name === 'pendiente' && !mine) { history.replaceState(null, '', '#/acceso'); name = 'acceso'; }
    else if (name === 'pendiente' && mine.status === 'approved') { history.replaceState(null, '', '#/dashboard'); name = 'dashboard'; }
    if (name !== 'acceso') afterLogin = null;
    let v;
    if (name === 'admin') v = S.isAdmin ? views.admin(a) : adminDenied();
    if (name === 'admin' && S.isAdmin) startBellPoll();
    else if (name === 'nominar') v = views.nominar(a);
    else v = (views[name] || views[''])(a);
    const key = name === 'admin' ? 'admin/' + (a || '') : name === 'nominar' ? 'nominar' : name;
    const app = $('#app');
    const y = scrollY;
    setSlot($('#site-head'), v.headClass, v.head);
    setSlot($('#site-foot'), v.footClass, v.foot);
    app.className = `view v-${name || 'landing'} ${opts.keep ? 'keep' : ''}`;
    app.innerHTML = v.html;
    document.title = v.title || 'PROM AWARDS 2026';
    dust.density(v.dust != null ? v.dust : 24);
    scrollTo(0, opts.keep ? y : 0);
    if (v.mount) v.mount();
    if (v.burst) dust.burst();
    document.body.dataset.view = name || 'landing';
    navDir = 'next';
  }

  addEventListener('hashchange', () => render());

  /* =====================================================================
     ACCIONES (delegación de eventos)
     ===================================================================== */
  let saveQ = Promise.resolve(), pending = 0;
  const setSt = (txt, kind = '') => { const e = $('#save-st'); if (e) { e.textContent = txt; e.className = 'st ' + kind; } };
  /* Ejecuta una operación de administración, recarga los datos y vuelve a pintar */
  const adminDo = async (btn, fn) => {
    if (btn) btn.disabled = true;
    try { await fn(); await refresh(); render({ keep: true }); }
    catch (e) { console.error(e); toast(errMsg(e), 'warn'); if (btn) btn.disabled = false; }
  };
  const reorder = (id, d) => {
    const list = [...S.categories], i = list.findIndex((c) => c.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    adminDo(null, () => DB.setPositions([{ id: list[i].id, position: i + 1 }, { id: list[j].id, position: j + 1 }]));
  };
  const curNom = () => { const { a } = parse(); const cats = activeCats(); return { n: Math.min(Math.max(parseInt(a, 10) || 1, 1), cats.length), cats }; };

  const actions = {
    go: (t, e) => { if (e.target.closest('a,button') && e.target.closest('a,button') !== t) return; go(t.dataset.to); },
    scroll: (t, e) => { e.preventDefault(); const el = $(t.dataset.to); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); },
    'acc-mode': (t) => { accessMode = t.dataset.k; render(); },
    'acc-admin': () => { accessMode = 'entrar'; afterLogin = 'admin'; },
    'acc-out': async (t, e) => { e.preventDefault(); await DB.signOut(); resetReg(); await refresh(); accessMode = 'registro'; render(); },
    'pend-check': async () => {
      try { await refresh(); } catch (e) { toast(errMsg(e), 'warn'); return; }
      if (me() && me().status === 'approved') { toast('¡Tu solicitud fue aprobada!'); go('dashboard'); } else toast('Todavía está pendiente de aprobación.');
    },
    bell: async () => { try { await refresh(); } catch (e) { /* se muestra lo último que se tenía */ } bellModal(); },
    'req-ok': (t) => decide(t.dataset.id, 'approved'),
    'req-no': (t) => decide(t.dataset.id, 'rejected'),
    'req-all': async (t) => {
      t.disabled = true;
      try { for (const r of pendingReqs()) await DB.setStatus(r.id, 'approved'); await refresh(); toast('Solicitudes aprobadas.'); closeModal(); render({ keep: true }); }
      catch (e) { console.error(e); toast(errMsg(e), 'warn'); t.disabled = false; }
    },
    'reg-dice': () => { reg.icon = randIcon(); setRegPhoto(); },
    'reg-nophoto': () => { reg.photo = null; const f = $('#reg-file'); if (f) f.value = ''; setRegPhoto(); },
    logout: async () => {
      try { await DB.signOut(); resetReg(); afterLogin = null; accessMode = 'registro'; await refresh(); toast('Sesión cerrada.'); go(''); }
      catch (e) { console.error(e); toast(errMsg(e), 'warn'); }
    },
    'cat-filter': (t) => { catFilter = t.dataset.k; render({ keep: true }); },
    pick: (t) => {
      const id = t.dataset.id;
      const root = $('.nominate'), cid = root.dataset.cat, c = S.categories.find((x) => x.id === cid);
      if (!c || !votable(c)) { toast('La votación está cerrada.', 'warn'); return; }
      if (id === S.user) { toast('No puedes votar por ti mismo/a.', 'warn'); return; }
      const runoff = c.round > 1, store = runoff ? S.runoffSel : mySel(), voter = S.user, round = c.round;
      const prev = store[cid], next = prev === id ? null : id;
      if (next) store[cid] = next; else delete store[cid];
      updateNominate(); setSt('Guardando…');
      pending++;
      /* Guarda en orden; si falla, devuelve el voto anterior */
      saveQ = saveQ.then(() => (runoff ? DB.setRunoffVote(cid, round, voter, next) : DB.setNomination(cid, voter, next))).then(() => { if (--pending === 0) setSt('Guardado ✓', 'ok'); }).catch((e) => {
        pending--;
        console.error(e);
        if (prev) store[cid] = prev; else delete store[cid];
        if ($('.nominate')) updateNominate();
        toast(errMsg(e), 'warn');
      });
    },
    'nav-prev': () => { const { n } = curNom(); if (n > 1) { navDir = 'prev'; go('nominar/' + (n - 1)); } },
    'nav-next': () => {
      const { n, cats } = curNom();
      if (n >= cats.length) { go('resumen'); return; }
      navDir = 'next'; go('nominar/' + (n + 1));
    },
    'modal-close': () => closeModal(),
    'modal-bg': (t, e) => { if (e.target === t) closeModal(); },
    /* Admin: participantes */
    'p-filter': (t) => { pFilter = t.dataset.k; render({ keep: true }); },
    'p-add': () => personModal(null),
    'p-edit': (t) => personModal(t.dataset.id),
    'p-save': (t) => {
      const name = $('#pn').value.trim(), alias = $('#pa').value.trim();
      if (!name) { toast('Escribe el nombre completo.', 'warn'); $('#pn').focus(); return; }
      adminDo(t, async () => {
        await DB.savePerson({ id: draft.id, name, alias, photo: draft.photo, icon: draft.icon });
        closeModal(); toast(draft.id ? 'Participante actualizado.' : 'Participante agregado.');
      });
    },
    'p-del': (t) => {
      if (!t.dataset.sure) { t.dataset.sure = 1; t.lastChild.textContent = 'Confirmar eliminación'; return; }
      const id = t.dataset.id;
      adminDo(t, async () => { await DB.deletePerson(id); closeModal(); toast('Participante eliminado.'); });
    },
    /* Admin: cierre de votaciones, empates y diplomas */
    'close-votes': () => openModal(`<div class="modal-body center"><h2 class="h2" id="mt">¿Cerrar las votaciones?</h2><p>Nadie podrá votar ni cambiar su voto. En Resultados verás a los ganadores y los empates.</p></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close" autofocus>Cancelar</button><button class="btn" data-act="close-votes-ok">Cerrar votaciones</button></div>`, 'modal-sm'),
    'close-votes-ok': (t) => adminDo(t, async () => {
      await DB.saveSettings({ name: S.settings.name, date: S.settings.date, open: false });
      closeModal(); toast('Votaciones cerradas.');
    }),
    'open-votes': (t) => adminDo(t, async () => {
      await DB.saveSettings({ name: S.settings.name, date: S.settings.date, open: true });
      toast('Votaciones reabiertas.');
    }),
    'tie-shared': (t) => adminDo(t, async () => { await DB.setCategoryState(t.dataset.id, { shared_win: true }); toast('Ganan todos los empatados.'); }),
    'tie-runoff': (t) => {
      const c = S.categories.find((x) => x.id === t.dataset.id), o = outcome(c);
      adminDo(t, async () => {
        await DB.setCategoryState(c.id, { round: c.round + 1, runoff_open: true, runoff_candidates: o.leaders, shared_win: false });
        toast('Desempate abierto: solo votan entre los empatados.');
      });
    },
    'runoff-close': (t) => adminDo(t, async () => { await DB.setCategoryState(t.dataset.id, { runoff_open: false }); toast('Desempate cerrado.'); }),
    'runoff-reopen': (t) => adminDo(t, async () => { await DB.setCategoryState(t.dataset.id, { runoff_open: true }); toast('Desempate reabierto.'); }),
    diploma: (t) => diplomaModal(t.dataset.cat, t.dataset.id),
    'diploma-print': (t) => printDiploma(t.dataset.cat, t.dataset.id),
    /* Admin: resultados */
    'nom-cat': (t) => { nomCat = t.dataset.id; nomAll = false; render({ keep: true }); },
    'nom-all': () => { nomAll = !nomAll; render({ keep: true }); },
    /* Admin: categorías */
    'cat-up': (t) => reorder(t.dataset.id, -1),
    'cat-down': (t) => reorder(t.dataset.id, 1),
    'cat-toggle': (t) => {
      const c = S.categories.find((x) => x.id === t.dataset.id), on = !c.active;
      adminDo(t, async () => { await DB.saveCategory({ id: c.id, name: c.name, desc: c.desc, icon: c.icon, active: on }); toast(on ? 'Categoría activada.' : 'Categoría oculta para los participantes.'); });
    },
    'cat-add': () => catModal(null),
    'cat-edit': (t) => catModal(t.dataset.id),
    'cat-icon': (t) => { editCat.icon = t.dataset.k; $$('.ip').forEach((b) => { const on = b.dataset.k === editCat.icon; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
    'cat-save': (t) => {
      const name = $('#cn').value.trim(), desc = $('#cd').value.trim();
      if (!name) { toast('Escribe el nombre de la categoría.', 'warn'); $('#cn').focus(); return; }
      const active = $('#ca').checked, pos = S.categories.reduce((m, c) => Math.max(m, c.position), 0) + 1;
      adminDo(t, async () => {
        await DB.saveCategory({ id: editCat.id, name, desc: desc || 'Una nueva categoría para la promoción.', icon: editCat.icon, active, position: pos });
        closeModal(); toast(editCat.id ? 'Categoría actualizada.' : 'Categoría creada.');
      });
    },
    'cat-del': (t) => {
      const c = S.categories.find((x) => x.id === t.dataset.id);
      openModal(`<div class="modal-body center"><h2 class="h2" id="mt">¿Eliminar categoría?</h2><p>“${esc(c.name)}” dejará de aparecer para los participantes y se perderán sus votos.</p></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close" autofocus>Cancelar</button><button class="btn btn-danger-solid" data-act="cat-del-ok" data-id="${c.id}">Eliminar</button></div>`, 'modal-sm');
    },
    'cat-del-ok': (t) => {
      const id = t.dataset.id;
      adminDo(t, async () => { await DB.deleteCategory(id); closeModal(); toast('Categoría eliminada.'); });
    }
  };

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const fn = actions[t.dataset.act];
    if (fn) fn(t, e);
  });

  /* Arranque: lee sesión y datos de Supabase y luego pinta */
  (async () => {
    try { await refresh(); }
    catch (e) { console.error(e); toast('No se pudo conectar con el servidor. Reintenta en un momento.', 'warn'); }
    if (!location.hash) history.replaceState(null, '', '#/');
    render();
  })();
})();
