/* PROM AWARDS 2026 — datos de demostración, iconografía y estatuilla (sin backend) */
window.PA = window.PA || {};

/* ---------- Iconografía de categorías (trazo 1.5, viewBox 24) ---------- */
PA.ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  eye: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M5 4.5 6.4 7M19 4.5 17.6 7M12 2.5V5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.2c-.5-.8-1.4-1.2-2.6-1.2-1.4 0-2.5.8-2.5 2 0 1.3 1.1 1.6 2.5 2s2.5.7 2.5 2c0 1.2-1.1 2-2.5 2-1.2 0-2.1-.4-2.6-1.2M12 6v2M12 16v2"/>',
  ghost: '<path d="M5 21V11a7 7 0 0 1 14 0v10l-2.4-2-2.3 2-2.3-2-2.3 2-2.3-2z"/><circle cx="9.5" cy="11" r=".9" fill="currentColor"/><circle cx="14.5" cy="11" r=".9" fill="currentColor"/>',
  chat: '<path d="M4 5h16v11H9.5L5 20v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  glass: '<path d="M8 3h8l-.6 6.2a3.4 3.4 0 0 1-6.8 0z"/><path d="M12 12.6V20M8.5 21h7M10.3 6h3.4"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M15.5 3.5v3M14 5h3"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>',
  podium: '<path d="M3 21h18M4.5 21v-7h5v7M9.5 21V9h5v12M14.5 21v-9h5v9"/><path d="M12 3.2l.9 1.9 2 .3-1.5 1.4.4 2L12 7.8l-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M7.5 13.5a4.5 4.5 0 0 0 9 0z"/><path d="M8.8 9.2h.01M15.2 9.2h.01" stroke-width="2.2"/>',
  heart: '<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2 5.6-5.6 2 2-5.6z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  diamond: '<path d="M6.5 3.5h11L22 9.5 12 21 2 9.5z"/><path d="M2 9.5h20M9 3.5 7.5 9.5 12 21l4.5-11.5-1.5-6"/>',
  ring: '<circle cx="12" cy="15" r="6"/><path d="M9.2 4.6 12 2l2.8 2.6L12 8z"/>',
  crown: '<path d="M3 18 2.2 7.5l5.3 4.2L12 4l4.5 7.7 5.3-4.2L21 18z"/><path d="M4 21h16"/>',
  star: '<path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.8 6.4 20l1.3-6.2L3 9.5l6.3-.7z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  plane: '<path d="M21 3 3 10.5l6.5 2.5L12 20l2-5.5z"/><path d="m9.5 13 5-4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>'
};
PA.ICON_KEYS = Object.keys(PA.ICONS);

/* Iconos de interfaz */
PA.UI = {
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5 10 17.5 19 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.6-3.8 3.2-6 6.5-6s5.9 2.2 6.5 6M16 5.2a3.3 3.3 0 0 1 0 6.1M18.5 14.4c1.7.8 2.8 2.6 3 5.6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>',
  home: '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/>',
  upload: '<path d="M12 16V5M7 9.5 12 4.5l5 5M4 17v3h16v-3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.2A9.5 9.5 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.4 6.5A17 17 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4.1-1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5"/>'
};

PA.svg = (inner, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
PA.icon = (k, cls = '') => PA.svg(PA.ICONS[k] || PA.ICONS.star, cls);
PA.ui = (k, cls = '') => PA.svg(PA.UI[k] || '', cls);

/* ---------- Participantes ficticios (retratos de demostración) ---------- */
const ph = (n) => `assets/img/p${n}.jpg`;
PA.PARTICIPANTS = [
  /* Perfiles de acceso de demostración */
  { id: 'p01', name: 'Carlos Mendoza',  photo: ph(60), demo: true },
  { id: 'p02', name: 'Miguel Torres',   photo: ph(59), demo: true },
  { id: 'p03', name: 'Andrea Salazar',  photo: ph(16), demo: true },
  { id: 'p04', name: 'Rodrigo Pérez',   photo: ph(12), demo: true },
  { id: 'p05', name: 'Valeria Castro',  photo: ph(36), demo: true },
  { id: 'p06', name: 'Javier Ramírez',  photo: ph(13), demo: true },
  { id: 'p07', name: 'Daniela Flores',  photo: ph(44), demo: true },
  { id: 'p08', name: 'Fernando Ruiz',   photo: ph(53), demo: true },
  /* Resto de la promoción (ya participaron en la simulación) */
  { id: 'p09', name: 'Diego Herrera',      photo: ph(8),  simDone: true },
  { id: 'p10', name: 'Camila Rojas',       photo: ph(5),  simDone: true },
  { id: 'p11', name: 'Sebastián Vargas',   photo: ph(14), simDone: true },
  { id: 'p12', name: 'Lucía Navarro',      photo: ph(9),  simDone: true },
  { id: 'p13', name: 'Andrés Cabrera',     photo: ph(18), simDone: true },
  { id: 'p14', name: 'Mariana Ochoa',      photo: ph(20), simDone: true },
  { id: 'p15', name: 'Mauricio Delgado',   photo: ph(51), simDone: true },
  { id: 'p16', name: 'Paola Gutiérrez',    photo: ph(23), simDone: true },
  { id: 'p17', name: 'Alejandro Quispe',   photo: ph(54), simDone: true },
  { id: 'p18', name: 'Fabiola Medina',     photo: ph(25), simDone: true },
  { id: 'p19', name: 'Gustavo Lozano',     photo: ph(55), simDone: true },
  { id: 'p20', name: 'Natalia Vega',       photo: ph(26), simDone: true },
  { id: 'p21', name: 'Renzo Alarcón',      photo: ph(56), simDone: true },
  { id: 'p22', name: 'Carolina Ibáñez',    photo: ph(27), simDone: true },
  { id: 'p23', name: 'Matías Bermúdez',    photo: ph(57), simDone: true },
  { id: 'p24', name: 'Sofía Valdivia',     photo: ph(28), simDone: true },
  { id: 'p25', name: 'Óscar Villanueva',   photo: ph(61), simDone: true },
  { id: 'p26', name: 'Renata Campos',      photo: ph(32), simDone: true },
  { id: 'p27', name: 'Julián Paredes',     photo: ph(68), simDone: true },
  { id: 'p28', name: 'Isabel Montoya',     photo: ph(34), simDone: true },
  { id: 'p29', name: 'Gabriela Arce',      photo: ph(45), simDone: true },
  { id: 'p30', name: 'Patricia Luna',      photo: ph(49), simDone: true }
];

/* ---------- Categorías ---------- */
PA.CATEGORIES = [
  { id: 'c01', icon: 'clock',   name: 'El más tardón del año',  desc: 'Porque llegar a la hora nunca ha sido precisamente su especialidad.' },
  { id: 'c02', icon: 'bolt',    name: 'El más renegón',         desc: 'Tiene una queja lista para cada ocasión, y casi siempre tiene algo de razón.' },
  { id: 'c03', icon: 'eye',     name: 'El más coqueto/a',       desc: 'Sonrisa ensayada, mirada calculada y cero remordimientos.' },
  { id: 'c04', icon: 'coin',    name: 'El más tacaño',          desc: 'Su billetera tiene más seguridad que un banco. Nunca se sabe cuándo va a invitar.' },
  { id: 'c05', icon: 'ghost',   name: 'El más desaparecido',    desc: 'Lo viste por última vez en la graduación. Desde entonces, solo hay rumores.' },
  { id: 'c06', icon: 'chat',    name: 'El más chismoso/a',      desc: 'Se enteró antes que nadie y lo contó antes de que terminara la frase.' },
  { id: 'c07', icon: 'glass',   name: 'El más juerguero/a',     desc: 'Donde hay música, hay una historia que contar al día siguiente.' },
  { id: 'c08', icon: 'camera',  name: 'El más figureti',        desc: 'Si hay una cámara, ya está posando. Si no la hay, también.' },
  { id: 'c09', icon: 'moon',    name: 'El más dormilón',        desc: 'Capaz de dormir en cualquier lugar, en cualquier postura, en cualquier clase.' },
  { id: 'c10', icon: 'chip',    name: 'El más tecnológico',     desc: 'Tiene el último gadget antes de que salga a la venta, y una opinión sobre todo.' },
  { id: 'c11', icon: 'podium',  name: 'El más competitivo',     desc: 'Hasta un juego de mesa se convierte en la final de un campeonato.' },
  { id: 'c12', icon: 'smile',   name: 'El más gracioso/a',      desc: 'Sus chistes no siempre aterrizan, pero la risa está asegurada.' },
  { id: 'c13', icon: 'heart',   name: 'El más romántico/a',     desc: 'Cree en las cartas, las serenatas y las segundas oportunidades.' },
  { id: 'c14', icon: 'compass', name: 'El más aventurero/a',    desc: 'Su pasaporte tiene más sellos que su agenda tiene planes.' },
  { id: 'c15', icon: 'dumbbell',name: 'El más fitness',         desc: 'Su desayuno tiene más proteína que toda la cafetería junta.' },
  { id: 'c16', icon: 'diamond', name: 'El más probable en hacerse millonario', desc: 'Tiene un plan de negocios para todo. Algún día alguno saldrá bien.' },
  { id: 'c17', icon: 'ring',    name: 'El más probable en llegar tarde a su propia boda', desc: 'Si alguien sigue esperando en el altar, ya sabes de quién se trata.' },
  { id: 'c18', icon: 'crown',   name: 'El personaje del año',   desc: 'Nunca pasa desapercibido. La promoción no sería la misma sin él o ella.' }
];

/* ---------- Estatuilla dorada (diseño propio, vectorial) ---------- */
PA.statuette = (id = 's', cls = '') => {
  const star = (cx, cy, R, r) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };
  const shape = `
    <path d="${star(120, 66, 50, 20)}"/>
    <path fill="none" stroke-width="12" stroke-linecap="round" d="M95 244C74 206 84 160 108 114"/>
    <path fill="none" stroke-width="12" stroke-linecap="round" d="M145 244C166 206 156 160 132 114"/>
    <circle cx="108" cy="113" r="7"/><circle cx="132" cy="113" r="7"/>
    <ellipse cx="120" cy="170" rx="16" ry="21"/>
    <path d="M113 186h14v52h-14z"/>
    <path d="M88 242C96 230 144 230 152 242 151 282 143 312 141 344 147 384 152 428 143 482L137 510H103L97 482C88 428 93 384 99 344 97 312 89 282 88 242Z"/>
    <path d="M78 510h84v14H78zM90 524h60v34H90zM68 558h104v20H68z"/>`;
  return `<svg class="statuette ${cls}" viewBox="0 0 240 600" role="img" aria-label="Estatuilla dorada de PROM AWARDS">
    <defs>
      <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="68" y1="0" x2="172" y2="0">
        <stop offset="0" stop-color="#8C6A19"/><stop offset=".2" stop-color="#D4AF37"/>
        <stop offset=".42" stop-color="#F4D675"/><stop offset=".58" stop-color="#D4AF37"/>
        <stop offset=".82" stop-color="#8C6A19"/><stop offset="1" stop-color="#8C6A19"/>
      </linearGradient>
      <linearGradient id="${id}v" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="600">
        <stop offset="0" stop-color="#080808" stop-opacity="0"/><stop offset=".7" stop-color="#080808" stop-opacity=".05"/>
        <stop offset="1" stop-color="#080808" stop-opacity=".4"/>
      </linearGradient>
      <linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="0" y2="140">
        <stop offset="0" stop-color="#F4D675" stop-opacity="0"/><stop offset=".5" stop-color="#F5F0E6" stop-opacity=".5"/>
        <stop offset="1" stop-color="#F4D675" stop-opacity="0"/>
        <animateTransform attributeName="gradientTransform" type="translate" values="0 0;300 520;300 520" keyTimes="0;.28;1" dur="7s" begin="1.4s" repeatCount="indefinite"/>
      </linearGradient>
      <g id="${id}shape" stroke-width=".6" stroke-linejoin="round">${shape}</g>
    </defs>
    <use href="#${id}shape" fill="url(#${id}g)" stroke="url(#${id}g)"/>
    <use href="#${id}shape" fill="url(#${id}v)" stroke="url(#${id}v)"/>
    <use href="#${id}shape" fill="url(#${id}s)" stroke="url(#${id}s)" class="sheen"/>
    <path d="M100 262c-3 40-6 74-1 120" fill="none" stroke="#F4D675" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M98 520h44M98 546h44" stroke="#8C6A19" stroke-width="1" opacity=".7"/>
  </svg>`;
};

/* Marca pequeña (estrella en círculo) */
PA.mark = () => `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14.5" fill="none" stroke="#D4AF37" stroke-width="1"/><path d="M16 6.5l2.6 6 6.4.6-4.8 4.3 1.4 6.3L16 20.4 10.4 23.7l1.4-6.3L7 13.1l6.4-.6z" fill="#D4AF37"/></svg>`;
