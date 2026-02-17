const DEFAULT_GRID_SCALE = 0.75;
const DEFAULT_DENSITY = 0;
const selector = document.getElementById("motif-selector");
const cloneCountInput = document.getElementById("clone-count-input");
const gridScaleInput = document.getElementById("grid-scale-input");
const gridScaleValue = document.getElementById("grid-scale-value");
const densityInput = document.getElementById("density-input");
const densityValue = document.getElementById("density-value");
const colorModeInputs = Array.from(
  document.querySelectorAll('input[name="color-mode-input"]'),
);
const debugInput = document.getElementById("debug-input");
const controlsCloseButton = document.getElementById("controls-close");
const pattern = document.querySelector(".pattern");
const motifTemplates = Array.from(document.querySelectorAll(".motif"));
const frequencies = motifTemplates.map(
  (motif) => parseFloat(motif.dataset.frequency) || 1,
);
const cloneResetEntries = [];
let resetSchedulerId = null;
let resizeReflowTimerId = null;
const colorFrequencies = {
  yellow: 0.1,
  red: 0.1,
  blue: 0.1,
  "light-green": 0.1,
  "dark-green": 0.1,
  pink: 0.1,
  black: 0.4,
};
const colorClasses = Object.keys(colorFrequencies);
let debugCloneTooltip = null;

function ensureDebugCloneTooltip() {
  if (debugCloneTooltip && debugCloneTooltip.isConnected) {
    return debugCloneTooltip;
  }

  const tooltip = document.createElement("div");
  tooltip.id = "clone-debug-tooltip";
  tooltip.style.position = "fixed";
  tooltip.style.top = "0";
  tooltip.style.left = "0";
  tooltip.style.zIndex = "9999";
  tooltip.style.display = "none";
  tooltip.style.pointerEvents = "none";
  tooltip.style.whiteSpace = "pre";
  tooltip.style.padding = "8px 10px";
  tooltip.style.borderRadius = "4px";
  tooltip.style.background = "rgba(10, 10, 10, 0.9)";
  tooltip.style.color = "#fff";
  tooltip.style.fontFamily = "Menlo, Monaco, Consolas, monospace";
  tooltip.style.fontSize = "11px";
  tooltip.style.lineHeight = "1.35";
  tooltip.style.maxWidth = "320px";
  tooltip.style.boxShadow = "0 8px 28px rgba(0,0,0,0.28)";

  document.body.appendChild(tooltip);
  debugCloneTooltip = tooltip;
  return tooltip;
}

function hideDebugCloneTooltip() {
  if (!debugCloneTooltip) return;
  debugCloneTooltip.style.display = "none";
}

function moveDebugCloneTooltip(event) {
  if (!debugCloneTooltip) return;
  const offset = 14;
  const margin = 10;
  const tooltipRect = debugCloneTooltip.getBoundingClientRect();
  const maxX = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
  const maxY = Math.max(margin, window.innerHeight - tooltipRect.height - margin);
  const x = Math.min(maxX, Math.max(margin, event.clientX + offset));
  const y = Math.min(maxY, Math.max(margin, event.clientY + offset));
  debugCloneTooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function getCloneDebugLines(clone) {
  const motifIndex = parseInt(clone.dataset.motifIndex || "-1", 10);
  const motifNumber = Number.isFinite(motifIndex) && motifIndex >= 0 ? motifIndex + 1 : "?";
  const colorClass =
    clone.dataset.colorClass ||
    colorClasses.find((colorClassName) => clone.classList.contains(colorClassName)) ||
    "unknown";

  const leftRaw = clone.style.getPropertyValue("--motif-left") || "0px";
  const topRaw = clone.style.getPropertyValue("--motif-top") || "0px";
  const bloomDelay = clone.style.getPropertyValue("--bloom-delay") || "0s";
  const animationDelay = clone.style.getPropertyValue("--animation-delay") || "0s";
  const floatDuration = clone.style.getPropertyValue("--float-duration") || "0s";
  const width = clone.style.width || `${Math.round(clone.getBoundingClientRect().width)}px`;
  const height = clone.style.height || `${Math.round(clone.getBoundingClientRect().height)}px`;
  const rotation = clone.style.rotate || "0deg";

  return [
    `id: ${clone.id || "(sans id)"}`,
    `motif: ${motifNumber} (index ${motifIndex})`,
    `color: ${colorClass}`,
    `size: ${width} × ${height}`,
    `pos: ${leftRaw}, ${topRaw}`,
    `bloomDelay: ${bloomDelay}`,
    `animDelay: ${animationDelay}`,
    `floatDuration: ${floatDuration}`,
    `rotation: ${rotation}`,
    `mirrorX: ${clone.classList.contains("mirror-x") ? "yes" : "no"}`,
    `mirrorY: ${clone.classList.contains("mirror-y") ? "yes" : "no"}`,
  ];
}

function bindCloneDebugHover(clone) {
  if (!clone || clone.dataset.debugHoverBound === "1") return;
  clone.dataset.debugHoverBound = "1";

  clone.addEventListener("mouseenter", (event) => {
    if (!runtimeConfig.debugPlacement) return;
    const tooltip = ensureDebugCloneTooltip();
    tooltip.textContent = getCloneDebugLines(clone).join("\n");
    tooltip.style.display = "block";
    moveDebugCloneTooltip(event);
  });

  clone.addEventListener("mousemove", (event) => {
    if (!runtimeConfig.debugPlacement) return;
    moveDebugCloneTooltip(event);
  });

  clone.addEventListener("mouseleave", () => {
    hideDebugCloneTooltip();
  });
}

/**
 * Parse le paramètre URL n (nombre de clones) avec validation.
 * @param {string | null | undefined} value Valeur brute provenant de l'URL.
 * @returns {number | null} Nombre entier >= 0, ou null si invalide/absent.
 */
function parseCloneCountQuery(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Parse et borne le facteur d'échelle global des motifs.
 * @param {string | null | undefined} value Valeur brute (query ou contrôle).
 * @param {number} fallbackValue Valeur de repli si parsing impossible.
 * @returns {number} Échelle bornée entre 0.05 et 1.2.
 */
function parseGridScale(value, fallbackValue) {
  const parsed = parseFloat(value || "");
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(1.2, Math.max(0.05, parsed));
}

/**
 * Parse et borne la densité utilisée pour le calcul automatique du nombre de clones.
 * @param {string | null | undefined} value Valeur brute (query ou contrôle).
 * @param {number} fallbackValue Valeur de repli si parsing impossible.
 * @returns {number} Densité bornée entre 0 et 1.2.
 */
function parseDensity(value, fallbackValue) {
  const parsed = parseFloat(value || "");
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(1.2, Math.max(0, parsed));
}

/**
 * Convertit une chaîne booléenne tolérante en booléen runtime.
 * @param {string | null | undefined} value Valeur brute (1/0, true/false, yes/no, on/off).
 * @param {boolean} [fallbackValue=false] Valeur de repli si non reconnue.
 * @returns {boolean} Booléen normalisé.
 */
function parseBooleanQuery(value, fallbackValue = false) {
  if (value == null) return fallbackValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallbackValue;
}

/**
 * Normalise le mode couleur depuis l'URL/contrôles.
 * @param {string | null | undefined} value Valeur brute du mode couleur.
 * @returns {"color" | "black"} Mode couleur normalisé.
 */
function parseColorMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["black", "noir"].includes(normalized)) return "black";
  return "color";
}

const queryParams = new URLSearchParams(window.location.search);
const queryCloneCount = parseCloneCountQuery(queryParams.get("n"));
const runtimeConfig = {
  cloneCount: queryCloneCount,
  gridScale: parseGridScale(
    queryParams.get("scale") || queryParams.get("gridScale"),
    DEFAULT_GRID_SCALE,
  ),
  density: parseDensity(
    queryParams.get("density") || queryParams.get("densite"),
    DEFAULT_DENSITY,
  ),
  colorMode: parseColorMode(
    queryParams.get("color") ||
      queryParams.get("colorMode") ||
      queryParams.get("couleur"),
  ),
  debugPlacement: parseBooleanQuery(queryParams.get("debug"), false),
  controlsVisibility: parseBooleanQuery(queryParams.get("controls"), false),
};

/**
 * Affiche ou masque le panneau de contrôles selon la configuration runtime.
 */
function setControlsVisibility() {
  const visibility = runtimeConfig.controlsVisibility;
  document.getElementById("controls")?.classList.toggle("on", visibility);
}

/**
 * Active/désactive les aides de debug de placement sur le document.
 */
function setDebugMode() {
  if (runtimeConfig.debugPlacement) {
    document.body.dataset.debugPlacement = "true";
    ensureDebugCloneTooltip();
    return;
  }
  delete document.body.dataset.debugPlacement;
  hideDebugCloneTooltip();
}

/**
 * Formate un nombre pour l'affichage dans les labels de sliders.
 * @param {string | number} value Valeur à afficher.
 * @returns {string} Chaîne numérique à deux décimales.
 */
function formatControlNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toFixed(2);
}

/**
 * Synchronise les valeurs textuelles affichées à côté des sliders.
 */
function syncRangeValueDisplays() {
  if (gridScaleInput && gridScaleValue) {
    gridScaleValue.textContent = formatControlNumber(gridScaleInput.value);
  }

  if (densityInput && densityValue) {
    densityValue.textContent = formatControlNumber(densityInput.value);
  }
}

/**
 * Recopie la configuration runtime dans les champs du panneau de contrôles.
 */
function syncControlsInputsFromRuntime() {
  if (cloneCountInput) {
    cloneCountInput.value = String(runtimeConfig.cloneCount ?? 0);
  }

  if (gridScaleInput) {
    gridScaleInput.value = String(runtimeConfig.gridScale);
  }

  if (densityInput) {
    densityInput.value = String(runtimeConfig.density);
  }

  if (colorModeInputs.length > 0) {
    colorModeInputs.forEach((input) => {
      input.checked = input.value === runtimeConfig.colorMode;
    });
  }

  if (debugInput) {
    debugInput.checked = runtimeConfig.debugPlacement;
  }

  syncRangeValueDisplays();

}

/**
 * Synchronise l'URL courante avec la configuration runtime active.
 */
function syncQueryFromRuntime() {
  const params = new URLSearchParams(window.location.search);

  params.set("n", String(runtimeConfig.cloneCount ?? 0));
  params.set("scale", String(runtimeConfig.gridScale));
  params.delete("gridScale");
  params.set("density", String(runtimeConfig.density));
  params.set("color", runtimeConfig.colorMode);
  params.delete("colorMode");
  params.set("debug", runtimeConfig.debugPlacement ? "1" : "0");
  params.set("controls", runtimeConfig.controlsVisibility ? "1" : "0");

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

/**
 * Lit les contrôles UI, met à jour la config runtime et régénère l'affichage.
 */
function applyRuntimeConfigFromControls() {
  if (
    !cloneCountInput ||
    !gridScaleInput ||
    !densityInput ||
    colorModeInputs.length === 0
  ) {
    return;
  }

  const selectedColorModeInput =
    colorModeInputs.find((input) => input.checked) || null;

  runtimeConfig.cloneCount = parseCloneCountQuery(cloneCountInput.value);
  runtimeConfig.gridScale = parseGridScale(
    gridScaleInput.value,
    DEFAULT_GRID_SCALE,
  );
  runtimeConfig.density = parseDensity(densityInput.value, DEFAULT_DENSITY);
  runtimeConfig.colorMode = parseColorMode(selectedColorModeInput?.value);
  runtimeConfig.debugPlacement = Boolean(debugInput?.checked);

  syncRangeValueDisplays();
  syncControlsInputsFromRuntime();
  setDebugMode();
  setControlsVisibility();
  syncQueryFromRuntime();

  const value = selector.value;
  if (value === "all") {
    showAllMotifs();
    return;
  }

  showSingleMotif(parseInt(value, 10));
}

/**
 * Branche les listeners de changement des contrôles avec application immédiate.
 */
function bindControlsAutoApply() {
  const autoApplyFields = [
    cloneCountInput,
    gridScaleInput,
    densityInput,
    debugInput,
    ...colorModeInputs,
  ].filter(Boolean);

  autoApplyFields.forEach((field) => {
    field.addEventListener("change", applyRuntimeConfigFromControls);
  });

  [gridScaleInput, densityInput].filter(Boolean).forEach((field) => {
    field.addEventListener("input", applyRuntimeConfigFromControls);
  });

  if (controlsCloseButton) {
    controlsCloseButton.addEventListener("click", () => {
      runtimeConfig.controlsVisibility = false;
      setControlsVisibility();
      syncQueryFromRuntime();
    });
  }
}

/**
 * Retourne la liste des classes couleur autorisées selon le mode actif.
 * @returns {string[]} Classes couleur utilisables pour le tirage.
 */
function getActiveColorClasses() {
  if (runtimeConfig.colorMode === "black") return ["black"];
  return colorClasses;
}

/**
 * Retourne le poids de tirage d'une couleur selon le mode actif.
 * @param {string} colorClass Classe couleur ciblée.
 * @returns {number} Poids de probabilité (>= 0).
 */
function getActiveColorWeight(colorClass) {
  if (runtimeConfig.colorMode === "black") {
    return colorClass === "black" ? 1 : 0;
  }
  return colorFrequencies[colorClass] || 0;
}

/**
 * Nettoie l'état des resets cycliques des clones et stoppe le scheduler.
 */
function clearCycleTimers() {
  cloneResetEntries.length = 0;
  if (resetSchedulerId !== null) {
    clearInterval(resetSchedulerId);
    resetSchedulerId = null;
  }
}

/**
 * Démarre le scheduler global de reset d'animation si nécessaire.
 */
function ensureResetScheduler() {
  if (resetSchedulerId !== null) return;

  resetSchedulerId = window.setInterval(() => {
    if (cloneResetEntries.length === 0) {
      clearInterval(resetSchedulerId);
      resetSchedulerId = null;
      return;
    }

    const now = Date.now();

    for (let i = cloneResetEntries.length - 1; i >= 0; i -= 1) {
      const entry = cloneResetEntries[i];

      if (!entry.clone.isConnected) {
        cloneResetEntries.splice(i, 1);
        continue;
      }

      if (now >= entry.nextResetAtMs) {
        resetMotifCycleState(entry.clone, entry.motifIndex);
        while (entry.nextResetAtMs <= now) {
          entry.nextResetAtMs += entry.cycleMs;
        }
      }
    }
  }, 120);
}

/**
 * Convertit une durée CSS (ms/s) en secondes numériques.
 * @param {string | null | undefined} value Valeur CSS brute.
 * @returns {number} Durée en secondes (NaN si invalide).
 */
function parseDurationToSeconds(value) {
  const input = (value || "").trim();
  if (!input) return NaN;

  if (input.endsWith("ms")) {
    return parseFloat(input) / 1000;
  }

  if (input.endsWith("s")) {
    return parseFloat(input);
  }

  return parseFloat(input);
}

/**
 * Lit la durée de cycle globale depuis la variable CSS --cycle-duration.
 * @returns {number} Durée de cycle en secondes.
 */
function getCycleDurationSeconds() {
  const rootStyles = getComputedStyle(document.documentElement);
  const raw = rootStyles.getPropertyValue("--cycle-duration");
  const seconds = parseDurationToSeconds(raw);

  if (!Number.isFinite(seconds) || seconds <= 0) return 20;
  return seconds;
}

/**
 * Tire un index de motif selon les fréquences pondérées globales.
 * @returns {number} Index de motif sélectionné.
 */
function getWeightedRandomIndex() {
  const totalFrequency = frequencies.reduce((sum, value) => sum + value, 0);
  let random = Math.random() * totalFrequency;
  for (let i = 0; i < frequencies.length; i++) {
    random -= frequencies[i];
    if (random <= 0) return i;
  }
  return frequencies.length - 1;
}

/**
 * Tire un index de motif pondéré en excluant certains indices.
 * @param {number[]} [excludedIndices=[]] Indices à exclure en priorité.
 * @returns {number} Index de motif sélectionné.
 */
function getWeightedRandomIndexExcluding(excludedIndices = []) {
  const excluded = new Set(excludedIndices);
  const allowed = frequencies
    .map((frequency, index) => ({ index, frequency }))
    .filter((item) => !excluded.has(item.index) && item.frequency > 0);

  if (allowed.length === 0) {
    return getWeightedRandomIndex();
  }

  const totalFrequency = allowed.reduce((sum, item) => sum + item.frequency, 0);
  let random = Math.random() * totalFrequency;

  for (const item of allowed) {
    random -= item.frequency;
    if (random <= 0) return item.index;
  }

  return allowed[allowed.length - 1].index;
}

/**
 * Tire une couleur pondérée selon le mode actif (couleur ou noir).
 * @returns {string} Classe couleur sélectionnée.
 */
function getWeightedRandomColorClass() {
  const activeColorClasses = getActiveColorClasses();
  const totalFrequency = activeColorClasses.reduce((sum, colorClass) => {
    return sum + getActiveColorWeight(colorClass);
  }, 0);

  let random = Math.random() * totalFrequency;
  for (const colorClass of activeColorClasses) {
    random -= getActiveColorWeight(colorClass);
    if (random <= 0) return colorClass;
  }

  return activeColorClasses[0] || "black";
}

/**
 * Tire une couleur pondérée en excluant certaines classes si possible.
 * @param {string[]} [excludedColorClasses=[]] Couleurs à éviter.
 * @returns {string} Classe couleur sélectionnée.
 */
function getWeightedRandomColorClassExcluding(excludedColorClasses = []) {
  const excluded = new Set(excludedColorClasses);
  const activeColorClasses = getActiveColorClasses();
  const allowed = activeColorClasses.filter(
    (colorClass) =>
      !excluded.has(colorClass) && getActiveColorWeight(colorClass) > 0,
  );

  if (allowed.length === 0) {
    return getWeightedRandomColorClass();
  }

  const totalFrequency = allowed.reduce((sum, colorClass) => {
    return sum + getActiveColorWeight(colorClass);
  }, 0);

  let random = Math.random() * totalFrequency;
  for (const colorClass of allowed) {
    random -= getActiveColorWeight(colorClass);
    if (random <= 0) return colorClass;
  }

  return allowed[allowed.length - 1];
}

/**
 * Applique le style de base d'un clone (timings, symétrie, rotation, couleur, taille).
 * @param {HTMLElement} clone Élément clone de motif à configurer.
 * @param {number} bloomDelay Délai de départ de la séquence d'animation.
 * @param {string} colorClass Classe couleur forcée (optionnelle via plan).
 */
function applyCloneBaseStyle(clone, bloomDelay, colorClass) {
  const cycleDuration = getCycleDurationSeconds();
  const randomDelay = Math.random() * (cycleDuration * 0.15);
  const randomDuration = cycleDuration * (0.5 + Math.random() * 0.3);
  const randomMirrorX = Math.random() < 0.5;
  const randomMirrorY = Math.random() < 0.5;
  const randomRotationRoll = Math.random();
  const randomRotation =
    randomRotationRoll < 0.8 ? 0 : randomRotationRoll < 0.9 ? 90 : -90;
  const allowMirroring = !clone.classList.contains("motif-type-2");
  const assignedColorClass = colorClass || getWeightedRandomColorClass();
  const width = parseFloat(clone.dataset.dimensionW);
  const height = parseFloat(clone.dataset.dimensionH);

  clone.style.setProperty("--bloom-delay", `${bloomDelay}s`);
  clone.style.setProperty("--animation-delay", `${randomDelay}s`);
  clone.style.setProperty("--float-duration", `${randomDuration}s`);
  clone.style.setProperty("--motif-left", "0px");
  clone.style.setProperty("--motif-top", "0px");
  clone.style.rotate = `${randomRotation}deg`;
  clone.classList.toggle("mirror-x", allowMirroring && randomMirrorX);
  clone.classList.toggle("mirror-y", allowMirroring && randomMirrorY);
  clone.classList.add("color");
  clone.classList.remove(...colorClasses);
  clone.classList.add(assignedColorClass);
  clone.style.width = `${width * runtimeConfig.gridScale}px`;
  clone.style.height = `${height * runtimeConfig.gridScale}px`;

  if (runtimeConfig.debugPlacement) {
    clone.style.outline = "1px dashed rgba(0,0,0,0.35)";
    clone.style.outlineOffset = "2px";
  } else {
    clone.style.outline = "";
    clone.style.outlineOffset = "";
  }
}

/**
 * Calcule la zone de rendu disponible pour la pattern en fonction du viewport.
 * @returns {{width: number, height: number}} Dimensions de la zone de placement.
 */
function getPatternViewport() {
  const bodyStyles = getComputedStyle(document.body);
  const bodyPaddingTop = parseFloat(bodyStyles.paddingTop) || 0;
  const bodyPaddingBottom = parseFloat(bodyStyles.paddingBottom) || 0;
  const viewportHeight = Math.max(
    520,
    window.innerHeight - bodyPaddingTop - bodyPaddingBottom,
  );

  pattern.style.height = `${viewportHeight}px`;
  const width = Math.max(320, pattern.clientWidth || window.innerWidth);

  return { width, height: viewportHeight };
}

/**
 * Estime une grille logique (colonnes/lignes) à partir du nombre cible et du ratio écran.
 * @param {number} targetCount Nombre de clones visé.
 * @param {number} viewportWidth Largeur de viewport utilisable.
 * @param {number} viewportHeight Hauteur de viewport utilisable.
 * @returns {{cols: number, rows: number}} Grille estimée.
 */
function getGridShape(targetCount, viewportWidth, viewportHeight) {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  const cols = Math.max(4, Math.round(Math.sqrt(targetCount * aspect)));
  const rows = Math.max(3, Math.ceil(targetCount / cols));
  return { cols, rows };
}

/**
 * Distribue un total en quotas entiers pondérés (méthode des restes).
 * @param {{key: string | number, weight: number}[]} entries Entrées pondérées.
 * @param {number} totalCount Total à distribuer.
 * @returns {Map<string | number, number>} Quota final par clé.
 */
function buildWeightedQuotaMap(entries, totalCount) {
  const safeEntries = entries.map((entry) => ({
    key: entry.key,
    weight: Math.max(0, Number(entry.weight) || 0),
  }));

  const totalWeight = safeEntries.reduce((sum, entry) => sum + entry.weight, 0);
  const fallbackWeight = safeEntries.length > 0 ? 1 / safeEntries.length : 0;

  const raw = safeEntries.map((entry) => {
    const normalizedWeight =
      totalWeight > 0 ? entry.weight / totalWeight : fallbackWeight;
    const exact = normalizedWeight * totalCount;
    return {
      key: entry.key,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = raw.reduce((sum, entry) => sum + entry.count, 0);
  let remaining = Math.max(0, totalCount - assigned);

  raw.sort((a, b) => b.remainder - a.remainder);
  let cursor = 0;
  while (remaining > 0 && raw.length > 0) {
    raw[cursor % raw.length].count += 1;
    cursor += 1;
    remaining -= 1;
  }

  const quota = new Map();
  raw.forEach((entry) => {
    quota.set(entry.key, entry.count);
  });

  return quota;
}

/**
 * Sélectionne une clé depuis un quota restant, en tentant d'éviter des exclusions.
 * @param {Map<string | number, number>} quotaMap Quotas restants par clé.
 * @param {(string | number)[]} [excludedKeys=[]] Clés à éviter en priorité.
 * @returns {string | number | null} Clé tirée, ou null si aucun quota disponible.
 */
function pickKeyFromQuota(quotaMap, excludedKeys = []) {
  const excluded = new Set(excludedKeys);

  const allowed = [];
  const fallback = [];

  quotaMap.forEach((count, key) => {
    if (count <= 0) return;
    const target = excluded.has(key) ? fallback : allowed;
    target.push({ key, count });
  });

  const pool = allowed.length > 0 ? allowed : fallback;
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, item) => sum + item.count, 0);
  let random = Math.random() * total;

  for (const item of pool) {
    random -= item.count;
    if (random <= 0) return item.key;
  }

  return pool[pool.length - 1].key;
}

/**
 * Construit un plan de clones (motif + couleur) en respectant les quotas et exclusions locales.
 * @param {number} cellCount Nombre de clones à planifier.
 * @param {number} cols Nombre de colonnes de la grille logique.
 * @returns {{motifIndex: number, colorClass: string}[]} Plan de génération.
 */
function buildClonePlan(cellCount, cols) {
  const plan = [];
  const activeColorClasses = getActiveColorClasses();

  const motifQuota = buildWeightedQuotaMap(
    frequencies.map((weight, index) => ({ key: index, weight })),
    cellCount,
  );

  const colorQuota = buildWeightedQuotaMap(
    activeColorClasses.map((colorClass) => ({
      key: colorClass,
      weight: getActiveColorWeight(colorClass),
    })),
    cellCount,
  );

  const enforceColorAdjacency = activeColorClasses.length > 1;

  for (let index = 0; index < cellCount; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);

    const leftIndex = col > 0 ? index - 1 : -1;
    const upIndex = row > 0 ? index - cols : -1;

    const excludedMotifs = [];
    const excludedColors = [];

    if (leftIndex >= 0) {
      excludedMotifs.push(plan[leftIndex].motifIndex);
      if (enforceColorAdjacency && plan[leftIndex].colorClass !== "black") {
        excludedColors.push(plan[leftIndex].colorClass);
      }
    }

    if (upIndex >= 0) {
      excludedMotifs.push(plan[upIndex].motifIndex);
      if (enforceColorAdjacency && plan[upIndex].colorClass !== "black") {
        excludedColors.push(plan[upIndex].colorClass);
      }
    }

    const motifIndex = pickKeyFromQuota(motifQuota, excludedMotifs);
    const colorClass = pickKeyFromQuota(colorQuota, excludedColors);

    if (motifIndex !== null) {
      motifQuota.set(
        motifIndex,
        Math.max(0, (motifQuota.get(motifIndex) || 0) - 1),
      );
    }

    if (colorClass !== null) {
      colorQuota.set(
        colorClass,
        Math.max(0, (colorQuota.get(colorClass) || 0) - 1),
      );
    }

    plan.push({
      motifIndex: motifIndex !== null ? motifIndex : getWeightedRandomIndex(),
      colorClass:
        colorClass !== null ? colorClass : getWeightedRandomColorClass(),
    });
  }

  return plan;
}

/**
 * Détecte un conflit de style entre un candidat et ses voisins proches.
 * @param {{x:number,y:number,width:number,height:number,motifIndex:number,colorClass:string}} candidate Clone candidat.
 * @param {{x:number,y:number,width:number,height:number,motifIndex:number,colorClass:string}[]} placed Clones déjà placés.
 * @param {number} adjacencyMultiplier Facteur de rayon de voisinage style.
 * @returns {boolean} True si conflit (motif/couleur), sinon false.
 */
function conflictsWithNearbyStyles(candidate, placed, adjacencyMultiplier) {
  for (let i = 0; i < placed.length; i += 1) {
    const other = placed[i];
    const dx = candidate.x - other.x;
    const dy = candidate.y - other.y;
    const distance = Math.hypot(dx, dy);

    const pairBaseRadius =
      (candidate.width + other.width + candidate.height + other.height) / 4;
    const adjacencyRadius = pairBaseRadius * adjacencyMultiplier;

    if (distance > adjacencyRadius) continue;

    if (candidate.motifIndex === other.motifIndex) return true;

    const sameColor = candidate.colorClass === other.colorClass;
    if (sameColor && candidate.colorClass !== "black") {
      const sameColorMinDx = ((candidate.width + other.width) / 2) * 1.08;
      const sameColorMinDy = ((candidate.height + other.height) / 2) * 1.08;
      if (Math.abs(dx) < sameColorMinDx && Math.abs(dy) < sameColorMinDy) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Vérifie si un clone candidat intersecte un clone déjà placé.
 * @param {{x:number,y:number,width:number,height:number}} candidate Clone candidat.
 * @param {{x:number,y:number,width:number,height:number}[]} placed Clones déjà placés.
 * @param {number} marginRatio Marge relative anti-chevauchement.
 * @returns {boolean} True si intersection détectée.
 */
function intersectsPlaced(candidate, placed, marginRatio) {
  for (let i = 0; i < placed.length; i += 1) {
    const other = placed[i];
    const dx = Math.abs(candidate.x - other.x);
    const dy = Math.abs(candidate.y - other.y);
    const minDxBase = (candidate.width + other.width) / 2;
    const minDyBase = (candidate.height + other.height) / 2;
    const minDx = minDxBase * (1 + marginRatio);
    const minDy = minDyBase * (1 + marginRatio);

    if (dx < minDx && dy < minDy) {
      return true;
    }
  }
  return false;
}

/**
 * Place les clones dans le viewport via une stratégie pseudo-Poisson contrainte.
 * @param {HTMLElement[]} clones Clones à placer.
 * @param {number} viewportWidth Largeur de zone.
 * @param {number} viewportHeight Hauteur de zone.
 * @param {{strictNoOverlap?: boolean, enforceStyleAdjacency?: boolean}} [options={}] Options de placement.
 * @returns {HTMLElement[]} Clones effectivement placés.
 */
function placeClonesPoissonConstrained(
  clones,
  viewportWidth,
  viewportHeight,
  options = {},
) {
  const strictNoOverlap = Boolean(options.strictNoOverlap);
  const enforceStyleAdjacency = options.enforceStyleAdjacency !== false;
  const placedClones = [];
  const placed = [];
  const marginRatios = strictNoOverlap
    ? [0.2, 0.16, 0.12, 0.1, 0.08, 0.06]
    : [0.22, 0.16, 0.11, 0.07, 0.035, 0];
  const adjacencyMultipliers = strictNoOverlap
    ? [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]
    : [1.2, 1.05, 0.9, 0.78, 0.66, 0.55];
  const attemptsPerLevel = strictNoOverlap ? 520 : 260;

  clones.forEach((clone) => {
    const width = parseFloat(clone.style.width) || 80;
    const height = parseFloat(clone.style.height) || 80;
    const motifIndex = parseInt(clone.dataset.motifIndex || "0", 10);
    const colorClass = clone.dataset.colorClass || "";

    const minX = width / 2;
    const maxX = Math.max(minX, viewportWidth - width / 2);
    const minY = height / 2;
    const maxY = Math.max(minY, viewportHeight - height / 2);

    let selectedPoint = null;

    for (
      let level = 0;
      level < marginRatios.length && !selectedPoint;
      level += 1
    ) {
      const marginRatio = marginRatios[level];
      const adjacencyMultiplier = adjacencyMultipliers[level];

      for (let attempt = 0; attempt < attemptsPerLevel; attempt += 1) {
        const x = minX + Math.random() * (maxX - minX || 1);
        const y = minY + Math.random() * (maxY - minY || 1);
        const candidate = { x, y, width, height, motifIndex, colorClass };

        if (intersectsPlaced(candidate, placed, marginRatio)) continue;
        if (
          enforceStyleAdjacency &&
          conflictsWithNearbyStyles(candidate, placed, adjacencyMultiplier)
        )
          continue;

        selectedPoint = candidate;
        break;
      }
    }

    if (!selectedPoint && !strictNoOverlap) {
      for (let attempt = 0; attempt < attemptsPerLevel; attempt += 1) {
        const x = minX + Math.random() * (maxX - minX || 1);
        const y = minY + Math.random() * (maxY - minY || 1);
        const candidate = { x, y, width, height, motifIndex, colorClass };

        if (intersectsPlaced(candidate, placed, 0)) continue;
        if (
          enforceStyleAdjacency &&
          conflictsWithNearbyStyles(candidate, placed, 0.55)
        )
          continue;

        selectedPoint = candidate;
        break;
      }
    }

    if (!selectedPoint) {
      return;
    }

    placed.push(selectedPoint);
    placedClones.push(clone);
    clone.style.setProperty("--motif-left", `${selectedPoint.x}px`);
    clone.style.setProperty("--motif-top", `${selectedPoint.y}px`);

    if (runtimeConfig.debugPlacement) {
      clone.title = `motif:${motifIndex + 1} | color:${colorClass} | x:${Math.round(selectedPoint.x)} y:${Math.round(selectedPoint.y)}`;
    } else {
      clone.removeAttribute("title");
    }
  });

  return placedClones;
}

/**
 * Détermine le nombre final de clones selon n, scale, densité et taille d'écran.
 * @param {number | null | undefined} requestedCloneCount Valeur demandée (n).
 * @param {number} viewportWidth Largeur de zone.
 * @param {number} viewportHeight Hauteur de zone.
 * @returns {number} Nombre de clones retenu.
 */
function getBalancedCloneCount(requestedCloneCount, viewportWidth, viewportHeight) {
  if (Number.isFinite(requestedCloneCount) && requestedCloneCount > 0) {
    return Math.max(1, Math.floor(requestedCloneCount));
  }

  const sampleScale = runtimeConfig.gridScale;
  const avgArea =
    motifTemplates.reduce((sum, motif) => {
      const w = (parseFloat(motif.dataset.dimensionW) || 80) * sampleScale;
      const h = (parseFloat(motif.dataset.dimensionH) || 80) * sampleScale;
      return sum + w * h;
    }, 0) / Math.max(1, motifTemplates.length);

  const availableArea = viewportWidth * viewportHeight;
  const densityFactor = runtimeConfig.density;

  if (densityFactor <= 0) {
    const optimizedTarget = Math.floor(
      availableArea / Math.max(1, avgArea * 1.32),
    );
    return Math.max(18, Math.min(520, optimizedTarget));
  }

  const targetCount = Math.floor(
    (availableArea * densityFactor) / Math.max(1, avgArea),
  );
  const scaleBoost = Math.max(0.55, Math.min(1.8, 0.35 / sampleScale));
  const autoMaxCount = Math.round(
    Math.max(90, Math.min(520, (availableArea / 12000) * scaleBoost)),
  );
  const upperBound = autoMaxCount;

  const adaptiveMinCount = Math.max(
    8,
    Math.min(32, Math.round(availableArea / 110000)),
  );

  return Math.max(adaptiveMinCount, Math.min(upperBound, targetCount));
}

/**
 * Applique les délais d'animation séquencés du motif 1.
 * @param {HTMLElement} clone Clone motif 1.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif1Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const disc1 = svg.querySelector("#disc1");
  const branch1 = svg.querySelector("#branch1");
  const branch2 = svg.querySelector("#branch2");
  const branch3 = svg.querySelector("#branch3");
  const branch4 = svg.querySelector("#branch4");
  const branch5 = svg.querySelector("#branch5");
  const disc2 = svg.querySelector("#disc2");
  const disc3 = svg.querySelector("#disc3");
  const disc4 = svg.querySelector("#disc4");
  const disc5 = svg.querySelector("#disc5");
  const disc6 = svg.querySelector("#disc6");

  const growDuration = asCycle(0.035);
  const stepGap = asCycle(0.01);
  const disc1Delay = bloomDelay;
  const branch1Delay = disc1Delay + asCycle(0.0225);
  const branch23Delay = branch1Delay + growDuration;
  const disc23Branch45Delay = branch23Delay + growDuration + stepGap;
  const disc4Delay = disc23Branch45Delay + growDuration + asCycle(0.0075);
  const disc56Delay = disc4Delay + asCycle(0.0175);

  if (disc1) disc1.style.animationDelay = `${disc1Delay}s`;
  if (branch1) branch1.style.animationDelay = `${branch1Delay}s`;

  if (branch2) branch2.style.animationDelay = `${branch23Delay}s`;
  if (branch3) branch3.style.animationDelay = `${branch23Delay}s`;

  if (disc2) disc2.style.animationDelay = `${disc23Branch45Delay}s`;
  if (disc3) disc3.style.animationDelay = `${disc23Branch45Delay}s`;
  if (branch4) branch4.style.animationDelay = `${disc23Branch45Delay}s`;
  if (branch5) branch5.style.animationDelay = `${disc23Branch45Delay}s`;

  if (disc4) disc4.style.animationDelay = `${disc4Delay}s`;

  if (disc5) disc5.style.animationDelay = `${disc56Delay}s`;
  if (disc6) disc6.style.animationDelay = `${disc56Delay}s`;
}

/**
 * Applique les délais d'animation séquencés du motif 2.
 * @param {HTMLElement} clone Clone motif 2.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif2Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const disc1 = svg.querySelector("#disc1");
  const branch1 = svg.querySelector("#branch1");
  const branch2 = svg.querySelector("#branch2");
  const branch3 = svg.querySelector("#branch3");
  const disc2 = svg.querySelector("#disc2");
  const disc3 = svg.querySelector("#disc3");
  const disc4 = svg.querySelector("#disc4");

  const growDuration = asCycle(0.035);
  const stepGap = asCycle(0.01);
  const disc1Delay = bloomDelay;
  const branch1Delay = disc1Delay + asCycle(0.0225);
  const branch23Delay = branch1Delay + growDuration;
  const disc2Delay = branch23Delay + growDuration + stepGap;
  const disc3Delay = disc2Delay + asCycle(0.0125);
  const disc4Delay = disc3Delay + asCycle(0.0125);

  if (disc1) disc1.style.animationDelay = `${disc1Delay}s`;
  if (branch1) branch1.style.animationDelay = `${branch1Delay}s`;
  if (branch2) branch2.style.animationDelay = `${branch23Delay}s`;
  if (branch3) branch3.style.animationDelay = `${branch23Delay}s`;
  if (disc2) disc2.style.animationDelay = `${disc2Delay}s`;
  if (disc3) disc3.style.animationDelay = `${disc3Delay}s`;
  if (disc4) disc4.style.animationDelay = `${disc4Delay}s`;
}

/**
 * Applique les délais d'animation séquencés du motif 3.
 * @param {HTMLElement} clone Clone motif 3.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif3Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const disc1 = svg.querySelector("#disc1");
  const branch1 = svg.querySelector("#branch1");
  const branch2 = svg.querySelector("#branch2");
  const branch3 = svg.querySelector("#branch3");
  const branch4 = svg.querySelector("#branch4");
  const branch5 = svg.querySelector("#branch5");
  const disc2 = svg.querySelector("#disc2");
  const disc3 = svg.querySelector("#disc3");
  const disc4 = svg.querySelector("#disc4");
  const disc5 = svg.querySelector("#disc5");
  const disc6 = svg.querySelector("#disc6");

  const growDuration = asCycle(0.035);
  const stepGap = asCycle(0.01);
  const disc1Delay = bloomDelay;
  const branch1Delay = disc1Delay + asCycle(0.0225);
  const otherBranchesDelay = branch1Delay + growDuration;
  const disc2Delay = otherBranchesDelay + growDuration + stepGap;
  const disc3Delay = disc2Delay + asCycle(0.01);
  const disc4Delay = disc3Delay + asCycle(0.01);
  const disc5Delay = disc4Delay + asCycle(0.01);
  const disc6Delay = disc5Delay + asCycle(0.01);

  if (disc1) disc1.style.animationDelay = `${disc1Delay}s`;
  if (branch1) branch1.style.animationDelay = `${branch1Delay}s`;
  if (branch2) branch2.style.animationDelay = `${otherBranchesDelay}s`;
  if (branch3) branch3.style.animationDelay = `${otherBranchesDelay}s`;
  if (branch4) branch4.style.animationDelay = `${otherBranchesDelay}s`;
  if (branch5) branch5.style.animationDelay = `${otherBranchesDelay}s`;
  if (disc2) disc2.style.animationDelay = `${disc2Delay}s`;
  if (disc3) disc3.style.animationDelay = `${disc3Delay}s`;
  if (disc4) disc4.style.animationDelay = `${disc4Delay}s`;
  if (disc5) disc5.style.animationDelay = `${disc5Delay}s`;
  if (disc6) disc6.style.animationDelay = `${disc6Delay}s`;
}

/**
 * Applique les délais d'animation séquencés du motif 4.
 * @param {HTMLElement} clone Clone motif 4.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif4Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const disc1 = svg.querySelector("#disc1");
  const branch1 = svg.querySelector("#branch1");
  const branch2 = svg.querySelector("#branch2");
  const branch3 = svg.querySelector("#branch3");
  const disc2 = svg.querySelector("#disc2");
  const disc3 = svg.querySelector("#disc3");
  const disc4 = svg.querySelector("#disc4");

  const growDuration = asCycle(0.035);
  const stepGap = asCycle(0.01);
  const disc1Delay = bloomDelay;
  const branch2Delay = disc1Delay + asCycle(0.0225);
  const sideBranchesDelay = branch2Delay + growDuration;
  const sideDiscsDelay = sideBranchesDelay + growDuration + stepGap;
  const disc3Delay = sideDiscsDelay + asCycle(0.015);

  if (disc1) disc1.style.animationDelay = `${disc1Delay}s`;
  if (branch2) branch2.style.animationDelay = `${branch2Delay}s`;
  if (branch1) branch1.style.animationDelay = `${sideBranchesDelay}s`;
  if (branch3) branch3.style.animationDelay = `${sideBranchesDelay}s`;
  if (disc2) disc2.style.animationDelay = `${sideDiscsDelay}s`;
  if (disc4) disc4.style.animationDelay = `${sideDiscsDelay}s`;
  if (disc3) disc3.style.animationDelay = `${disc3Delay}s`;
}

/**
 * Applique les délais d'animation séquencés du motif 5.
 * @param {HTMLElement} clone Clone motif 5.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif5Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const branchGrowDuration = asCycle(0.03);
  const branchStartGap = branchGrowDuration;
  const discAfterBranchOffset = asCycle(0.006);
  const discStagger = asCycle(0.003);

  const disc1 = svg.querySelector("#disc1");
  if (disc1) {
    disc1.style.animationDelay = `${bloomDelay}s`;
  }

  const branchSequence = [
    { branch: "branch1", discs: ["disc2"] },
    { branch: "branch2", discs: [] },
    { branch: "branch3", discs: ["disc3"] },
    { branch: "branch4", discs: ["disc4"] },
    { branch: "branch5", discs: [] },
    { branch: "branch6", discs: ["disc5"] },
    { branch: "branch7", discs: ["disc6"] },
    { branch: "branch8", discs: ["disc7"] },
    { branch: "branch9", discs: ["disc8"] },
  ];

  const firstBranchStart = bloomDelay + asCycle(0.02);

  branchSequence.forEach(({ branch, discs }, index) => {
    const branchStart = firstBranchStart + index * branchStartGap;
    const branchEl = svg.querySelector(`#${branch}`);
    if (branchEl) {
      branchEl.style.animationDelay = `${branchStart}s`;
    }

    const firstDiscAt =
      branchStart + branchGrowDuration + discAfterBranchOffset;
    discs.forEach((discId, discIndex) => {
      const discEl = svg.querySelector(`#${discId}`);
      if (!discEl) return;
      discEl.style.animationDelay = `${firstDiscAt + discIndex * discStagger}s`;
    });
  });
}

/**
 * Applique les délais d'animation séquencés du motif 6.
 * @param {HTMLElement} clone Clone motif 6.
 * @param {number} bloomDelay Délai de départ du cycle.
 */
function applyMotif6Sequence(clone, bloomDelay) {
  const svg = clone.querySelector("svg");
  if (!svg) return;

  const cycleDuration = getCycleDurationSeconds();
  const asCycle = (ratio) => cycleDuration * ratio;

  const disc1 = svg.querySelector("#disc1");
  const branch1 = svg.querySelector("#branch1");
  const branch2 = svg.querySelector("#branch2");
  const branch3 = svg.querySelector("#branch3");
  const disc2 = svg.querySelector("#disc2");
  const disc3 = svg.querySelector("#disc3");

  const branchGrowDuration = asCycle(0.035);
  const branch3Offset = asCycle(0.01);
  const discsOffset = asCycle(0.0125);
  const disc3Offset = asCycle(0.0075);

  const branch1Delay = bloomDelay + asCycle(0.0225);
  const branch2Delay = branch1Delay + branchGrowDuration;
  const branch3Delay = branch2Delay + branch3Offset;
  const discsDelay = branch3Delay + branchGrowDuration + discsOffset;

  if (disc1) disc1.style.animationDelay = `${bloomDelay}s`;
  if (branch1) branch1.style.animationDelay = `${branch1Delay}s`;
  if (branch2) branch2.style.animationDelay = `${branch2Delay}s`;
  if (branch3) branch3.style.animationDelay = `${branch3Delay}s`;
  if (disc2) disc2.style.animationDelay = `${discsDelay}s`;
  if (disc3) disc3.style.animationDelay = `${discsDelay + disc3Offset}s`;
}

/**
 * Réinitialise proprement l'état d'animation d'un clone puis relance sa séquence.
 * @param {HTMLElement} clone Clone à réinitialiser.
 * @param {number} motifIndex Index du motif du clone.
 */
function resetMotifCycleState(clone, motifIndex) {
  if (!clone || !clone.isConnected) return;

  const selectorsByMotif = {
    0: [
      "#branch1",
      "#branch2",
      "#branch3",
      "#branch4",
      "#branch5",
      "#disc2",
      "#disc3",
      "#disc4",
      "#disc5",
      "#disc6",
    ],
    1: ["#branch1", "#branch2", "#branch3", "#disc2", "#disc3", "#disc4"],
    2: [
      "#branch1",
      "#branch2",
      "#branch3",
      "#branch4",
      "#branch5",
      "#disc2",
      "#disc3",
      "#disc4",
      "#disc5",
      "#disc6",
    ],
    3: ["#branch1", "#branch2", "#branch3", "#disc2", "#disc3", "#disc4"],
    4: [
      "#branch1",
      "#branch2",
      "#branch3",
      "#branch4",
      "#branch5",
      "#branch6",
      "#branch7",
      "#branch8",
      "#branch9",
      "#disc2",
      "#disc3",
      "#disc4",
      "#disc5",
      "#disc6",
      "#disc7",
      "#disc8",
    ],
    5: ["#branch1", "#branch2", "#branch3", "#disc2", "#disc3"],
  };

  const selectors = selectorsByMotif[motifIndex] || [];
  const elements = selectors
    .map((selector) => clone.querySelector(selector))
    .filter(Boolean);

  if (elements.length === 0) return;

  elements.forEach((element) => {
    element.style.animation = "none";
  });

  void clone.offsetWidth;

  elements.forEach((element) => {
    element.style.animation = "";
  });

  if (motifIndex === 0) {
    applyMotif1Sequence(clone, 0);
  }

  if (motifIndex === 1) {
    applyMotif2Sequence(clone, 0);
  }

  if (motifIndex === 2) {
    applyMotif3Sequence(clone, 0);
  }

  if (motifIndex === 3) {
    applyMotif4Sequence(clone, 0);
  }

  if (motifIndex === 4) {
    applyMotif5Sequence(clone, 0);
  }

  if (motifIndex === 5) {
    applyMotif6Sequence(clone, 0);
  }
}

/**
 * Programme le reset cyclique d'un clone après sa première boucle.
 * @param {HTMLElement} clone Clone concerné.
 * @param {number} motifIndex Index du motif.
 * @param {number} bloomDelay Délai initial de séquence.
 */
function scheduleCloneCycleReset(clone, motifIndex, bloomDelay) {
  if (
    motifIndex !== 0 &&
    motifIndex !== 1 &&
    motifIndex !== 2 &&
    motifIndex !== 3 &&
    motifIndex !== 4 &&
    motifIndex !== 5
  )
    return;

  const cycleDuration = getCycleDurationSeconds();
  const cycleMs = cycleDuration * 1000;
  const firstResetDelayMs = (bloomDelay + cycleDuration) * 1000;

  cloneResetEntries.push({
    clone,
    motifIndex,
    cycleMs,
    nextResetAtMs: Date.now() + firstResetDelayMs,
  });

  ensureResetScheduler();
}

/**
 * Crée et initialise un clone complet (style, séquence, scheduling).
 * @param {number} index Index global du clone.
 * @param {number} motifIndex Index du motif source.
 * @param {number} bloomDelay Délai initial de la séquence.
 * @param {string} colorClass Classe couleur planifiée.
 * @returns {HTMLElement} Clone prêt à être placé.
 */
function createClone(index, motifIndex, bloomDelay, colorClass) {
  const clone = motifTemplates[motifIndex].cloneNode(true);
  clone.id = `motif-clone-${index}`;
  clone.classList.add(`motif-type-${motifIndex + 1}`);
  if (motifIndex === 5) clone.classList.add("motif-type-6");
  clone.dataset.motifIndex = String(motifIndex);
  clone.dataset.colorClass = colorClass || "";

  applyCloneBaseStyle(clone, bloomDelay, colorClass);
  bindCloneDebugHover(clone);

  if (motifIndex === 0 || clone.classList.contains("motif-type-1")) {
    applyMotif1Sequence(clone, bloomDelay);
  }

  if (motifIndex === 1 || clone.classList.contains("motif-type-2")) {
    applyMotif2Sequence(clone, bloomDelay);
  }

  if (motifIndex === 2 || clone.classList.contains("motif-type-3")) {
    applyMotif3Sequence(clone, bloomDelay);
  }

  if (motifIndex === 3 || clone.classList.contains("motif-type-4")) {
    applyMotif4Sequence(clone, bloomDelay);
  }

  if (motifIndex === 4 || clone.classList.contains("motif-type-5")) {
    applyMotif5Sequence(clone, bloomDelay);
  }

  if (motifIndex === 5 || clone.classList.contains("motif-type-6")) {
    applyMotif6Sequence(clone, bloomDelay);
  }

  scheduleCloneCycleReset(clone, motifIndex, bloomDelay);

  return clone;
}

/**
 * Génère un ensemble de clones et les place dans la zone pattern.
 * @param {number | null} [count=runtimeConfig.cloneCount] Nombre de clones demandé.
 */
function generateRandomMotifs(count = runtimeConfig.cloneCount) {
  clearCycleTimers();
  pattern.innerHTML = "";
  const { width: viewportWidth, height: viewportHeight } = getPatternViewport();
  const optimizedAutoMode =
    (!Number.isFinite(count) || count === 0) && runtimeConfig.density === 0;
  const targetCount = getBalancedCloneCount(
    count,
    viewportWidth,
    viewportHeight,
  );
  const { cols, rows } = getGridShape(
    targetCount,
    viewportWidth,
    viewportHeight,
  );
  const clonePlan = buildClonePlan(targetCount, cols);
  const clones = [];

  clonePlan.forEach((item, index) => {
    const bloomDelay = Math.random() * getCycleDurationSeconds();
    const clone = createClone(
      index,
      item.motifIndex,
      bloomDelay,
      item.colorClass,
    );
    clones.push(clone);
  });

  const placedClones = placeClonesPoissonConstrained(
    clones,
    viewportWidth,
    viewportHeight,
    {
      strictNoOverlap: optimizedAutoMode,
      enforceStyleAdjacency: true,
    },
  );
  placedClones.forEach((clone) => pattern.appendChild(clone));
}

/**
 * Affiche la vue multi-motifs (mode principal).
 */
function showAllMotifs() {
  pattern.classList.remove("single-view");
  generateRandomMotifs(runtimeConfig.cloneCount);
}

/**
 * Affiche un seul motif agrandi au centre.
 * @param {number} index Index du motif à afficher.
 */
function showSingleMotif(index) {
  clearCycleTimers();
  pattern.innerHTML = "";
  pattern.classList.add("single-view");

  const clone = motifTemplates[index].cloneNode(true);
  const width = parseFloat(clone.dataset.dimensionW);
  const height = parseFloat(clone.dataset.dimensionH);
  const singleScale = 2;
  const bloomDelay = 0;

  clone.classList.add(`motif-type-${index + 1}`);
  if (index === 5) clone.classList.add("motif-type-6");

  clone.style.setProperty("--bloom-delay", `${bloomDelay}s`);
  clone.style.setProperty("--animation-delay", "0s");
  clone.style.setProperty("--float-duration", "8s");
  clone.style.setProperty("--motif-left", "0px");
  clone.style.setProperty("--motif-top", "0px");
  bindCloneDebugHover(clone);

  if (index === 0) {
    applyMotif1Sequence(clone, bloomDelay);
  }

  if (index === 1) {
    applyMotif2Sequence(clone, bloomDelay);
  }

  if (index === 2) {
    applyMotif3Sequence(clone, bloomDelay);
  }

  if (index === 3) {
    applyMotif4Sequence(clone, bloomDelay);
  }

  if (index === 4) {
    applyMotif5Sequence(clone, bloomDelay);
  }

  if (index === 5) {
    applyMotif6Sequence(clone, bloomDelay);
  }

  scheduleCloneCycleReset(clone, index, bloomDelay);

  clone.id = "motif-single";
  clone.style.width = `${width * singleScale}px`;
  clone.style.height = `${height * singleScale}px`;
  pattern.appendChild(clone);
}

selector.addEventListener("change", (event) => {
  const value = event.target.value;
  if (value === "all") {
    showAllMotifs();
    return;
  }
  showSingleMotif(parseInt(value, 10));
});

window.addEventListener("DOMContentLoaded", () => {
  syncControlsInputsFromRuntime();
  setDebugMode();
  setControlsVisibility();
  showAllMotifs();
  bindControlsAutoApply();
});

window.addEventListener("resize", () => {
  if (resizeReflowTimerId !== null) {
    clearTimeout(resizeReflowTimerId);
  }

  resizeReflowTimerId = window.setTimeout(() => {
    resizeReflowTimerId = null;
    const value = selector.value;
    if (value === "all") {
      showAllMotifs();
      return;
    }
    showSingleMotif(parseInt(value, 10));
  }, 180);
});
