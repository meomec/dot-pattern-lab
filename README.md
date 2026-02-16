# Dot Pattern — Motifs SVG animés

Projet front statique (HTML/CSS/JS vanilla) pour générer un champ de motifs inspirés du Dot pattern de Charles Eames, avec séquences d’animation par élément, placement contraint et configuration par URL.

## Aperçu

- 6 motifs SVG segmentés
- animations séquencées par branches/disques selon le motif
- génération multi-clones avec placement type Poisson-disc contraint
- contraintes d’adjacence : éviter voisins de même motif et/ou même couleur
- quotas globaux respectant les fréquences de motifs et de couleurs
- mode focus via le sélecteur (`single view`)

## Fichiers

- `eames.html`
  - templates SVG inline
  - logique de génération (plan de clones, quotas, placement)
  - séquences d’animation JS (`applyMotif1Sequence` … `applyMotif6Sequence`)
- `eames.css`
  - layout global
  - keyframes
  - overrides par motif (`.motif-type-*`)
  - palette couleurs (`currentColor`)
- `eames_01.svg` … `eames_06.svg`
  - sources SVG de découpe

## Lancer

1. Ouvrir `eames.html` dans un navigateur.
2. Utiliser le sélecteur en haut à droite :
   - `Tous les motifs` : génération complète
   - `Motif X` : affichage focus

## Paramètres URL (query params)

Configuration runtime directement via l’URL.

- `n` : nombre max de clones (entier positif)
  - exemple : `?n=140`
- `gridScale` (alias `scale`) : facteur d’échelle des clones
  - borne runtime : `0.05` à `1.2`
  - exemple : `?gridScale=0.22`
- `colorMode` (aliases `color`, `couleur`) : mode de couleur
  - `color` (défaut) : palette pondérée complète
  - `noir` / `black` : noir uniquement
  - exemple : `?colorMode=noir`
- `debug` : mode debug placement
  - valeurs acceptées : `1|true|yes|on` / `0|false|no|off`
  - exemple : `?debug=1`

Exemple combiné :

`?n=120&gridScale=0.2&colorMode=color&debug=1`

## Génération des clones

Pipeline principal dans `eames.html` :

1. **Calcul du nombre cible** selon viewport et `gridScale`.
2. **Construction d’un plan** (`motifIndex`, `colorClass`) avec :
   - quotas pondérés (fréquences globales),
   - contraintes d’adjacence locale (gauche/haut).
3. **Instantiation des clones** et application du style de base (`applyCloneBaseStyle`).
4. **Placement Poisson-disc contraint** (`placeClonesPoissonConstrained`) pour limiter les recouvrements.
5. **Programmation des resets de cycle** via scheduler global.

## Animation

- Durée globale : `--cycle-duration` dans `eames.css`.
- Chaque motif a sa séquence JS dédiée (`applyMotifXSequence`).
- Les collapses de structure sont factorisés via `.assembly-collapse`.
- Les couleurs sont appliquées via `currentColor` sur les `path` SVG.

## Ajustements fréquents

- Fréquences motifs : `data-frequency` sur les blocs `.motif` dans `eames.html`.
- Fréquences couleurs : `colorFrequencies` dans `eames.html`.
- Origines d’animation : variables `--m*-*-origin` dans `eames.css`.
- Ordres de croissance : fonctions `applyMotifXSequence` dans `eames.html`.

## Maintenance

Quand un SVG est redécoupé :

1. Remplacer le bloc inline correspondant dans `eames.html`.
2. Vérifier IDs (`branch*`, `disc*`, groupes `tree` / `m*-assembly`).
3. Recaler les `transform-origin` dans `eames.css`.
4. Ajuster la séquence JS du motif si nécessaire.
