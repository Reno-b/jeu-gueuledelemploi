/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio */

const { useState, useEffect, useMemo, useRef } = React;

const GROUPS_RAW = JSON.parse(document.getElementById('groups-data').textContent);
const GROUPS = Object.fromEntries(GROUPS_RAW.map(g => [g.abbr, g]));

const MACROS = [
  { id: 'gauche', label: 'Gauche', color: 'var(--m-gauche)', subs: ['GDR', 'LFI-NFP', 'EcoS', 'SOC'] },
  { id: 'droite', label: 'Droite', color: 'var(--m-droite)', subs: ['EPR', 'Dem', 'HOR', 'LIOT'] },
  { id: 'facho',  label: 'Facho',  color: 'var(--m-facho)',  subs: ['DR', 'UDR', 'RN'] },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "cream",
  "background": "dots",
  "answerState": "live"
}/*EDITMODE-END*/;

const PALETTES = {
  cream:    { paper: "#fdf6e3", paper2: "#f5ecc8", ink: "#0a0a0a", accent: "#2a4dff" },
  mint:     { paper: "#e8f7ee", paper2: "#cdedda", ink: "#0a0a0a", accent: "#ff3b3b" },
  pink:     { paper: "#ffe7ee", paper2: "#ffcfdc", ink: "#0a0a0a", accent: "#2a4dff" },
  electric: { paper: "#fefcd0", paper2: "#fff7a3", ink: "#0a0a0a", accent: "#ff3b3b" },
  graphite: { paper: "#1c1c1c", paper2: "#262626", ink: "#fdf6e3", accent: "#ffd23f" },
};

/* --------------------------------------------------------------- */
function PortraitPlaceholder({ revealed }) {
  return (
    <svg viewBox="0 0 320 340" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#0a0a0a" strokeOpacity="0.18" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="320" height="340" fill={revealed ? "#cfe7ff" : "#dbe8d6"} />
      <rect width="320" height="340" fill="url(#hatch)" />
      <path d="M 30 340 Q 30 240 160 230 Q 290 240 290 340 Z" fill="#2a4dff" stroke="#0a0a0a" strokeWidth="4" />
      <path d="M 110 270 L 160 295 L 210 270 L 210 340 L 110 340 Z" fill="#fdf6e3" stroke="#0a0a0a" strokeWidth="4" />
      <rect x="140" y="200" width="40" height="50" fill="#f0c8a0" stroke="#0a0a0a" strokeWidth="4" />
      <ellipse cx="160" cy="155" rx="78" ry="92" fill="#f4d2ad" stroke="#0a0a0a" strokeWidth="4" />
      <path d="M 82 130 Q 80 60 160 55 Q 240 60 238 130 Q 240 110 220 105 Q 200 90 160 92 Q 120 90 100 105 Q 80 110 82 130 Z" fill="#3a2418" stroke="#0a0a0a" strokeWidth="4" />
      <ellipse cx="132" cy="155" rx="8" ry="5" fill="#0a0a0a" />
      <ellipse cx="188" cy="155" rx="8" ry="5" fill="#0a0a0a" />
      <rect x="118" y="138" width="28" height="4" fill="#0a0a0a" />
      <rect x="174" y="138" width="28" height="4" fill="#0a0a0a" />
      <path d="M 160 165 L 152 195 L 168 195 Z" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 142 215 Q 160 224 178 215" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------------------------------------- */
const CX = 200, CY = 180, R_OUT = 175, R_IN = 60;

function polar(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}
function arcPath(a0, a1, r0, r1) {
  if (a1 - a0 < 0.01) return '';
  const [x0, y0] = polar(a0, r1);
  const [x1, y1] = polar(a1, r1);
  const [x2, y2] = polar(a1, r0);
  const [x3, y3] = polar(a0, r0);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`;
}

/* Smoothly animate progress from 0→1 (or 1→0) based on hover */
function useProgress(active, dur = 280) {
  const [p, setP] = useState(0);
  const target = active ? 1 : 0;
  const ref = useRef({ p: 0, target, raf: null, start: null });

  useEffect(() => {
    ref.current.target = target;
    ref.current.start = null;
    cancelAnimationFrame(ref.current.raf);
    const startVal = ref.current.p;
    const tgt = target;
    const tick = (ts) => {
      if (!ref.current.start) ref.current.start = ts;
      const t = Math.min(1, (ts - ref.current.start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const cur = startVal + (tgt - startVal) * eased;
      ref.current.p = cur;
      setP(cur);
      if (t < 1) ref.current.raf = requestAnimationFrame(tick);
    };
    ref.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current.raf);
  }, [target, dur]);

  return p;
}

/* --------------------------------------------------------------- */
function Hemicycle({ activeMacro, setActiveMacro, picked, onPick, locked, correctGroup, isTouch }) {
  const progress = useProgress(!!activeMacro);

  // Compute angle widths smoothly: each starts at 60°, active grows to 180°, others shrink to 0°
  const widths = useMemo(() => {
    const ids = ['gauche', 'droite', 'facho'];
    const out = {};
    if (!activeMacro) {
      ids.forEach(id => { out[id] = 60; });
      return out;
    }
    ids.forEach(id => {
      if (id === activeMacro) out[id] = 60 + 120 * progress;
      else out[id] = 60 * (1 - progress);
    });
    return out;
  }, [activeMacro, progress]);

  // Arrange angles
  const macroSpans = useMemo(() => {
    let acc = 180;
    const out = {};
    ['gauche', 'droite', 'facho'].forEach(id => {
      out[id] = [acc, acc + widths[id]];
      acc += widths[id];
    });
    return out;
  }, [widths]);

  function getSubSpans(macroId) {
    const span = macroSpans[macroId];
    if (!span || span[1] - span[0] < 0.5) return [];
    const subs = MACROS.find(m => m.id === macroId).subs;
    const w = (span[1] - span[0]) / subs.length; // EQUAL size
    return subs.map((abbr, i) => ({
      abbr,
      a0: span[0] + i * w,
      a1: span[0] + (i + 1) * w,
      group: GROUPS[abbr],
    }));
  }

  function handleMacroEnter(id) {
    if (locked || isTouch) return;
    setActiveMacro(id);
  }
  function handleMacroLeave() {
    if (locked || isTouch) return;
    setActiveMacro(null);
  }
  function handleMacroClick(id) {
    if (locked) return;
    if (isTouch) {
      setActiveMacro(prev => prev === id ? null : id);
    }
  }
  function handleSubClick(abbr) {
    if (locked) return;
    onPick(abbr);
  }

  return (
    <div
      className="hemicycle-wrap"
      onMouseLeave={handleMacroLeave}
    >
      <svg viewBox="0 0 400 200">
        {/* outer ring background */}
        <path d={arcPath(180, 360, R_IN - 4, R_OUT + 4)} fill="#0a0a0a" />
        <path d={arcPath(180, 360, R_IN, R_OUT)} fill="var(--paper)" />

        {MACROS.map(m => {
          const span = macroSpans[m.id];
          if (!span || span[1] - span[0] < 0.3) return null;
          const macroOpacity = m.id === activeMacro ? Math.max(0, 1 - progress * 1.4) : 1;
          const subOpacity = m.id === activeMacro ? Math.min(1, progress * 1.2) : 0;
          const showSubs = m.id === activeMacro && progress > 0.05;
          const subs = showSubs ? getSubSpans(m.id) : [];

          return (
            <g
              key={m.id}
              className={`macro macro-${m.id}`}
              onMouseEnter={() => handleMacroEnter(m.id)}
              onClick={() => handleMacroClick(m.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* macro fill */}
              <path
                d={arcPath(span[0] + 1, span[1] - 1, R_IN + 3, R_OUT - 3)}
                fill={m.color}
                stroke="#0a0a0a"
                strokeWidth="3"
                style={{ opacity: macroOpacity, transition: 'opacity 0.2s' }}
              />
              {/* macro label (only when not expanded) */}
              {macroOpacity > 0.05 && (() => {
                const mid = (span[0] + span[1]) / 2;
                const [lx, ly] = polar(mid, (R_IN + R_OUT) / 2);
                const rot = mid - 270;
                return (
                  <text
                    x={lx} y={ly}
                    fill="var(--paper)"
                    fontFamily="Archivo Black, sans-serif"
                    fontSize="18"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${rot} ${lx} ${ly})`}
                    style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: 3, pointerEvents: 'none', textTransform: 'uppercase', opacity: macroOpacity, transition: 'opacity 0.2s' }}
                  >
                    {m.label}
                  </text>
                );
              })()}

              {/* sub-groups (only when expanded) */}
              {subs.map(s => {
                const isCorrect = locked && correctGroup === s.abbr;
                const isWrongPick = locked && picked === s.abbr && correctGroup !== s.abbr;
                const fill = isCorrect ? '#38d39f' : isWrongPick ? '#ff3b3b' : s.group.color;
                return (
                  <g key={s.abbr} className="sub-group" style={{ opacity: subOpacity }}>
                    <path
                      d={arcPath(s.a0 + 0.5, s.a1 - 0.5, R_IN + 3, R_OUT - 3)}
                      fill={fill}
                      stroke="#0a0a0a"
                      strokeWidth="2.5"
                      onClick={(e) => { e.stopPropagation(); handleSubClick(s.abbr); }}
                      style={{ cursor: 'pointer' }}
                    />
                    {(() => {
                      const mid = (s.a0 + s.a1) / 2;
                      const rMid = (R_IN + R_OUT) / 2;
                      const [lx, ly] = polar(mid, rMid + 6);
                      const [lx2, ly2] = polar(mid, rMid - 14);
                      const rot = mid - 270;
                      const isLightFill = ['EPR', 'HOR'].includes(s.abbr);
                      const textColor = isLightFill ? '#0a0a0a' : 'var(--paper)';
                      const strokeColor = isLightFill ? 'var(--paper)' : '#0a0a0a';
                      return (
                        <g>
                          <text
                            x={lx} y={ly}
                            fill={textColor}
                            fontFamily="Archivo Black, sans-serif"
                            fontSize="13"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${rot} ${lx} ${ly})`}
                            style={{ paintOrder: 'stroke', stroke: strokeColor, strokeWidth: 2.5, pointerEvents: 'none' }}
                          >
                            {s.group.nick}
                          </text>
                          <text
                            x={lx2} y={ly2}
                            fill={textColor}
                            fontFamily="JetBrains Mono, monospace"
                            fontSize="8"
                            fontWeight="700"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${rot} ${lx2} ${ly2})`}
                            style={{ pointerEvents: 'none', opacity: 0.85, letterSpacing: '0.08em' }}
                          >
                            {s.abbr}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* NI button at center */}
      <button
        className={`ni-center-btn ${picked === 'NI' && locked && correctGroup === 'NI' ? 'correct' : ''} ${picked === 'NI' && locked && correctGroup !== 'NI' ? 'wrong' : ''}`}
        onClick={() => !locked && onPick('NI')}
        disabled={locked}
      >
        <span className="ni-label">NI</span>
        <span className="ni-sub">Non-inscrit</span>
      </button>

      {!activeMacro && !locked && (
        <div className="hover-hint">{isTouch ? 'Touche une famille pour voir les groupes' : 'Survole une famille pour voir les groupes'}</div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- */
function DeputyCard({ revealed, correctGroup, picked, answerState }) {
  return (
    <div className="deputy-card">
      <div className="photo-wrap">
        <PortraitPlaceholder revealed={revealed} />
        <div className="scan-lines"></div>
        <div className="corner tl"></div>
        <div className="corner tr"></div>
        <div className="corner bl"></div>
        <div className="corner br"></div>
        {!revealed && (
          <div className="photo-tag">DOSSIER · CONFIDENTIEL</div>
        )}
        {revealed && (
          <div className="reveal-banner" data-tone={answerState}>
            <div className="reveal-name">CHRISTELLE D.</div>
            <div className="reveal-group" style={{ background: GROUPS[correctGroup].color }}>
              {GROUPS[correctGroup].nick} · {GROUPS[correctGroup].abbr}
            </div>
          </div>
        )}
      </div>

      {revealed && (
        <div className="deputy-meta">
          <div className="meta-chip">
            Circonscription
            <strong>Hauts-de-Seine · 7ᵉ</strong>
          </div>
          <div className="meta-chip">
            Mandats
            <strong>2 · depuis 2017</strong>
          </div>
          <div className="meta-chip">
            Profession
            <strong>Avocate</strong>
          </div>
          <div className="meta-chip">
            Commission
            <strong>Lois</strong>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [mode, setMode] = useState('normal'); // normal | easy | temps
  const [picked, setPicked] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [activeMacro, setActiveMacro] = useState(null);
  const [stats, setStats] = useState({ good: 0, bad: 0, streak: 0, record: 0 });
  const [revealed, setRevealed] = useState(false);
  const [answerState, setAnswerState] = useState('idle'); // 'idle' | 'correct' | 'wrong'

  const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches;

  // Apply palette
  useEffect(() => {
    const p = PALETTES[t.palette] || PALETTES.cream;
    const root = document.documentElement;
    root.style.setProperty('--paper', p.paper);
    root.style.setProperty('--paper-2', p.paper2);
    root.style.setProperty('--ink', p.ink);
    root.style.setProperty('--blue', p.accent);
    document.body.dataset.bg = t.background;
  }, [t.palette, t.background]);

  // Tweaks override for previewing
  useEffect(() => {
    if (t.answerState === 'correct') { setRevealed(true); setAnswerState('correct'); setPicked('EPR'); }
    else if (t.answerState === 'wrong') { setRevealed(true); setAnswerState('wrong'); setPicked('SOC'); }
    // 'live' leaves the actual state alone
  }, [t.answerState]);

  // Timer
  useEffect(() => {
    if (revealed) return;
    if (mode === 'temps') {
      setSeconds(10);
      const id = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
      return () => clearInterval(id);
    } else {
      setSeconds(0);
      const id = setInterval(() => setSeconds(s => s + 1), 1000);
      return () => clearInterval(id);
    }
  }, [mode, revealed]);

  const correctGroup = 'EPR'; // demo answer

  function handlePick(abbr) {
    if (revealed) return;
    let pickIsCorrect = false;
    if (mode === 'easy') {
      // In easy mode, picking a macro wins if it contains the correct group
      const macro = MACROS.find(m => m.id === abbr);
      if (macro) {
        pickIsCorrect = macro.subs.includes(correctGroup);
      } else if (abbr === 'NI') {
        pickIsCorrect = correctGroup === 'NI';
      }
    } else {
      pickIsCorrect = abbr === correctGroup;
    }
    setPicked(abbr);
    setAnswerState(pickIsCorrect ? 'correct' : 'wrong');
    setRevealed(true);
    setStats(s => {
      const newGood = pickIsCorrect ? s.good + 1 : s.good;
      const newBad = pickIsCorrect ? s.bad : s.bad + 1;
      const newStreak = pickIsCorrect ? s.streak + 1 : 0;
      const newRecord = Math.max(s.record, newStreak);
      return { good: newGood, bad: newBad, streak: newStreak, record: newRecord };
    });
  }

  function nextQuestion() {
    setPicked(null);
    setAnswerState('idle');
    setRevealed(false);
    setActiveMacro(null);
    if (t.answerState !== 'live') setTweak('answerState', 'live');
  }

  const fmt = (n) => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const timerLabel = mode === 'temps' ? 'RESTE' : 'TEMPS';
  const timerCritical = mode === 'temps' && seconds <= 3 && !revealed;

  return (
    <div className="app">
      {/* HEADER */}
      <div className="header">
        <div>
          <div className="brand-mark">
            <div className="tri" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div className="subtitle">XVII<sup>e</sup> Législature · Assemblée Nat.</div>
          </div>
          <div className="title-block">
            <h1>
              Devine<br/>le <span className="accent">Député</span>
            </h1>
          </div>
        </div>
        <div className="header-right">
          <div className={`timer-card ${timerCritical ? 'critical' : ''} ${mode==='temps' ? 'countdown' : 'countup'}`}>
            <span className="timer-dot"></span>
            {fmt(seconds)} {timerLabel}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <StatCard tone="good" icon="✓" label="Bonnes" value={stats.good} delta={answerState==='correct' ? '+1 ce tour' : '—'} />
        <StatCard tone="bad" icon="✗" label="Mauvaises" value={stats.bad} delta={answerState==='wrong' ? '+1 ce tour' : '—'} />
        <StatCard tone="streak" icon="★" label="Série" value={stats.streak} delta={stats.streak > 0 ? 'en cours' : '—'} />
        <StatCard tone="record" icon="♦" label="Record" value={stats.record} delta="meilleur" />
      </div>

      {/* MODE TOGGLE */}
      <div className="modes">
        <span className="mode-label">Difficulté :</span>
        <button className={`mode-btn ${mode==='normal'?'active':''}`} onClick={() => { setMode('normal'); nextQuestion(); }}>
          🏛 Normal <span className="badge">12 GROUPES</span>
        </button>
        <button className={`mode-btn ${mode==='easy'?'active':''}`} onClick={() => { setMode('easy'); nextQuestion(); }}>
          🎯 Facile <span className="badge">4 CHOIX</span>
        </button>
        <button className={`mode-btn ${mode==='temps'?'active':''}`} onClick={() => { setMode('temps'); nextQuestion(); }}>
          ⏱ Temps <span className="badge">10s</span>
        </button>
      </div>

      {/* MAIN GRID */}
      <div className="main">
        <DeputyCard revealed={revealed} correctGroup={correctGroup} picked={picked} answerState={answerState} />

        <div className="right-col">
          <div className="panel">
            <h3 className="panel-title">
              <span className="num-tag">?</span>
              {revealed
                ? (answerState === 'correct' ? 'Bien joué !' : 'Raté…')
                : 'Quel est le groupe parlementaire ?'}
            </h3>

            <Hemicycle
              activeMacro={activeMacro}
              setActiveMacro={setActiveMacro}
              picked={picked}
              onPick={handlePick}
              locked={revealed}
              correctGroup={correctGroup}
              isTouch={isTouch}
            />

            <div className="axis-row">
              <span className="pill">← Gauche</span>
              <span className="pill" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>Droite →</span>
            </div>

            {revealed && (
              <button className="next-btn" onClick={nextQuestion}>
                Suivant →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker">
        <div className="ticker-track">
          <span><span className="dot"></span> 577 députés siègent à l'Assemblée Nationale</span>
          <span><span className="dot"></span> Astuce · {isTouch ? 'tape' : 'survole'} une famille pour voir les groupes</span>
          <span><span className="dot"></span> Mode Temps · 10 secondes par député</span>
          <span><span className="dot"></span> Le jeu est infini — joue jusqu'à battre ton record</span>
          <span><span className="dot"></span> 577 députés siègent à l'Assemblée Nationale</span>
          <span><span className="dot"></span> Astuce · {isTouch ? 'tape' : 'survole'} une famille pour voir les groupes</span>
        </div>
      </div>

      {/* TWEAKS PANEL */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Palette">
          <TweakRadio
            label="Style"
            value={t.palette}
            onChange={v => setTweak('palette', v)}
            options={[
              { value: 'cream', label: 'Crème' },
              { value: 'mint', label: 'Menthe' },
              { value: 'pink', label: 'Rose' },
              { value: 'electric', label: 'Citron' },
              { value: 'graphite', label: 'Graphite' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Fond">
          <TweakRadio
            label="Texture"
            value={t.background}
            onChange={v => setTweak('background', v)}
            options={[
              { value: 'dots', label: 'Dots' },
              { value: 'grid', label: 'Grille' },
              { value: 'stripes', label: 'Rayures' },
              { value: 'none', label: 'Aucun' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Aperçu réponse">
          <TweakRadio
            label="État"
            value={t.answerState}
            onChange={v => setTweak('answerState', v)}
            options={[
              { value: 'live', label: 'Jeu' },
              { value: 'correct', label: 'Correct' },
              { value: 'wrong', label: 'Faux' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function StatCard({ tone, icon, label, value, delta }) {
  return (
    <div className="stat-card" data-tone={tone}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="icon">{icon}</span>
      </div>
      <div className="num">{value}</div>
      <div className="delta">{delta}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
