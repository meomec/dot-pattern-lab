# 🎨 Dot Pattern — Animated SVG Garden

Mini projet front en HTML/CSS/JS vanilla pour générer un champ de motifs inspiré du Dot Pattern de Charles Eames.

Ambiance actuelle : placement intelligent, animation séquencée, contraintes d’adjacence, et configuration complète par URL ⚡️

## ✨ Ce que fait le projet

- 6 motifs SVG segmentés et animés
- séquences de croissance dédiées par motif
- génération multi-clones avec placement contraint de type Poisson
- évite les voisins trop proches de même motif
- évite les voisins de même couleur **sauf noir** (contrainte renforcée en proximité)
- fréquences pondérées respectées (motifs + couleurs)
- rotation aléatoire pondérée des clones : `0°` (80%), `+90°` (10%), `-90°` (10%)
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
- `sw.js`
  - service worker pour cache hors ligne et fallback de navigation
- `offline.html`
  - page de secours affichée si une navigation échoue sans réseau
- `svg/eames_00.svg` → `svg/eames_06.svg`
  - sources SVG externes de référence

## 🚀 Lancement

1. Ouvrir `eames.html` dans un navigateur.
2. Ajuster les paramètres via le panneau de contrôle (application automatique) ou via l’URL.

Pour les fonctions PWA et le mode hors connexion, il faut servir le dossier en HTTP(S) local ou distant.

Exemple simple en local :

```bash
python3 -m http.server 8000
```

Puis ouvrir :

```text
http://localhost:8000/eames.html
```

## 🎛️ Panneau de contrôle

Le panneau intègre les mêmes options que les query params :

- `N` (nombre de clones)
- `Échelle` (`taille des motifs`)
- `Densite` (`marge entre les motifs`)
- `Mode` (`couleur` / `n&b`)
- `Debug`

Chaque changement est appliqué automatiquement (pas de bouton “Appliquer”).

## 🔧 Paramètres URL

Tous les réglages sont runtime via query params.

### `n`

- `n=0` → mode auto
- `n>0` → **override strict** du nombre de clones
- si absent/invalide → mode auto

### `densite`

- borne : `0` à `1.2`
- défaut : `0`
- `densite=0` + `n=0` → mode auto **optimisé** (remplissage max sans chevauchement forcé)
- `densite>0` + `n=0` → auto piloté par densité

### `scale`

- borne : `0.05` à `1.2`
- défaut : `0.75`
- ajuste la taille des clones

### `color`

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

## 🌐 Preview GitHub Pages

URL de preview (repo actuel) :

[Ouvrir la preview](https://meomec.github.io/dot-pattern-lab/eames.html?controls=1)

## 📦 PWA et hors connexion

- le manifest est servi depuis `favicon/site.webmanifest`
- le service worker `sw.js` pré-cache le shell de l’application
- `offline.html` sert de fallback si une navigation échoue hors ligne
- les assets demandés ensuite sont stockés dans un cache runtime

### Stratégie de mise à jour

- le service worker n’utilise plus de suffixe de version manuel pour ses caches
- à chaque mise à jour du fichier `sw.js`, le navigateur installe un nouveau worker
- le cache de préchargement est resynchronisé automatiquement avec la liste `PRECACHE_URLS`
- les anciennes entrées de pré-cache qui ne font plus partie de cette liste sont supprimées à l’activation

### Vérifier le mode hors ligne

1. ouvrir l’application via un serveur local ou GitHub Pages
2. charger une première fois `eames.html` avec réseau actif
3. vérifier dans les DevTools que le service worker est bien installé
4. couper le réseau dans le navigateur
5. recharger `eames.html` pour confirmer que l’application reste disponible
6. tester une navigation non disponible en cache pour vérifier l’affichage de `offline.html`

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

## 🆕 Dernières évolutions

- Rotation des motifs pondérée : `0°` majoritaire, quarts de tour plus rares.
- Fallback de placement non strict sécurisé : plus de placement aléatoire non contraint.
- Règle anti-adjacence couleur durcie (hors noir) pour éviter les motifs “côte à côte” visuellement.

---

Have fun 🌈🫧
