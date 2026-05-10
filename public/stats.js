/* ───────────────────────────────────────────────────────────────────────────
   stats.js — Page Collection
   Lit deputies.json + localStorage["deputy_picks"], rend stats + grid.
   ─────────────────────────────────────────────────────────────────────────── */

const PHOTO_URL = (id) => `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${id}.jpg`;

const GROUP_ORDER = ['GDR', 'LFI-NFP', 'EcoS', 'SOC', 'EPR', 'Dem', 'HOR', 'LIOT', 'DR', 'UDR', 'RN'];

const GROUP_FULL = {
  'GDR':     'Gauche Démocrate et Républicaine',
  'LFI-NFP': 'La France Insoumise',
  'EcoS':    'Écologiste et Social',
  'SOC':     'Socialistes',
  'EPR':     'Ensemble pour la République',
  'Dem':     'Démocrates',
  'HOR':     'Horizons',
  'LIOT':    'Libertés, Indépendants, Outre-mer et Territoires',
  'DR':      'Droite Républicaine',
  'UDR':     'Union des Droites',
  'RN':      'Rassemblement National',
};

const GROUP_COLOR = {
  'GDR':     'var(--grp-GDR)',
  'LFI-NFP': 'var(--grp-LFI-NFP)',
  'EcoS':    'var(--grp-EcoS)',
  'SOC':     'var(--grp-SOC)',
  'EPR':     'var(--grp-EPR)',
  'Dem':     'var(--grp-Dem)',
  'HOR':     'var(--grp-HOR)',
  'LIOT':    'var(--grp-LIOT)',
  'DR':      'var(--grp-DR)',
  'UDR':     'var(--grp-UDR)',
  'RN':      'var(--grp-RN)',
};

// Groupes à fond clair → texte sombre sur la bandelette nom
const LIGHT_GRP = new Set(['EPR', 'HOR', 'EcoS', 'SOC', 'Dem']);

const RANKS = [
  { min: 1000, tier: 'diamond',  name: 'Diamant', color: '#89cff0', text: 'var(--ink)' },
  { min: 500,  tier: 'platinum', name: 'Platine', color: '#e5e4e2', text: 'var(--ink)' },
  { min: 100,  tier: 'gold',     name: 'Or',      color: '#ffd700', text: 'var(--ink)' },
  { min: 50,   tier: 'silver',   name: 'Argent',  color: '#c0c0c0', text: 'var(--ink)' },
  { min: 10,   tier: 'bronze',   name: 'Bronze',  color: '#cd7f32', text: 'var(--paper)' },
];

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  deputies: [],
  picks: {},
  filter: 'all',
  sort: 'recent',
};

// ── Lecture localStorage ──────────────────────────────────────────────────
function readPicks() {
  try {
    return JSON.parse(localStorage.getItem('deputy_picks') || '{}') || {};
  } catch (_) {
    return {};
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
async function initStats() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('stats-content').classList.add('hidden');

  try {
    const res = await fetch('deputies.json');
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
    const data = await res.json();
    const deputies = data.deputies.filter(d => d && d.id && d.groupe && d.groupe !== 'NI');
    if (!deputies.length) throw new Error('Aucun député trouvé');

    state.deputies = deputies;
    if (new URLSearchParams(window.location.search).has('seed')) seedTestPicks();
    state.picks    = readPicks();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('stats-content').classList.remove('hidden');

    renderGlobalStats();
    renderGroupFilters();
    bindSortButtons();
    renderGrid();
    setupModal();
  } catch (err) {
    console.error(err);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('error-msg').textContent = 'Impossible de charger la collection.';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function statFor(deputy) {
  const s = state.picks[deputy.id];
  if (!s || !s.encounters) return null;
  return {
    encounters: s.encounters,
    correct:    s.correct || 0,
    firstSeen:  s.firstSeen || 0,
    picks:      s.picks || {},
    accuracy:   s.encounters ? (s.correct || 0) / s.encounters : 0,
  };
}

function tierFromAcc(stat) {
  if (!stat) return null;
  if (stat.encounters < 2) return 'thin';
  if (stat.accuracy >= 0.7) return 'good';
  if (stat.accuracy >= 0.4) return 'mid';
  return 'bad';
}

function fullName(d) { return `${d.prenom} ${d.nom}`; }

function shortName(d) {
  const initial = (d.prenom || '').trim().charAt(0);
  return initial ? `${initial}. ${d.nom}`.toUpperCase() : (d.nom || '').toUpperCase();
}

function initialsOf(d) {
  return ((d.prenom || '').charAt(0) + (d.nom || '').charAt(0)).toUpperCase() || '?';
}

function rankFor(correct) {
  return RANKS.find(r => correct >= r.min) || null;
}

function nextRankFor(correct) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (RANKS[i].min > correct) return RANKS[i];
  }
  return null;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function mostConfusedWith(deputy, stat) {
  if (!stat) return null;
  const correctGrp = deputy.groupe;
  let best = null, bestN = 0;
  for (const [grp, n] of Object.entries(stat.picks || {})) {
    if (grp === correctGrp) continue;
    if (n > bestN) { best = grp; bestN = n; }
  }
  return best;
}

// ── Render: stats globales ────────────────────────────────────────────────
function renderGlobalStats() {
  const total = state.deputies.length;
  let discovered = 0, totalEnc = 0, totalCorrect = 0;
  let nemesis = null, nemesisRate = 1;
  const confMatrix = new Map();

  state.deputies.forEach(d => {
    const s = statFor(d);
    if (!s) return;
    discovered++;
    totalEnc     += s.encounters;
    totalCorrect += s.correct;

    if (s.encounters >= 3) {
      if (!nemesis || s.accuracy < nemesisRate ||
          (s.accuracy === nemesisRate && s.encounters > nemesis.stat.encounters)) {
        nemesis = { deputy: d, stat: s };
        nemesisRate = s.accuracy;
      }
    }

    const correctGrp = d.groupe;
    for (const [grp, n] of Object.entries(s.picks || {})) {
      if (grp === correctGrp) continue;
      const key = `${correctGrp}→${grp}`;
      confMatrix.set(key, (confMatrix.get(key) || 0) + n);
    }
  });

  document.getElementById('g-discovered').textContent = discovered;
  document.getElementById('g-total').textContent      = total;
  document.getElementById('g-progress').style.width   = total ? `${(discovered / total) * 100}%` : '0%';

  const accEl    = document.getElementById('g-accuracy');
  const accSubEl = document.getElementById('g-accuracy-sub');
  if (totalEnc) {
    accEl.textContent    = `${Math.round(totalCorrect / totalEnc * 100)}%`;
    accSubEl.textContent = `${totalCorrect} / ${totalEnc} bonnes réponses`;
  } else {
    accEl.textContent    = '—';
    accSubEl.textContent = 'aucune partie jouée';
  }

  const nemEl = document.getElementById('g-nemesis');
  if (nemesis) {
    const d = nemesis.deputy, s = nemesis.stat;
    nemEl.innerHTML = `
      <img class="nemesis-photo" src="${PHOTO_URL(d.id)}"
           onerror="this.outerHTML='<div class=\\'nemesis-photo placeholder\\'>${initialsOf(d)}</div>'"
           alt="${fullName(d)}">
      <div class="nemesis-meta">
        <div class="nemesis-name">${fullName(d)}</div>
        <div class="nemesis-rate">${Math.round(s.accuracy * 100)}% · ${s.correct}/${s.encounters}</div>
      </div>
    `;
  }

  const confEl = document.getElementById('g-confusion');
  if (confMatrix.size > 0) {
    let bestKey = null, bestN = 0;
    for (const [k, v] of confMatrix.entries()) {
      if (v > bestN) { bestKey = k; bestN = v; }
    }
    const [src, dst] = bestKey.split('→');
    confEl.innerHTML = `Tu mets souvent <span class="pill" style="background:${GROUP_COLOR[dst]}">${dst}</span> là où c'est <span class="pill" style="background:${GROUP_COLOR[src]}">${src}</span>`;
  }

  // Précision par groupe
  const groupStats = {};
  state.deputies.forEach(d => {
    const s = statFor(d);
    if (!s) return;
    const g = d.groupe;
    if (!groupStats[g]) groupStats[g] = { correct: 0, encounters: 0 };
    groupStats[g].correct    += s.correct;
    groupStats[g].encounters += s.encounters;
  });

  let bestGrp = null, bestAcc = -1;
  let worstGrp = null, worstAcc = 2;
  for (const [g, s] of Object.entries(groupStats)) {
    if (s.encounters < 3) continue;
    const acc = s.correct / s.encounters;
    if (acc > bestAcc)  { bestGrp  = { groupe: g, ...s, accuracy: acc }; bestAcc  = acc; }
    if (acc < worstAcc) { worstGrp = { groupe: g, ...s, accuracy: acc }; worstAcc = acc; }
  }

  const bestEl = document.getElementById('g-best-group');
  if (bestEl && bestGrp) {
    const bestTxt = LIGHT_GRP.has(bestGrp.groupe) ? 'var(--ink)' : 'var(--paper)';
    bestEl.innerHTML = `<span class="group-acc-name" style="background:${GROUP_COLOR[bestGrp.groupe]};color:${bestTxt}">${GROUP_FULL[bestGrp.groupe] || bestGrp.groupe}</span><span class="group-acc-rate">${Math.round(bestGrp.accuracy * 100)}% · ${bestGrp.correct}/${bestGrp.encounters}</span>`;
  }
  const worstEl = document.getElementById('g-worst-group');
  if (worstEl && worstGrp) {
    const worstTxt = LIGHT_GRP.has(worstGrp.groupe) ? 'var(--ink)' : 'var(--paper)';
    worstEl.innerHTML = `<span class="group-acc-name" style="background:${GROUP_COLOR[worstGrp.groupe]};color:${worstTxt}">${GROUP_FULL[worstGrp.groupe] || worstGrp.groupe}</span><span class="group-acc-rate">${Math.round(worstGrp.accuracy * 100)}% · ${worstGrp.correct}/${worstGrp.encounters}</span>`;
  }
}

// ── Render: filtres groupe ────────────────────────────────────────────────
function renderGroupFilters() {
  const wrap = document.getElementById('group-filters');
  const counts = new Map();
  state.deputies.forEach(d => counts.set(d.groupe, (counts.get(d.groupe) || 0) + 1));

  const buttons = [
    { key: 'all', label: 'Tous', count: state.deputies.length, color: 'var(--ink)' },
    ...GROUP_ORDER
      .filter(g => counts.get(g))
      .map(g => ({ key: g, label: g, count: counts.get(g), color: GROUP_COLOR[g] })),
  ];

  wrap.innerHTML = buttons.map(b =>
    `<button class="group-btn ${state.filter === b.key ? 'active' : ''}"
             data-group="${b.key}"
             style="--grp-color:${b.color}">
       ${b.label}<span class="count">${b.count}</span>
     </button>`
  ).join('');

  wrap.querySelectorAll('.group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.group;
      wrap.querySelectorAll('.group-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderGrid();
    });
  });
}

// ── Render: tri ───────────────────────────────────────────────────────────
function bindSortButtons() {
  document.querySelectorAll('#sort-buttons .sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sort = btn.dataset.sort;
      document.querySelectorAll('#sort-buttons .sort-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderGrid();
    });
  });
}

// ── Render: grid ──────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('collection-grid');
  let items = state.deputies.slice();

  if (state.filter !== 'all') {
    items = items.filter(d => d.groupe === state.filter);
  }

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">Aucun·e député·e dans ce groupe</div>`;
    return;
  }

  const groupRank = (g) => {
    const i = GROUP_ORDER.indexOf(g);
    return i === -1 ? 999 : i;
  };

  if (state.sort === 'group') {
    items.sort((a, b) =>
      groupRank(a.groupe) - groupRank(b.groupe) ||
      (a.nom || '').localeCompare(b.nom || '')
    );
  } else if (state.sort === 'name') {
    items.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
  } else if (state.sort === 'difficulty') {
    items.sort((a, b) => {
      const sa = statFor(a), sb = statFor(b);
      const aQual = sa && sa.encounters >= 3;
      const bQual = sb && sb.encounters >= 3;
      if (aQual !== bQual) return aQual ? -1 : 1;
      if (sa && sb) return sa.accuracy - sb.accuracy || sb.encounters - sa.encounters;
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return 0;
    });
  } else if (state.sort === 'recent') {
    items.sort((a, b) => {
      const sa = statFor(a), sb = statFor(b);
      if (sa && sb) return (sb.correct || 0) - (sa.correct || 0);
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return 0;
    });
  }

  const showSections = state.sort === 'group' && state.filter === 'all';
  let currentGroup = null;
  const html = items.map(d => {
    let prefix = '';
    if (showSections && d.groupe !== currentGroup) {
      currentGroup = d.groupe;
      const c = items.filter(x => x.groupe === d.groupe).length;
      prefix = `<div class="section-head" style="--grp-color:${GROUP_COLOR[d.groupe]}">
        <span class="pill">${d.groupe}</span>
        <span class="count">${c} député·e${c > 1 ? '·s' : ''} · ${GROUP_FULL[d.groupe] || ''}</span>
      </div>`;
    }
    return prefix + cardHtml(d);
  }).join('');
  grid.innerHTML = html;

  grid.querySelectorAll('.card:not(.locked)').forEach(card => {
    const deputy = state.deputies.find(d => d.id === card.dataset.id);
    if (deputy) card.addEventListener('click', () => openCardModal(deputy, card));
  });
}

// ── Render: une carte (grille — recto uniquement, dos affiché dans le modal) ──
function cardHtml(d) {
  const stat     = statFor(d);
  const grpColor = GROUP_COLOR[d.groupe] || 'var(--grp-NONE)';

  if (!stat) {
    return `
      <div class="card locked" aria-label="Député non rencontré">
        <div class="card-inner">
          <div class="card-face card-front">
            <div class="card-photo-wrap">
              <svg class="silhouette" viewBox="0 0 60 80" fill="currentColor" aria-hidden="true">
                <circle cx="30" cy="26" r="12"/>
                <path d="M5 80 C 5 27, 55 27, 55 80 Z"/>
              </svg>
              <div class="question-mark">?</div>
              <div class="bracket tl"></div><div class="bracket tr"></div>
              <div class="bracket bl"></div><div class="bracket br"></div>
            </div>
            <div class="card-name">À découvrir</div>
          </div>
        </div>
      </div>`;
  }

  const seenOnly   = stat.correct === 0;
  const rank       = seenOnly ? null : rankFor(stat.correct);
  const tier       = seenOnly ? 'zero' : (!rank ? 'thin' : tierFromAcc(stat));
  const accLabel   = seenOnly ? '×0' : `×${stat.correct}`;
  const grpText    = LIGHT_GRP.has(d.groupe) ? 'var(--ink)' : 'var(--paper)';
  const rankStyle  = rank ? `--rank-border:${rank.color};` : '';
  const badgeStyle = rank ? `background:${rank.color};color:${rank.text};` : '';

  return `
    <div class="card${seenOnly ? ' seen-only' : ''}" data-id="${d.id}" data-group="${d.groupe}"
         style="--grp-color:${grpColor};--grp-text:${grpText};${rankStyle}">
      <div class="card-inner">
        <div class="card-face card-front">
          <div class="rank-ring"></div>
          <div class="card-photo-wrap">
            <img class="card-photo" src="${PHOTO_URL(d.id)}" alt="${fullName(d)}"
                 onerror="this.outerHTML='<div class=\\'card-photo-fallback\\'>${initialsOf(d)}</div>'">
            <div class="bracket tl"></div><div class="bracket tr"></div>
            <div class="bracket bl"></div><div class="bracket br"></div>
            <div class="acc-badge" data-tier="${tier}" style="${badgeStyle}" title="${stat.correct}/${stat.encounters} bonnes réponses">${accLabel}</div>
          </div>
          <div class="card-name">${shortName(d)}</div>
        </div>
      </div>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────
function setupModal() {
  document.getElementById('card-modal-backdrop').addEventListener('click', closeCardModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCardModal(); });
}

function openCardModal(d, cardEl) {
  const stat = statFor(d);
  if (!stat) return;

  const modal    = document.getElementById('card-modal');
  const backdrop = document.getElementById('card-modal-backdrop');

  // FLIP : décalage centre-carte vs centre-écran + ratio de taille
  const rect   = cardEl.getBoundingClientRect();
  const modalW = Math.min(320, window.innerWidth * 0.8);
  const dx     = (rect.left + rect.width / 2) - window.innerWidth / 2;
  const dy     = (rect.top  + rect.height / 2) - window.innerHeight / 2;
  const scale  = rect.width / modalW;

  modal.style.setProperty('--card-dx',    `${dx}px`);
  modal.style.setProperty('--card-dy',    `${dy}px`);
  modal.style.setProperty('--card-scale', scale);

  // Rang basé sur correct (pas encounters)
  const seenOnly = stat.correct === 0;
  const rank     = seenOnly ? null : rankFor(stat.correct);
  if (rank) {
    modal.style.setProperty('--rank-border', rank.color);
  } else {
    modal.style.removeProperty('--rank-border');
  }

  const grpColor    = GROUP_COLOR[d.groupe] || 'var(--grp-NONE)';
  const grpText     = LIGHT_GRP.has(d.groupe) ? 'var(--ink)' : 'var(--paper)';
  const tier        = seenOnly ? 'zero' : tierFromAcc(stat);
  const accLabel    = seenOnly ? '×0' : `×${stat.correct}`;
  const badgeStyle  = rank ? `background:${rank.color};color:${rank.text};` : '';
  const confused    = mostConfusedWith(d, stat);
  const circoNum    = d.numCirco ? `${d.numCirco}ᵉ circ.` : '—';
  const circo       = d.numCirco ? `${d.numCirco}ᵉ · ${d.dept || ''}` : (d.dept || '—');
  const nextRank    = nextRankFor(stat.correct);
  const nextTxt     = nextRank ? `${nextRank.min - stat.correct} cartes` : 'MAX !';
  const rankLabel   = rank ? rank.name : 'Aucun';
  const prec        = `${Math.round(stat.accuracy * 100)}%`;
  const precBg      = stat.accuracy >= 0.5 ? 'var(--green)' : 'var(--red)';
  const precFg      = stat.accuracy >= 0.5 ? 'var(--ink)'   : 'var(--paper)';

  modal.innerHTML = `
    <div class="card-modal-inner" style="--grp-color:${grpColor};--grp-text:${grpText}">
      <!-- RECTO -->
      <div class="card-face card-front">
        <div class="rank-ring"></div>
        <div class="card-photo-wrap">
          <img class="card-photo" src="${PHOTO_URL(d.id)}" alt="${fullName(d)}"
               onerror="this.outerHTML='<div class=\\'card-photo-fallback\\'>${initialsOf(d)}</div>'">
          <div class="bracket tl"></div><div class="bracket tr"></div>
          <div class="bracket bl"></div><div class="bracket br"></div>
        </div>
        <div class="card-name">${shortName(d)}</div>
      </div>
      <!-- VERSO -->
      <div class="card-face card-back">
        <div class="back-header">
          <span class="grp-pill">${d.groupe}</span>
          <span class="back-count" ${rank ? `style="background:${rank.color};color:${rank.text};"` : ''}>×${stat.correct}</span>
        </div>
        <div class="back-identity">
          <img class="back-passport-photo" src="${PHOTO_URL(d.id)}" alt="${fullName(d)}"
               onerror="this.outerHTML='<div class=\\'back-passport-fallback\\'>${initialsOf(d)}</div>'">
          <div class="back-id-text">
            <div class="back-full-name">${fullName(d).toUpperCase()}</div>
            <div class="back-grp-name">${GROUP_FULL[d.groupe] || d.groupe}</div>
          </div>
        </div>
        <div class="back-section">
          <div class="back-sec-label">Localisation</div>
          <div class="back-chips-row">
            <div class="back-chip"><span class="chip-key">Circonscription</span><span class="chip-val">${circoNum}</span></div>
            <div class="back-chip"><span class="chip-key">Région</span><span class="chip-val">${d.region || '—'}</span></div>
          </div>
        </div>
        <div class="back-section">
          <div class="back-sec-label">Stats de jeu</div>
          <div class="back-chips-row">
            <div class="back-chip"><span class="chip-key">Vu</span><span class="chip-val">${stat.encounters}×</span></div>
            <div class="back-chip"><span class="chip-key">Trouvé·e</span><span class="chip-val">${stat.correct}×</span></div>
            <div class="back-chip" style="background:${precBg};color:${precFg};"><span class="chip-key">Précision</span><span class="chip-val">${prec}</span></div>
          </div>
        </div>
        <div class="back-section">
          <div class="back-sec-label">Progression</div>
          <div class="back-chips-row">
            <div class="back-chip"><span class="chip-key">Souvent pris·e pour</span>${confused ? `<span class="chip-tag" style="background:${GROUP_COLOR[confused]}">${confused}</span>` : '<span class="chip-val">—</span>'}</div>
            <div class="back-chip rank-chip" ${rank ? `style="--rank-chip-bg:${rank.color};--rank-chip-text:${rank.text};"` : ''}><span class="chip-key">Grade</span><span class="chip-val">${rankLabel}</span></div>
            <div class="back-chip"><span class="chip-key">Prochain grade dans…</span><span class="chip-val">${nextTxt}</span></div>
          </div>
        </div>
      </div>
    </div>`;

  backdrop.classList.add('active');
  modal.classList.remove('closing');
  /* Double RAF : force Safari à peindre l'élément avant de démarrer l'animation */
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('active')));
}

function closeCardModal() {
  const modal = document.getElementById('card-modal');
  const backdrop = document.getElementById('card-modal-backdrop');
  backdrop.classList.remove('active');
  modal.classList.remove('active');
  modal.classList.add('closing');
  setTimeout(() => modal.classList.remove('closing'), 300);
}

// ── Test data generator (?seed=1) ────────────────────────────────────────
function seedTestPicks() {
  const picks = {};
  const rand  = (n) => Math.floor(Math.random() * n);

  // Tier examples: forcer un deputy par rang
  const forcedStats = [
    { encounters: 1050, correct: 1020 },  // diamant
    { encounters: 530,  correct: 505 },   // platine
    { encounters: 140,  correct: 115 },   // or
    { encounters: 65,   correct: 58 },    // argent
    { encounters: 18,   correct: 12 },    // bronze
    { encounters: 5,    correct: 0 },     // ×0 (seen-only)
    { encounters: 3,    correct: 0 },     // ×0
    { encounters: 2,    correct: 0 },     // ×0
  ];

  const shuffled = [...state.deputies].sort(() => Math.random() - 0.5);

  forcedStats.forEach((s, i) => {
    if (i >= shuffled.length) return;
    const d = shuffled[i];
    const wrongCount = s.encounters - s.correct;
    const wrongGroup = GROUP_ORDER.find(g => g !== d.groupe) || 'RN';
    picks[d.id] = {
      encounters: s.encounters,
      correct:    s.correct,
      firstSeen:  Date.now() - rand(60) * 24 * 3600 * 1000,
      picks: {
        [d.groupe]: s.correct,
        ...(wrongCount > 0 ? { [wrongGroup]: wrongCount } : {}),
      },
    };
  });

  // Stats aléatoires pour ~30% des députés restants
  const remaining    = shuffled.slice(forcedStats.length);
  const randomCount  = Math.floor(remaining.length * 0.30);
  for (let i = 0; i < randomCount; i++) {
    const d          = remaining[i];
    const encounters = rand(30) + 1;
    const correct    = rand(encounters + 1);
    const wrongCount = encounters - correct;
    const wrongGroup = GROUP_ORDER.find(g => g !== d.groupe) || 'RN';
    picks[d.id] = {
      encounters,
      correct,
      firstSeen: Date.now() - rand(60) * 24 * 3600 * 1000,
      picks: {
        [d.groupe]: correct,
        ...(wrongCount > 0 ? { [wrongGroup]: wrongCount } : {}),
      },
    };
  }

  localStorage.setItem('deputy_picks', JSON.stringify(picks));
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initStats);
window.initStats = initStats;
