# Eames — Motifs SVG animés

Projet front simple (HTML/CSS/JS vanilla) pour générer une composition de motifs inspirés Eames, avec animations séquencées et variations de couleurs.

## Aperçu

- 6 motifs SVG (`motif-1` à `motif-6`)
- génération aléatoire sur une grille
- mode « single view » via le sélecteur
- animations par étapes (croissance → plateau → collapse/fade)
- gestion d’origines (`transform-origin`) par élément pour un rendu organique
- palette de couleurs appliquée par clone avec fréquence pondérée

## Structure

- `eames.html` :
  - templates des motifs SVG inline
  - logique JS de génération, séquences d’animation, randomisation
- `eames.css` :
  - layout global
  - keyframes et overrides par motif
  - classes de couleurs
- `eames_01.svg` … `eames_06.svg` : sources SVG
- `458300_repeat.svg` : ressource annexe

## Fonctionnement principal

### 1) Génération des clones

Dans `eames.html`, `generateRandomMotifs()` crée des clones à partir des templates inline.
Chaque clone passe par `applyCloneBaseStyle()` :

- délai d’apparition (`--bloom-delay`)
- durée flottante (`--float-duration`)
- offsets aléatoires
- mirroring (selon motif)
- couleur aléatoire pondérée

### 2) Séquences par motif

Fonctions dédiées :

- `applyMotif1Sequence()`
- `applyMotif2Sequence()`
- `applyMotif6Sequence()`

Elles assignent les `animationDelay` de chaque élément (`disc*`, `branch*`) pour obtenir l’ordre visuel souhaité.

### 3) Synchronisation cyclique

La durée globale est centralisée via `--cycle-duration` (dans `:root`, `eames.css`).
Le JS lit cette valeur (`getCycleDurationSeconds()`) pour garder CSS et JS alignés.

### 4) Couleurs

Les paths SVG utilisent `currentColor` via :

- `.motif.color svg path { fill: currentColor; }`

Les classes de couleur sont dans `eames.css` (`.color.blue`, `.color.pink`, etc.)
et la fréquence de tirage est dans `eames.html` (`colorFrequencies`).

## Lancer le projet

Aucune build nécessaire.

1. Ouvrir `eames.html` dans un navigateur.
2. Utiliser le sélecteur en haut à droite :
   - `Tous les motifs` pour la génération complète
   - un motif spécifique pour le mode focus

## Personnalisation rapide

- Vitesse globale : modifier `--cycle-duration` dans `eames.css`
- Densité/nb de motifs : modifier `N` dans `eames.html`
- Fréquence des motifs : ajuster `data-frequency` dans chaque bloc `.motif`
- Fréquence des couleurs : ajuster `colorFrequencies` dans `eames.html`
- Origines d’animation : ajuster les variables `--m*-*-origin` dans `eames.css`

## Notes

- Motifs 1, 2 et 6 disposent de séquences avancées (branches/disques séparés).
- Les comportements de collapse sont factorisés via `.assembly-collapse`.
- Si un motif est modifié côté SVG source, réimporter le bloc inline correspondant dans `eames.html` puis recalibrer ses origines dans `eames.css`.
