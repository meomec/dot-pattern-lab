const DEFAULT_GRID_SCALE = 0.25;
const DEFAULT_DENSITY = 0;
const selector = document.getElementById("motif-selector");
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

function parseCloneCountQuery(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseGridScale(value, fallbackValue) {
  const parsed = parseFloat(value || "");
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(1.2, Math.max(0.05, parsed));
}

function parseDensity(value, fallbackValue) {
  const parsed = parseFloat(value || "");
  if (!Number.isFinite(parsed)) return fallbackValue;
  return Math.min(1.2, Math.max(0, parsed));
}

function parseBooleanQuery(value, fallbackValue = false) {
  if (value == null) return fallbackValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallbackValue;
}

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
    queryParams.get("gridScale") || queryParams.get("scale"),
    DEFAULT_GRID_SCALE,
  ),
  density: parseDensity(
    queryParams.get("density") || queryParams.get("densite"),
    DEFAULT_DENSITY,
  ),
  colorMode: parseColorMode(
    queryParams.get("colorMode") ||
      queryParams.get("color") ||
      queryParams.get("couleur"),
  ),
  debugPlacement: parseBooleanQuery(queryParams.get("debug"), false),
  controlsVisibility: parseBooleanQuery(queryParams.get("controls"), false),
};

function setControlsVisibility() {
  const visibility = runtimeConfig.controlsVisibility;
  document.getElementById("controls")?.classList.toggle("on", visibility);
}

function getActiveColorClasses() {
  if (runtimeConfig.colorMode === "black") return ["black"];
  return colorClasses;
}

function getActiveColorWeight(colorClass) {
  if (runtimeConfig.colorMode === "black") {
    return colorClass === "black" ? 1 : 0;
  }
  return colorFrequencies[colorClass] || 0;
}

function clearCycleTimers() {
  cloneResetEntries.length = 0;
  if (resetSchedulerId !== null) {
    clearInterval(resetSchedulerId);
    resetSchedulerId = null;
  }
}

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

function getCycleDurationSeconds() {
  const rootStyles = getComputedStyle(document.documentElement);
  const raw = rootStyles.getPropertyValue("--cycle-duration");
  const seconds = parseDurationToSeconds(raw);

  if (!Number.isFinite(seconds) || seconds <= 0) return 20;
  return seconds;
}

function getWeightedRandomIndex() {
  const totalFrequency = frequencies.reduce((sum, value) => sum + value, 0);
  let random = Math.random() * totalFrequency;
  for (let i = 0; i < frequencies.length; i++) {
    random -= frequencies[i];
    if (random <= 0) return i;
  }
  return frequencies.length - 1;
}

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

function applyCloneBaseStyle(clone, bloomDelay, colorClass) {
  const cycleDuration = getCycleDurationSeconds();
  const randomDelay = Math.random() * (cycleDuration * 0.15);
  const randomDuration = cycleDuration * (0.5 + Math.random() * 0.3);
  const randomMirrorX = Math.random() < 0.5;
  const randomMirrorY = Math.random() < 0.5;
  const allowMirroring = !clone.classList.contains("motif-type-2");
  const assignedColorClass = colorClass || getWeightedRandomColorClass();
  const width = parseFloat(clone.dataset.dimensionW);
  const height = parseFloat(clone.dataset.dimensionH);

  clone.style.setProperty("--bloom-delay", `${bloomDelay}s`);
  clone.style.setProperty("--animation-delay", `${randomDelay}s`);
  clone.style.setProperty("--float-duration", `${randomDuration}s`);
  clone.style.setProperty("--motif-left", "0px");
  clone.style.setProperty("--motif-top", "0px");
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
  }
}

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

function getGridShape(targetCount, viewportWidth, viewportHeight) {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  const cols = Math.max(4, Math.round(Math.sqrt(targetCount * aspect)));
  const rows = Math.max(3, Math.ceil(targetCount / cols));
  return { cols, rows };
}

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
    if (sameColor && candidate.colorClass !== "black") return true;
  }
  return false;
}

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
      selectedPoint = {
        x: minX + Math.random() * (maxX - minX || 1),
        y: minY + Math.random() * (maxY - minY || 1),
        width,
        height,
        motifIndex,
        colorClass,
      };
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
    }
  });

  return placedClones;
}

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

function createClone(index, motifIndex, bloomDelay, colorClass) {
  const clone = motifTemplates[motifIndex].cloneNode(true);
  clone.id = `motif-clone-${index}`;
  clone.classList.add(`motif-type-${motifIndex + 1}`);
  if (motifIndex === 5) clone.classList.add("motif-type-6");
  clone.dataset.motifIndex = String(motifIndex);
  clone.dataset.colorClass = colorClass || "";

  applyCloneBaseStyle(clone, bloomDelay, colorClass);

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

function showAllMotifs() {
  pattern.classList.remove("single-view");
  generateRandomMotifs(runtimeConfig.cloneCount);
}

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
  if (runtimeConfig.debugPlacement) {
    document.body.dataset.debugPlacement = "true";
  }
  showAllMotifs();
  setControlsVisibility();
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
