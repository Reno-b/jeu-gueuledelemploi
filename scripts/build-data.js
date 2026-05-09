#!/usr/bin/env node
/**
 * Génère public/deputies.json à partir du CSV de l'Assemblée Nationale.
 * Utilisé par GitHub Actions (déploiement automatique hebdomadaire).
 * Peut aussi être lancé manuellement : node scripts/build-data.js
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CSV_URL = 'https://data.assemblee-nationale.fr/static/openData/repository/17/amo/deputes_actifs_csv_opendata/liste_deputes_libre_office.csv';

const GROUPS_CONFIG = {
  'LFI-NFP':  { nom: 'La France Insoumise – Nouveau Front Populaire',       couleur: '#8b3fcf' },
  'GDR':      { nom: 'Gauche Démocrate et Républicaine',                    couleur: '#d12a2a' },
  'EcoS':     { nom: 'Écologiste et Social',                                couleur: '#2da567' },
  'SOC':      { nom: 'Socialistes et Apparentés',                           couleur: '#ff5d8f' },
  'EPR':      { nom: 'Ensemble pour la République',                         couleur: '#ffd23f' },
  'Dem':      { nom: 'Démocrates (MoDem)',                                  couleur: '#ff9a3c' },
  'HOR':      { nom: 'Horizons & Indépendants',                             couleur: '#5cc8f0' },
  'LIOT':     { nom: 'Libertés, Indépendants, Outre-Mer et Territoires',    couleur: '#4b3cd1' },
  'DR':       { nom: 'Droite Républicaine',                                 couleur: '#1f3a6b' },
  'UDR':      { nom: 'Union des Droites pour la République',                couleur: '#6b3f1f' },
  'RN':       { nom: 'Rassemblement National',                              couleur: '#0a0a0a' },
  'NI':       { nom: 'Non-inscrits',                                        couleur: '#8a8a8a' },
};

function httpsGet(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'DeputeGame/1.0', 'Accept-Charset': 'utf-8' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        return httpsGet(res.headers.location, redirects - 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseCSV(buffer) {
  let text = buffer.toString('utf-8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const values = [];
    let i = 0;
    while (i <= line.length) {
      if (i === line.length) { values.push(''); break; }
      if (line[i] === '"') {
        i++;
        let val = '';
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') { val += '"'; i += 2; }
            else { i++; break; }
          } else { val += line[i++]; }
        }
        values.push(val.trim());
        if (line[i] === ',') i++;
      } else {
        let val = '';
        while (i < line.length && line[i] !== ',') val += line[i++];
        values.push(val.trim());
        if (line[i] === ',') i++;
      }
    }
    return values;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

async function main() {
  console.log('Téléchargement du CSV depuis l\'Assemblée Nationale…');
  const buf  = await httpsGet(CSV_URL);
  const rows = parseCSV(buf);

  if (rows.length === 0) throw new Error('CSV vide ou mal parsé');
  console.log(`  ${rows.length} lignes lues.`);

  const deputies = rows
    .filter(r => r['identifiant'] && r['Nom'] && r['Groupe politique (abrégé)'])
    .map(r => ({
      id:         r['identifiant'].trim(),
      prenom:     r['Prénom'].trim(),
      nom:        r['Nom'].trim(),
      groupe:     r['Groupe politique (abrégé)'].trim(),
      groupeNom:  r['Groupe politique (complet)'].trim(),
      dept:       r['Département'].trim(),
      region:     r['Région'].trim(),
      numCirco:   r['Numéro de circonscription'].trim(),
      profession: r['Profession'].trim(),
    }));

  const groups = {};
  deputies.forEach(d => {
    if (!groups[d.groupe]) {
      const cfg = GROUPS_CONFIG[d.groupe] || {};
      groups[d.groupe] = {
        sigle:   d.groupe,
        nom:     cfg.nom || d.groupeNom,
        couleur: cfg.couleur || '#555',
        count:   0,
      };
    }
    groups[d.groupe].count++;
  });

  const outPath = path.join(__dirname, '..', 'public', 'deputies.json');
  fs.writeFileSync(outPath, JSON.stringify({ deputies, groups }), 'utf-8');
  console.log(`✓ ${deputies.length} députés écrits dans public/deputies.json`);
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
