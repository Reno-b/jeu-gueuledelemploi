/* ── Configuration ────────────────────────────────────────────────────────── */

const MACROS = [
  { id: 'gauche', label: 'Gauche', color: '#e63946', subs: ['GDR', 'LFI-NFP', 'EcoS', 'SOC'] },
  { id: 'droite', label: 'Droite', color: '#2a4dff', subs: ['EPR', 'Dem', 'HOR', 'LIOT'] },
  { id: 'facho',  label: 'Facho',  color: '#1a1a1a', subs: ['DR', 'UDR', 'RN'] },
];

const GROUP_NICKS = {
  'GDR': 'Communiste', 'LFI-NFP': 'Insoumis', 'EcoS': 'Écologiste', 'SOC': 'Socialiste',
  'EPR': 'Macroniste', 'Dem': 'MoDem', 'HOR': 'Horizons', 'LIOT': 'Indépendant',
  'DR': 'Républicain', 'UDR': 'Ciottiste', 'RN': 'Frontiste',
};

const GROUP_COLORS = {
  'GDR': '#d12a2a', 'LFI-NFP': '#8b3fcf', 'EcoS': '#2da567', 'SOC': '#ff5d8f',
  'EPR': '#ffd23f', 'Dem': '#ff9a3c', 'HOR': '#5cc8f0', 'LIOT': '#4b3cd1',
  'DR': '#1f3a6b', 'UDR': '#6b3f1f', 'RN': '#1a1a1a',
};

// Groupes à fond clair → texte sombre
const LIGHT_FILLS = new Set(['EPR', 'HOR', 'EcoS', 'SOC', 'Dem']);

const ADJACENCY = {
  'GDR':     ['LFI-NFP'],
  'LFI-NFP': ['GDR', 'EcoS'],
  'EcoS':    ['LFI-NFP', 'SOC'],
  'SOC':     ['EcoS', 'EPR'],
  'EPR':     ['SOC', 'Dem'],
  'Dem':     ['EPR', 'HOR'],
  'HOR':     ['Dem', 'DR'],
  'LIOT':    [],
  'DR':      ['HOR', 'UDR'],
  'UDR':     ['DR', 'RN'],
  'RN':      ['UDR', 'NI'],
  'NI':      ['RN'],
};

/* ── SVG helpers ──────────────────────────────────────────────────────────── */
const CX = 200, CY = 180, R_OUT = 175, R_IN = 60;
const SVGNS = 'http://www.w3.org/2000/svg';

function polar(deg, r) {
  const rad = deg * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function arcPath(a0, a1, r0, r1) {
  if (a1 - a0 < 0.05) return null;
  const [x0, y0] = polar(a0, r1);
  const [x1, y1] = polar(a1, r1);
  const [x2, y2] = polar(a1, r0);
  const [x3, y3] = polar(a0, r0);
  const lg = (a1 - a0) > 180 ? 1 : 0;
  const f = n => n.toFixed(2);
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${lg} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${lg} 0 ${f(x3)} ${f(y3)}Z`;
}

function svgEl(tag) { return document.createElementNS(SVGNS, tag); }

function svgText(parent, x, y, text, opts = {}) {
  const t = svgEl('text');
  t.setAttribute('x', x.toFixed(2));
  t.setAttribute('y', y.toFixed(2));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('dominant-baseline', 'middle');
  t.setAttribute('fill', opts.fill || '#fdf6e3');
  t.setAttribute('font-size', opts.size || '14');
  t.setAttribute('font-family', opts.family || 'Archivo Black, sans-serif');
  if (opts.weight) t.setAttribute('font-weight', opts.weight);
  if (opts.transform) t.setAttribute('transform', opts.transform);
  t.setAttribute('paint-order', 'stroke');
  t.setAttribute('stroke', opts.stroke || '#0a0a0a');
  t.setAttribute('stroke-width', opts.sw || '3');
  t.setAttribute('pointer-events', 'none');
  if (opts.opacity != null) t.style.opacity = opts.opacity;
  if (opts.ls) t.style.letterSpacing = opts.ls;
  t.textContent = text;
  parent.appendChild(t);
  return t;
}

/* ── État ─────────────────────────────────────────────────────────────────── */
let deputies = [], groups = {}, current = null;
let nextShadow = null;
let mode = 'normal';
let picked = null;
let revealed = false;
let answerState = 'idle';
let seen = new Set();
let autoTimer = null;
const score = { good: 0, bad: 0, streak: 0, record: 0, points: 0, pointsRecord: 0 };

function recordKey(m)       { return `record_${m}`; }
function pointsRecordKey(m) { return `points_record_${m}`; }

function calcPoints(ok, picked, correct) {
  if (mode === 'easy') return ok ? 1 : -1;
  if (picked === correct) return correct === 'LIOT' ? 5 : 3;
  if ((ADJACENCY[correct] || []).includes(picked)) return 2;
  const correctMacro = MACROS.find(m => m.subs.includes(correct));
  const pickedMacro  = MACROS.find(m => m.subs.includes(picked));
  return correctMacro === pickedMacro ? 1 : -1;
}

function bumpScore(pts) {
  const card = document.querySelector('.stat-card[data-tone="score-pts"]');
  if (!card) return;
  const el = document.createElement('span');
  el.className = 'score-bump';
  el.textContent = pts > 0 ? `+${pts}` : `${pts}`;
  el.style.color = pts > 0 ? 'var(--green)' : 'var(--pink)';
  el.style.setProperty('--bump-rot', pts > 0 ? '-6deg' : '6deg');
  card.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// Détection touch (hover: none = pas de hover natif)
const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animation hémicycle
let activeMacro = null;
let animProgress = 0;
let animStart = null;
let animRAF = null;
let macroLeaveTimer = null;
const ANIM_DUR = prefersReducedMotion ? 0 : 280;

const $ = id => document.getElementById(id);

/* ── Init ─────────────────────────────────────────────────────────────────── */
async function init() {
  $('loading').classList.remove('hidden');
  $('game').classList.add('hidden');
  $('error').classList.add('hidden');

  try {
    const res = await fetch('deputies.json');
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    deputies = data.deputies.filter(d => d.groupe !== 'NI');
    groups   = data.groups;
    if (!deputies.length) throw new Error('Aucun député trouvé');

    // Charger les records depuis localStorage (par mode)
    score.record       = parseInt(localStorage.getItem(recordKey(mode)) || '0', 10);
    score.pointsRecord = parseInt(localStorage.getItem(pointsRecordKey(mode)) || '0', 10);
    $('score-record').textContent        = score.record;
    $('score-points-record').textContent = score.pointsRecord;

    // Hint adaptatif au device
    $('hover-hint').textContent = isTouch
      ? 'Touche une famille pour voir les groupes'
      : 'Survole une famille pour voir les groupes';

    // Event listeners
    setupEvents();
    initEffectStars();
    setAccentColor();

    $('loading').classList.add('hidden');
    $('game').classList.remove('hidden');
    applyNextDeputy(null); // first load: no swipe animation, shadow pre-loaded inside

  } catch (e) {
    $('loading').classList.add('hidden');
    $('error').classList.remove('hidden');
    $('error-msg').textContent = e.message;
    console.error(e);
  }
}

function setupEvents() {
  // Mode toggle
  $('btn-normal').addEventListener('click', () => setMode('normal'));
  $('btn-easy').addEventListener('click',   () => setMode('easy'));

  // Mouse leave hemicycle (fallback : sortie complète du cadre)
  $('hemicycle-container').addEventListener('mouseleave', () => {
    if (!isTouch && !revealed) { clearTimeout(macroLeaveTimer); setActiveMacro(null); }
  });

  // Mobile : tap en dehors de l'hémicycle = refermer l'expansion
  document.addEventListener('touchstart', e => {
    if (!isTouch || !activeMacro || revealed) return;
    if (!$('hemicycle-container').contains(e.target)) setActiveMacro(null);
  }, { passive: true });

  // Pause auto-avance quand la souris/doigt est sur la photo
  $('deputy-card').addEventListener('mouseenter', () => {
    if (revealed) clearTimeout(autoTimer);
  });
  $('deputy-card').addEventListener('mouseleave', () => {
    if (revealed) autoTimer = setTimeout(nextDeputy, 1000);
  });
  $('deputy-card').addEventListener('touchstart', () => {
    if (revealed) clearTimeout(autoTimer);
  }, { passive: true });
  $('deputy-card').addEventListener('touchend', () => {
    if (revealed) autoTimer = setTimeout(nextDeputy, 1000);
  }, { passive: true });

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if ((e.code === 'Space' || e.code === 'Enter') && revealed) {
      e.preventDefault();
      nextDeputy();
    }
  });
}

/* ── Hémicycle animation ──────────────────────────────────────────────────── */
function setActiveMacro(id) {
  if (activeMacro === id) return;
  const startVal = animProgress;
  const targetVal = id ? 1 : 0;
  activeMacro = id;
  if (animRAF) cancelAnimationFrame(animRAF);
  animStart = null;

  if (ANIM_DUR === 0) {
    animProgress = targetVal;
    drawHemicycle();
    return;
  }

  const tick = (ts) => {
    if (!animStart) animStart = ts;
    const t = Math.min(1, (ts - animStart) / ANIM_DUR);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    animProgress = startVal + (targetVal - startVal) * eased;
    drawHemicycle();
    if (t < 1) animRAF = requestAnimationFrame(tick);
  };
  animRAF = requestAnimationFrame(tick);
}

/* ── Dessin SVG ───────────────────────────────────────────────────────────── */
function drawHemicycle() {
  const svg = $('hemicycle-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Fond : anneau de bordure noir + papier
  const bgBorder = svgEl('path');
  const bgBorderD = arcPath(180, 360, R_IN - 4, R_OUT + 4);
  if (bgBorderD) { bgBorder.setAttribute('d', bgBorderD); bgBorder.setAttribute('fill', '#0a0a0a'); svg.appendChild(bgBorder); }

  const bgPaper = svgEl('path');
  const bgPaperD = arcPath(180, 360, R_IN, R_OUT);
  if (bgPaperD) { bgPaper.setAttribute('d', bgPaperD); bgPaper.setAttribute('fill', '#fdf6e3'); svg.appendChild(bgPaper); }

  // Calcul des angles par macro
  let acc = 180;
  const macroSpans = {};
  for (const m of MACROS) {
    let w;
    if (!activeMacro) {
      w = 60;
    } else if (m.id === activeMacro) {
      w = 60 + 120 * animProgress;
    } else {
      w = 60 * (1 - animProgress);
    }
    macroSpans[m.id] = [acc, acc + w];
    acc += w;
  }

  for (const m of MACROS) {
    const span = macroSpans[m.id];
    if (!span || span[1] - span[0] < 0.3) continue;

    const isActive = m.id === activeMacro;
    const macroOpacity = isActive ? Math.max(0, 1 - animProgress * 1.4) : 1;
    const subOpacity   = isActive ? Math.min(1, animProgress * 1.2) : 0;
    const showSubs = isActive && animProgress > 0.05;

    const g = svgEl('g');
    g.classList.add('macro', `macro-${m.id}`);
    if (!revealed && mode !== 'easy') g.style.cursor = 'pointer';

    // Arc macro
    const macroD = arcPath(span[0] + 1, span[1] - 1, R_IN + 3, R_OUT - 3);
    if (macroD) {
      const mp = svgEl('path');
      mp.setAttribute('d', macroD);
      let macroFill = m.color;
      if (revealed && mode === 'easy') {
        const correctMacro = MACROS.find(mx => mx.subs.includes(current.groupe));
        if (correctMacro && m.id === correctMacro.id) macroFill = '#38d39f';
        else if (m.id === picked) macroFill = '#ff3b3b';
      }
      mp.setAttribute('fill', macroFill);
      mp.setAttribute('stroke', '#0a0a0a');
      mp.setAttribute('stroke-width', '3');
      mp.style.opacity = macroOpacity;
      g.appendChild(mp);
    }

    // Label macro (visible tant que non-expansé)
    if (macroOpacity > 0.05 && (span[1] - span[0]) > 10) {
      const mid = (span[0] + span[1]) / 2;
      const [lx, ly] = polar(mid, (R_IN + R_OUT) / 2);
      const rot = mid - 270;
      const lbl = svgText(g, lx, ly, m.label.toUpperCase(), {
        fill: '#fdf6e3', size: '18',
        family: 'Archivo Black, sans-serif',
        transform: `rotate(${rot.toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})`,
        stroke: '#0a0a0a', sw: '3',
        opacity: macroOpacity,
      });
      // text-transform via style (SVG attribute ne suffit pas)
      lbl.style.textTransform = 'uppercase';
    }

    // Sous-groupes (expansés)
    if (showSubs) {
      const subs = m.subs.filter(s => groups[s]);
      if (subs.length > 0) {
        const subW = (span[1] - span[0]) / subs.length;
        subs.forEach((abbr, i) => {
          const a0 = span[0] + i * subW;
          const a1 = a0 + subW;

          let fill;
          if (revealed) {
            if (abbr === current.groupe)      fill = '#38d39f'; // correct
            else if (abbr === picked)          fill = '#ff3b3b'; // mauvais choix
            else                               fill = GROUP_COLORS[abbr] || '#888';
          } else {
            fill = GROUP_COLORS[abbr] || '#888';
          }

          const sg = svgEl('g');
          sg.classList.add('sub-group');
          if (!revealed) sg.classList.add('pop-sector');
          if (revealed && animProgress >= 1) {
            if (abbr === current.groupe) sg.classList.add('sector-reveal-correct');
            else if (abbr === picked)    sg.classList.add('sector-reveal-wrong');
          }
          sg.style.opacity = subOpacity;

          const subD = arcPath(a0 + 0.5, a1 - 0.5, R_IN + 3, R_OUT - 3);
          if (subD) {
            const sp = svgEl('path');
            sp.setAttribute('d', subD);
            sp.setAttribute('fill', fill);
            sp.setAttribute('stroke', '#0a0a0a');
            sp.setAttribute('stroke-width', '2.5');
            if (!revealed) {
              sp.style.cursor = 'pointer';
              sp.addEventListener('click', (e) => { e.stopPropagation(); handlePick(abbr); });
            }
            sg.appendChild(sp);
          }

          // Labels du sous-groupe
          const mid  = (a0 + a1) / 2;
          const rMid = (R_IN + R_OUT) / 2;
          const [lx, ly]   = polar(mid, rMid + 6);
          const [lx2, ly2] = polar(mid, rMid - 14);
          const rot = mid - 270;
          const isLight = LIGHT_FILLS.has(abbr) || (revealed && abbr === current.groupe);
          const textFill   = isLight ? '#0a0a0a' : '#fdf6e3';
          const textStroke = isLight ? '#fdf6e3' : '#0a0a0a';

          svgText(sg, lx, ly, GROUP_NICKS[abbr] || abbr, {
            fill: textFill, size: '13',
            family: 'Archivo Black, sans-serif',
            transform: `rotate(${rot.toFixed(1)} ${lx.toFixed(2)} ${ly.toFixed(2)})`,
            stroke: textStroke, sw: '2.5',
          });

          svgText(sg, lx2, ly2, abbr, {
            fill: textFill, size: '8',
            family: 'JetBrains Mono, monospace',
            weight: '700',
            transform: `rotate(${rot.toFixed(1)} ${lx2.toFixed(2)} ${ly2.toFixed(2)})`,
            stroke: textStroke, sw: '0',
            opacity: 0.85, ls: '0.08em',
          });

          g.appendChild(sg);
        });
      }
    }

    // Événements sur le groupe
    if (revealed && mode === 'easy') {
      const correctMacro = MACROS.find(mx => mx.subs.includes(current.groupe));
      if (correctMacro && m.id === correctMacro.id) g.classList.add('sector-reveal-correct');
      else if (m.id === picked)                      g.classList.add('sector-reveal-wrong');
    }

    if (!revealed) {
      if (mode === 'easy') {
        // Mode facile : clic direct sur la macro = réponse, pas d'expansion
        g.style.cursor = 'pointer';
        g.classList.add('pop-sector');
        g.addEventListener('click', () => handlePick(m.id));
      } else if (isTouch) {
        // Touch normal : tap pour toggler l'expansion
        g.addEventListener('click', () => {
          if (!activeMacro || activeMacro !== m.id) setActiveMacro(m.id);
          else setActiveMacro(null);
        });
      } else {
        // Desktop : hover pour expanser, quitte le secteur = refermer
        g.addEventListener('mouseenter', () => {
          clearTimeout(macroLeaveTimer);
          setActiveMacro(m.id);
        });
        g.addEventListener('mouseleave', () => {
          macroLeaveTimer = setTimeout(() => setActiveMacro(null), 150);
        });
      }
    }

    svg.appendChild(g);
  }

  updateHint();
}

function updateHint() {
  const hint = $('hover-hint');
  if (activeMacro || revealed || mode === 'easy') {
    hint.style.visibility = 'hidden';
  } else {
    hint.style.visibility = 'visible';
  }
}

/* ── Effect stars init ────────────────────────────────────────────────────── */
function setAccentColor() {
  const groups = Object.keys(GROUP_COLORS);
  const group  = groups[Math.floor(Math.random() * groups.length)];
  const color  = GROUP_COLORS[group];
  const accent = document.querySelector('.site-title .accent');
  if (!accent) return;
  accent.style.background = color;
  accent.style.color = LIGHT_FILLS.has(group) ? 'var(--ink)' : 'var(--paper)';
}

function initEffectStars() {
  const layer = $('effect-layer');
  const N = 14;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * 360;
    const dist = 90 + Math.random() * 80;
    const dx = Math.round(Math.cos(angle * Math.PI / 180) * dist);
    const dy = Math.round(Math.sin(angle * Math.PI / 180) * dist);
    const rot = Math.round(Math.random() * 60 - 30);
    const size = 22 + Math.round(Math.random() * 16);
    const delay = (Math.random() * 0.07).toFixed(2);
    const el = document.createElement('span');
    el.className = 'effect-star';
    el.textContent = '★';
    el.style.cssText = `font-size:${size}px;--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;animation-delay:${delay}s`;
    layer.appendChild(el);
  }
}

/* ── Game flow ────────────────────────────────────────────────────────────── */
function pickDeputy() {
  if (seen.size >= deputies.length) seen.clear();
  let d, tries = 0;
  do {
    d = deputies[Math.floor(Math.random() * deputies.length)];
    if (++tries > deputies.length * 3) { seen.clear(); break; }
  } while (seen.has(d.id));
  seen.add(d.id);
  return d;
}

function preloadNextShadow() {
  nextShadow = pickDeputy();
  $('shadow-photo').src = `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${nextShadow.id}.jpg`;
}

function applyNextDeputy(deputy) {
  current     = deputy || pickDeputy();
  picked      = null;
  revealed    = false;
  answerState = 'idle';

  activeMacro  = null;
  animProgress = 0;
  if (animRAF) cancelAnimationFrame(animRAF);

  $('panel-tag').textContent  = '?';
  $('panel-text').textContent = mode === 'easy' ? 'Quel est son bord politique ?' : 'Quel est son parti politique ?';
  $('reveal-banner').classList.add('hidden');
  $('deputy-meta').classList.add('hidden');

  const img = $('deputy-photo');
  const newSrc = `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${current.id}.jpg`;
  img.onload  = () => { img.style.opacity = '1'; };
  img.onerror = () => { img.style.opacity = '0'; };
  img.src = newSrc;
  img.style.opacity = img.complete ? '1' : '0';

  drawHemicycle();
  preloadNextShadow(); // pre-load next deputy's photo into shadow card
}

function nextDeputy() {
  clearTimeout(autoTimer);


  if (prefersReducedMotion) {
    applyNextDeputy(nextShadow);
    return;
  }

  const card = $('deputy-card');
  card.classList.add('swiping-out');

  setTimeout(() => {
    const deputy = nextShadow; // already visible in shadow card
    card.style.transition = 'none';
    card.classList.remove('swiping-out');
    void card.offsetWidth;
    card.style.transition = '';
    applyNextDeputy(deputy);
  }, 250);
}

function triggerCorrectEffect() {
  if (prefersReducedMotion) return;
  const stamp = $('effect-stamp');
  const layer = $('effect-layer');
  stamp.textContent = '✓';
  stamp.className = 'effect-stamp correct';
  layer.classList.remove('effect-correct', 'effect-wrong');
  void layer.offsetWidth;
  layer.classList.add('effect-correct');
}

function triggerWrongEffect() {
  if (prefersReducedMotion) return;
  const stamp = $('effect-stamp');
  const layer = $('effect-layer');
  stamp.textContent = '✗';
  stamp.className = 'effect-stamp wrong';
  layer.classList.remove('effect-correct', 'effect-wrong');
  void layer.offsetWidth;
  layer.classList.add('effect-wrong');
}

function handlePick(abbr) {
  if (revealed) return;


  let ok;
  if (mode === 'easy') {
    ok = MACROS.find(m => m.id === abbr).subs.includes(current.groupe);
  } else {
    ok = (abbr === current.groupe);
  }

  picked      = abbr;
  answerState = ok ? 'correct' : 'wrong';
  revealed    = true;

  if (ok) triggerCorrectEffect();
  else    triggerWrongEffect();

  const pts = calcPoints(ok, abbr, current.groupe);
  updateScore(ok, pts);

  // Expanser la macro contenant la bonne réponse (mode normal uniquement, pour montrer le bon groupe)
  if (mode !== 'easy') {
    const correctMacro = MACROS.find(m => m.subs.includes(current.groupe));
    if (correctMacro) {
      // Si la macro correcte est déjà active, setActiveMacro retournerait sans redessiner
      if (activeMacro === correctMacro.id) drawHemicycle();
      else setActiveMacro(correctMacro.id);
    } else {
      drawHemicycle();
    }
  } else {
    drawHemicycle();
  }

  // Laisser l'hémicycle animer avant de révéler la carte
  const revealDelay = ANIM_DUR + 80;
  setTimeout(revealCard, revealDelay);
  autoTimer = setTimeout(nextDeputy, revealDelay + 1100);
}

function revealCard() {
  // Panel title
  $('panel-tag').textContent = answerState === 'correct' ? '✓' : '✗';
  $('panel-text').textContent = answerState === 'correct' ? 'Bien joué !' : 'Raté…';

  // Reveal banner
  const banner = $('reveal-banner');
  banner.classList.remove('hidden');
  banner.dataset.tone = answerState;

  const fullName = `${current.prenom} ${current.nom}`.toUpperCase();
  $('reveal-name').textContent = fullName;

  const grpColor = GROUP_COLORS[current.groupe] || '#555';
  const grpNick  = GROUP_NICKS[current.groupe]  || current.groupe;
  const grpEl = $('reveal-group');
  grpEl.textContent = `${grpNick} · ${current.groupe}`;
  grpEl.style.background = grpColor;
  grpEl.style.color = LIGHT_FILLS.has(current.groupe) ? '#0a0a0a' : '#fdf6e3';

  // Meta
  const meta = $('deputy-meta');
  meta.classList.remove('hidden');
  $('meta-circo').textContent   = current.numCirco ? `${current.numCirco}ᵉ circ.` : '—';
  $('meta-dept').textContent    = current.dept     || '—';
  $('meta-prof').textContent    = current.profession || '—';
  $('meta-region').textContent  = current.region   || '—';

}

/* ── Score ────────────────────────────────────────────────────────────────── */
function bumpStat(tone) {
  const colors = { good: 'var(--green)', bad: 'var(--pink)', streak: 'var(--orange)', record: 'var(--violet)', 'score-rec': 'var(--yellow)' };
  const rots   = { good: '-8deg', bad: '6deg', streak: '-4deg', record: '9deg', 'score-rec': '-5deg' };
  const card = document.querySelector(`.stat-card[data-tone="${tone}"]`);
  if (!card) return;
  const el = document.createElement('span');
  el.className = 'score-bump';
  el.textContent = '+1';
  el.style.color = colors[tone] || 'var(--ink)';
  el.style.setProperty('--bump-rot', rots[tone] || '-6deg');
  card.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function updateScore(ok, pts) {
  const wasRecord = score.record;
  const wasPointsRecord = score.pointsRecord;
  if (ok) {
    score.good++;
    score.streak++;
    if (score.streak > score.record) {
      score.record = score.streak;
      localStorage.setItem(recordKey(mode), score.record);
    }
  } else {
    score.bad++;
    score.streak = 0;
  }

  score.points = Math.max(0, score.points + pts);
  if (score.points > score.pointsRecord) {
    score.pointsRecord = score.points;
    localStorage.setItem(pointsRecordKey(mode), score.pointsRecord);
  }

  $('score-good').textContent         = score.good;
  $('score-bad').textContent          = score.bad;
  $('score-streak').textContent       = score.streak;
  $('score-record').textContent       = score.record;
  $('score-points').textContent       = score.points;
  $('score-points-record').textContent = score.pointsRecord;

  bumpScore(pts);
  if (ok) {
    bumpStat('good');
    bumpStat('streak');
    if (score.record > wasRecord) bumpStat('record');
    if (score.pointsRecord > wasPointsRecord) bumpStat('score-rec');
  } else {
    bumpStat('bad');
  }

  if (ok && score.streak > 1) {
    const c = document.querySelector('.stat-card[data-tone="streak"]');
    c.style.transform = 'translate(-4px, -4px)';
    setTimeout(() => { c.style.transform = ''; }, 250);
  }
}

/* ── Mode ─────────────────────────────────────────────────────────────────── */
function setMode(m) {
  if (mode === m) return;
  mode = m;
  score.good         = 0;
  score.bad          = 0;
  score.streak       = 0;
  score.record       = parseInt(localStorage.getItem(recordKey(m)) || '0', 10);
  score.points       = 0;
  score.pointsRecord = parseInt(localStorage.getItem(pointsRecordKey(m)) || '0', 10);
  $('score-good').textContent          = 0;
  $('score-bad').textContent           = 0;
  $('score-streak').textContent        = 0;
  $('score-record').textContent        = score.record;
  $('score-points').textContent        = 0;
  $('score-points-record').textContent = score.pointsRecord;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  $(`btn-${m}`).classList.add('active');
  drawHemicycle();
}

/* ── Démarrage ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
