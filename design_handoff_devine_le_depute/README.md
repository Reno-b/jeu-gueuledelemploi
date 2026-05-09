# Handoff — Devine le Député (UI néobrutaliste)

## Overview
Web/mobile-web jeu infini où le joueur voit la photo d'un·e député·e et doit deviner son groupe parlementaire à l'Assemblée Nationale. 3 modes de difficulté (Normal: 12 groupes / Facile: 4 macro-familles / Temps: décompte 10s). Score continu (bonnes / mauvaises / série / record). Hémicycle interactif comme unique surface de réponse — pas de boutons valider ou passer, le clic sur un groupe valide directement.

## About the Design Files
Les fichiers de ce dossier sont des **références de design en HTML** — un prototype interactif, stylé et fonctionnel qui montre le look, la mise en page, les interactions et les animations souhaitées. Ce n'est PAS du code de production à copier tel quel.

L'objectif est de **recréer ce design dans l'environnement existant du codebase cible** (React/Next, Vue/Nuxt, SwiftUI, natif…) en utilisant ses patterns établis. Si aucun environnement n'existe, recommandation : **React + Vite + TypeScript** + CSS avec custom properties.

## Fidelity
**Hi-fi.** Couleurs, typographies, espacements, bordures, ombres, états et animations sont définitifs. Reproduire pixel-pour-pixel par rapport au prototype.

## Files in this bundle
- `Devine le député.html` — shell (CSS tokens, polices, layout, mount React)
- `app.jsx` — composants React (App, Hemicycle, DeputyCard, PortraitPlaceholder, StatCard) + animation rAF + Tweaks
- `tweaks-panel.jsx` — panneau de tweaks designer (NE PAS expédier en prod)

Ouvrir `Devine le député.html` dans un navigateur pour interagir.

---

## Design Tokens

### Couleurs

```css
/* Surfaces */
--ink:       #0a0a0a;
--paper:     #fdf6e3;   /* fond crème par défaut */
--paper-2:   #f5ecc8;   /* surface secondaire */
--white-tri: #ffffff;

/* Accents brand */
--blue:   #2a4dff;
--red:    #ff3b3b;
--pink:   #ff5d8f;
--green:  #38d39f;
--orange: #ff9a3c;
--violet: #b06bff;
--yellow: #ffd23f;

/* Macro-familles (3 zones de l'hémicycle + NI) */
--m-gauche: #e63946;   /* rouge   */
--m-droite: #2a4dff;   /* bleu    */
--m-facho:  #0a0a0a;   /* noir    */
--m-ni:     #8a8a8a;   /* gris    */

/* Groupes parlementaires */
--g-lfi:  #8b3fcf;   /* LFI-NFP — Insoumis (violet) */
--g-gdr:  #d12a2a;   /* GDR — Communiste (rouge) */
--g-ecos: #2da567;   /* EcoS — Écologiste (vert) */
--g-soc:  #ff5d8f;   /* SOC — Socialiste (rose) */
--g-epr:  #ffd23f;   /* EPR — Macroniste (jaune) */
--g-dem:  #ff9a3c;   /* Dem — MoDem (orange) */
--g-hor:  #5cc8f0;   /* HOR — Horizons (bleu ciel) */
--g-liot: #4b3cd1;   /* LIOT — Indépendant (indigo) */
--g-dr:   #1f3a6b;   /* DR — Républicain (bleu marine) */
--g-udr:  #6b3f1f;   /* UDR — Ciottiste (marron) */
--g-rn:   #0a0a0a;   /* RN — Frontiste (noir) */
--g-ni:   #8a8a8a;   /* NI — Non-inscrit (gris) */
```

### Macro → groupes
- **Gauche** (rouge) : `GDR · LFI-NFP · EcoS · SOC` — dans cet ordre, GDR le plus à gauche
- **Droite** (bleu) : `EPR · Dem · HOR · LIOT`
- **Facho** (noir) : `DR · UDR · RN`
- **NI** (gris, hors hémicycle) : non-inscrits

### Surnoms (affichés en gros) + Abréviations (petits)
| Abbr | Surnom | Nom complet |
|---|---|---|
| LFI-NFP | Insoumis | La France Insoumise |
| GDR | Communiste | Gauche Démocrate et Républicaine |
| EcoS | Écologiste | Écologistes |
| SOC | Socialiste | Socialistes |
| EPR | Macroniste | Renaissance / Ensemble Pour la République |
| Dem | MoDem | Démocrates |
| HOR | Horizons | Horizons |
| LIOT | Indépendant | Libertés Indép. Outre-mer |
| DR | Républicain | Droite Républicaine |
| UDR | Ciottiste | Union des Droites |
| RN | Frontiste | Rassemblement National |
| NI | Non-inscrit | Non-inscrits |

### Palettes alternatives (Tweaks — `cream` par défaut)
- mint, pink, electric (citron), graphite — voir `app.jsx` const `PALETTES`

### Typographie
Google Fonts : **Archivo Black**, **Space Grotesk** (400-700), **JetBrains Mono** (500-700).

| Token | Famille | Usage |
|---|---|---|
| Display | Archivo Black | H1, big numbers, labels macro/groupes, boutons |
| Body | Space Grotesk | UI text |
| Mono | JetBrains Mono | timer, abbr, ticker, tags, axes |

H1: `clamp(40px, 6.4vw, 76px)`, line-height 0.92, uppercase, le mot "Député" dans `.accent` rotaté de -1°.

### Bordures & ombres (néobrutalisme — **aucun border-radius** sauf cas spéciaux)
```css
--border:        3px solid var(--ink);
--border-thick:  4px solid var(--ink);
--shadow-sm:     3px 3px 0 0 var(--ink);
--shadow:        6px 6px 0 0 var(--ink);
--shadow-lg:    10px 10px 0 0 var(--ink);
```
Hover sur cards/boutons: translate(-2px,-2px) + ombre passe à 8×8.

Exceptions border-radius : NI center button (forme dôme `100% 100% 0 0`), avatars circulaires d'icônes stat (50%).

### Spacing & layout
- 8px grid
- Container max-width 1180px, padding 36px 28px desktop, 24px 18px mobile
- Stats grid `gap:18px` (12px mobile)
- Layout principal: 1.05fr / 1fr ; collapse 1col ≤880px

### Background patterns
Overlay fixe `body::before`. Variantes `body[data-bg]`:
- `dots` (par défaut) : radial 1px @ 6%, 22×22
- `grid`: lignes 1px @ 8%, 32×32
- `stripes`: gradient 45°, 18px / 1px @ 5%
- `none`

---

## Screens & Components

Une seule vue (le jeu).

### 1. Header
- Drapeau tricolore (3 bandes 16×36 : bleu / blanc / rouge), bordure ink, rotate(-2°), ombre 3×3
- Sous-titre mono ink-fill : `XVIIᵉ Législature · Assemblée Nat.`
- Titre H1 `Devine\nle Député`. Le mot "Député" dans `.accent` (fond bleu, texte paper, rotate(-1°), bordure ink, ombre).
- À droite: timer card jaune (countup) ou orange (countdown) avec dot rouge pulsing 1.2s. Passe en rouge avec `shake` 0.4s infinite si ≤3s en mode Temps. Le label change : `TEMPS` (countup) / `RESTE` (countdown).

### 2. Stats row (4 cards 1fr)
Top : label mono + icône circulaire ink. Big number 56px Archivo Black. Bottom delta 11px mono.
- `good` → vert (`#38d39f`)
- `bad`  → rose (`#ff5d8f`)
- `streak` → orange
- `record` → violet (texte paper)

Hover: lift -2/-2.

### 3. Mode toggle (3 boutons)
`🏛 Normal · 12 GROUPES` / `🎯 Facile · 4 CHOIX` / `⏱ Temps · 10s`
Actif = ink fill / paper text. Badge interne jaune mono.

Changer de mode reset l'état de la question en cours.

### 4. Deputy Card (colonne gauche)
**État avant réponse :**
- Cadre 5px ink, ombre 10×10
- Tag flottant top-left: `DOSSIER N° 247`
- Carré jaune `?` top-right rotaté +8°
- Photo carrée (aspect 1/1.05) avec bordure ink, scan-lines (`repeating-linear-gradient`), 4 corner brackets, photo-tag `DOSSIER · CONFIDENTIEL`
- **Aucune autre information visible** — pas de nom, pas de circonscription, pas de profession.

**État après réponse (révélé) :**
- Banner overlay au bas de la photo (animation `reveal` 350ms : opacity + translateY 8px) :
  - Vert si correct, rouge si faux, paper sinon
  - Nom du député en Archivo Black 18px uppercase
  - Pill avec couleur du vrai groupe : `Surnom · ABBR`
- En dessous, grid 2×2 de chips meta (animation reveal 0.45s 0.1s delay) :
  - Circonscription · Mandats · Profession · Commission

> Le portrait est un placeholder SVG dans le proto. En prod, brancher `deputy.photoUrl`.

### 5. Hemicycle interactif (colonne droite, **surface de réponse principale**)

#### Géométrie
- SVG viewBox 0 0 400 200
- Centre (200, 180), rayon intérieur 60, rayon extérieur 175
- Arc de 180° à 360° (gauche → droite)

#### États
**Idle (aucune famille survolée) :**
- 3 macros de tailles **égales** : 60° chacune
- Fill = couleur macro, label uppercase Archivo Black 18px paper avec stroke ink

**Hover/tap sur une famille :**
- Smooth animation rAF (easeOutCubic, 280ms, géré par `useProgress` hook)
- La famille active grandit de 60° → 180°, les autres rétrécissent à 0°
- Fill macro fade out (opacity decrease)
- Sous-groupes apparaissent en fade-in, **chacun de la même taille angulaire** (180°/N pour la famille active — **NON proportionnel aux sièges**)
- Chaque sous-groupe affiche : surnom (Archivo Black 13px) + abbr (mono 8px en petit dessous) sur le même arc

**Click sur sous-groupe :**
- **Validation immédiate** (pas de bouton Valider)
- Le sous-groupe passe en vert (`#38d39f`) si correct, sinon le sous-groupe cliqué passe en rouge ET le bon sous-groupe passe en vert

**Touch devices (`hover: none`) :**
- Pas de hover. Tap sur famille = expand. Tap sur sous-groupe = pick. Hint : "Touche une famille pour voir les groupes" au lieu de "Survole".

#### Bouton NI au centre
- À la place du podium au bas de l'hémicycle
- Forme dôme (`border-radius: 100% 100% 0 0`)
- Largeur 30% du hemicycle, max 130px, min 92px, aspect 2.4/1
- Fond gris `--m-ni`, bordure ink 4px (sans bordure basse)
- Contenu : `NI` Archivo Black 18px + `Non-inscrit` mono 9px uppercase
- Hover : translate(-3px) Y, ombre 6×6, fond gris plus clair
- Click = pick `NI` (validation immédiate)

#### Axe legend
Sous l'hémicycle : `← Gauche` (pill ink fill) / `Droite →` (pill paper fill).

### 6. Bouton Suivant (apparaît après réponse)
- Fond ink, paper text, Archivo Black 18px uppercase
- Border 4px, ombre 6×6, animation reveal 300ms
- Largeur 100%, padding 16/20
- Click = passe au député suivant (reset picked, answerState, revealed, activeMacro)

### 7. Ticker
Bande ink en bas de page, scroll horizontal infini 40s. Items mono uppercase préfixés d'un dot jaune. Le contenu doit être dupliqué dans la track pour boucler proprement.

---

## Interactions & Behavior

| Trigger | Behavior |
|---|---|
| Hover macro (desktop) | Anime expansion 280ms easeOutCubic, révèle sous-groupes |
| Mouse leave hemicycle | Macros reviennent à l'état idle |
| Tap macro (touch) | Toggle expand de cette macro |
| Click sous-groupe | **Valide immédiatement** : update picked, answerState, revealed, stats |
| Click NI | Idem (mode normal/temps : juste si correctGroup === 'NI') |
| Click macro en mode Easy | Valide immédiatement : correct si la macro contient correctGroup |
| Click "Suivant →" | Charge nouveau député, reset état |
| Change mode | Reset question en cours |
| Timer mode `temps` arrive à 0 | (à implémenter) auto-révéler en wrong, advance après 2s |
| `prefers-reduced-motion` | Désactiver shake, ticker, pulse, et l'animation rAF (snap direct) |

### Animations
- Stat / button hover : 80-120ms ease translate + box-shadow
- Timer dot : `pulse` 1.2s infinite
- Timer critical : `shake` 0.4s infinite + bg rouge
- Hemicycle expand : rAF easeOutCubic 280ms (interpolation de 0→1)
- Sub-groups : opacité ∝ progress (multiplié par 1.2, capé à 1)
- Reveal banner : `reveal` 350ms ease-out (opacity + translateY 8→0)
- Meta chips : `reveal` 450ms 100ms delay
- Next button entrée : `reveal` 300ms

### Responsive
- ≤880px : main 1col, stats 2cols, header column, modes wrap
- ≤480px : modes flex 50% chacun, stats 2cols, deputy-meta 1col

---

## State Management

```ts
type Mode = 'normal' | 'easy' | 'temps';
type AnswerState = 'idle' | 'correct' | 'wrong';
type GroupAbbr =
  | 'LFI-NFP' | 'GDR' | 'EcoS' | 'SOC'
  | 'EPR' | 'Dem' | 'HOR' | 'LIOT'
  | 'DR' | 'UDR' | 'RN' | 'NI';

interface Group {
  abbr: GroupAbbr;
  nick: string;       // ex. "Insoumis"
  name: string;       // ex. "La France Insoumise"
  seats: number;
  color: string;      // CSS var ou hex
}

interface Deputy {
  id: string;
  photoUrl: string;
  firstName: string;
  lastName: string;        // caché tant que !revealed
  group: GroupAbbr;        // ground truth
  circonscription: string;
  region: string;
  mandates: number;
  firstElected: number;
  profession: string;
  commission: string;
  age: number;
  sex: 'F' | 'M';
}

interface SessionState {
  mode: Mode;
  current: Deputy;
  picked: GroupAbbr | 'gauche' | 'droite' | 'facho' | null;
  answerState: AnswerState;
  revealed: boolean;
  activeMacro: 'gauche' | 'droite' | 'facho' | null;
  seconds: number;          // ↑ par défaut, ↓ en mode temps
  stats: {
    good: number;
    bad: number;
    streak: number;
    record: number;         // localStorage / backend
  };
}
```

### Validation logic
```ts
function isCorrect(picked, mode, correctGroup) {
  if (mode === 'easy') {
    if (picked === 'NI') return correctGroup === 'NI';
    const macro = MACROS.find(m => m.id === picked);
    return macro ? macro.subs.includes(correctGroup) : false;
  }
  return picked === correctGroup;
}
```

`record` doit persister (localStorage minimum).

## Data Requirements
- `GET /next-deputy` → renvoie `Deputy` SANS le `group` (ou avec, si on accepte le risque côté client)
- `POST /answer { deputyId, picked }` → `{ correct, correctGroup, deputy: Deputy }` (révèle tout)
- Référentiel groupes (statique, refresh par législature)

## Assets
- Photos député·es (carré 600×600+). Fallback : SVG portrait abstrait (présent dans `app.jsx`).
- App icon / favicon — drapeau tricolore tile

## Accessibilité
- Tab navigation : header → modes → macros (boutons) → NI → next
- Focus ring : 3px paper outline + 3px ink offset sur `:focus-visible`
- Sous-groupes invisibles tant que macro non-active : exposer toute la liste comme `<ul>` SR-only en parallèle
- Couleur jamais seule : correct/wrong combinent shake + texte "Bien joué !" / "Raté…" dans le panel-title
- `prefers-reduced-motion` : désactiver shake, ticker, pulse, animation rAF (snap)
- aria-label sur sous-groupes : `Groupe {nom complet}`
- aria-live region pour annoncer le résultat

## Out of scope
- Auth & profils
- Leaderboards
- Logique réelle de timer Temps qui force la réponse à 0s
- Dataset complet de députés
- i18n (FR-only)
- Tweaks panel (designer-only, ne pas livrer)
