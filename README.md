# 🎨 Dot Pattern — Animated SVG Garden

Mini projet front en HTML/CSS/JS vanilla pour générer un champ de motifs inspiré du Dot Pattern de Charles Eames.

Ambiance actuelle : placement intelligent, animation séquencée, contraintes d’adjacence, et configuration complète par URL ⚡️

## ✨ Ce que fait le projet

- 6 motifs SVG segmentés et animés
- séquences de croissance dédiées par motif (`applyMotif1Sequence` → `applyMotif6Sequence`)
- génération multi-clones avec placement contraint de type Poisson
- évite les voisins trop proches de même motif
- évite les voisins de même couleur **sauf noir** (le noir peut être côte à côte)
- fréquences pondérées respectées (motifs + couleurs)
- mode focus (single motif) via le sélecteur

## 🗂️ Structure

- `eames.html`
  - structure de page + templates de motifs inline
  - hook vers `eames.js`
- `eames.css`
  - layout, keyframes, couleurs, origins, overrides par motif
- `eames.js`
  - génération des clones
  - scheduler global de reset
  - quotas / contraintes / placement
  - parsing des paramètres URL
- `svg/eames_00.svg` → `svg/eames_06.svg`
  - sources SVG externes de référence

## 🚀 Lancement

1. Ouvrir `eames.html` dans un navigateur.
2. Utiliser le sélecteur en haut à droite (`Tous les motifs` / `Motif X`).
3. Ajuster les paramètres via l’URL pour piloter le rendu.

## 🔧 Paramètres URL

Tous les réglages sont runtime via query params.

### `n`

- `n=0` → mode auto
- `n>0` → **override strict** du nombre de clones
- si absent/invalide → mode auto

### `densite` (alias `density`)

- borne : `0` à `1.2`
- défaut : `0`
- `densite=0` + `n=0` → mode auto **optimisé** (remplissage max sans chevauchement forcé)
- `densite>0` + `n=0` → auto piloté par densité

### `scale` (alias legacy `gridScale`)

- borne : `0.05` à `1.2`
- ajuste la taille des clones

### `color` (aliases legacy `colorMode`, `couleur`)

- `color` (défaut) : palette pondérée complète
- `black` / `noir` : noir uniquement

### `controls`

- affiche/masque le panneau de contrôle
- booléens acceptés : `1|true|yes|on` / `0|false|no|off`

### `debug`

- active le debug visuel de placement
- booléens acceptés : `1|true|yes|on` / `0|false|no|off`

## 🧪 Exemples prêts à copier

- Auto optimisé : `?n=0&densite=0&scale=0.25`
- Auto piloté : `?n=0&densite=0.3&scale=0.3`
- Forcé à 140 clones : `?n=140&scale=0.22&color=color`
- Noir uniquement + contrôles visibles : `?color=noir&controls=1`

## 🧠 Logique de génération (résumé)

1. Calcul du nombre cible (`getBalancedCloneCount`) selon viewport, scale, densité, mode auto/forcé.
2. Construction d’un plan de clones (quotas pondérés + exclusion locale gauche/haut).
3. Application du style de base (`applyCloneBaseStyle`) et des séquences d’animation.
4. Placement contraint (`placeClonesPoissonConstrained`) avec règles anti-chevauchement.
5. Reset cyclique via scheduler global pour garder les animations synchronisées.

## 🛠️ Notes de tuning rapide

- Plus de motifs visibles : augmenter `densite` (si `n=0`) ou fixer `n`.
- Moins de collisions : baisser `densite` ou `scale`.
- Composition plus sobre : `color=noir`.

---

Have fun 🌈🫧


https://meomec.github.io/Dot_pattern/eames.html?scale=0.75
