const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star', 'hexagon'];
const SHAPE_COLORS = ['#00D4FF', '#7B61FF', '#00E676', '#FF4757', '#FFB74D', '#FF6EC7'];
const SYMBOLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface PatternQuestion {
  type: 'pattern';
  grid: { shape: string; color: string }[][];
  options: { shape: string; color: string }[];
  correctIndex: number;
  transformationCount: number;
  ruleHint: string;
  schemeName: string;
}

// Named rule schemes — each produces a distinct, learnable pattern logic
type PatternScheme =
  | 'rowCycle'    // Row offset controls shape; row index controls color
  | 'colColor'    // Column determines color; (row+col) determines shape
  | 'oddEven'     // Parity of (row+col) switches between two shape+color sets
  | 'rowCol'      // Row → shape, column → color independently
  | 'progressive' // Shapes count up reading left-to-right, top-to-bottom
  | 'diagonal'    // Diagonal cells share a distinct color
  | 'mirror'      // Right half mirrors left half with a color shift
  | 'layered';    // High-tier multi-rule compound system (tier 8+)

const SCHEME_HINTS: Record<PatternScheme, string> = {
  rowCycle:    'Each row cycles shapes in a different order',
  colColor:    'Each column has its own color',
  oddEven:     'Alternating positions follow different rules',
  rowCol:      'Row controls shape · column controls color',
  progressive: 'Shapes count up across the grid',
  diagonal:    'Diagonal cells share a special color',
  mirror:      'Right half mirrors left with a color change',
  layered:     'Multiple transformation rules active',
};

const SCHEME_LABELS: Record<PatternScheme, string> = {
  rowCycle:    'Row Cycle',
  colColor:    'Column Color',
  oddEven:     'Alternating',
  rowCol:      'Row × Column',
  progressive: 'Progressive',
  diagonal:    'Diagonal Rule',
  mirror:      'Mirror',
  layered:     'Multi-Layer',
};

export function generatePatternQuestion(patternTier: number, stagnationMode: string | null): PatternQuestion {
  const gridSize = patternTier >= 12 ? 4 : 3;
  const numShapes = Math.min(SHAPES.length, 2 + Math.floor(patternTier / 3));
  const numColors = Math.min(SHAPE_COLORS.length, 2 + Math.floor(patternTier / 4));
  const shapePool = pick(SHAPES, numShapes);
  const colorPool = pick(SHAPE_COLORS, numColors);

  // Schemes unlock progressively; at each tier multiple are available so
  // questions vary even at the same tier
  const available: PatternScheme[] = ['rowCycle'];
  if (patternTier >= 2) available.push('colColor');
  if (patternTier >= 3) available.push('oddEven');
  if (patternTier >= 4) available.push('rowCol');
  if (patternTier >= 5) available.push('mirror');
  if (patternTier >= 6) available.push('progressive');
  if (patternTier >= 7) available.push('diagonal');
  if (patternTier >= 8) available.push('layered');

  let scheme: PatternScheme;
  if (stagnationMode === 'variant' || stagnationMode === 'formatChange') {
    // Force a harder / different scheme when stagnating
    scheme = available[available.length - 1];
  } else {
    scheme = available[randInt(0, available.length - 1)];
  }

  const ruleHint = SCHEME_HINTS[scheme];
  const schemeName = SCHEME_LABELS[scheme];

  // ── Cell function for non-layered schemes ─────────────────────────────────
  const cellOf = (row: number, col: number): { shape: string; color: string } => {
    switch (scheme) {
      case 'rowCycle': {
        // Row determines the starting offset for shape cycling
        const sIdx = (row + col) % shapePool.length;
        const cIdx = row % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'colColor': {
        const sIdx = (row + col) % shapePool.length;
        const cIdx = col % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'oddEven': {
        // Even/odd parity of (row+col) picks from two distinct sets
        const parity = (row + col) % 2;
        const sIdx = parity === 0 ? 0 : Math.min(1, shapePool.length - 1);
        const cIdx = parity === 0 ? 0 : Math.min(1, colorPool.length - 1);
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'rowCol': {
        // Independent axes — row picks shape, col picks color
        const sIdx = row % shapePool.length;
        const cIdx = col % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'progressive': {
        // Shapes count forward reading left-to-right, top-to-bottom
        const step = row * gridSize + col;
        const sIdx = step % shapePool.length;
        const cIdx = row % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'diagonal': {
        // On the main diagonal (row===col) the color is special
        const sIdx = (row + col) % shapePool.length;
        const onDiag = row === col;
        const cIdx = onDiag
          ? Math.min(colorPool.length - 1, colorPool.length - 1)
          : (row + 1) % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      case 'mirror': {
        // Left half drives the rule; right half mirrors shape but shifts color by +1
        const mirrorCol = col >= Math.floor(gridSize / 2) ? gridSize - 1 - col : col;
        const sIdx = (row + mirrorCol) % shapePool.length;
        const cIdx = col >= Math.floor(gridSize / 2)
          ? (row + 1) % colorPool.length
          : row % colorPool.length;
        return { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
      default:
        return { shape: shapePool[0], color: colorPool[0] };
    }
  };

  // ── Build grid ─────────────────────────────────────────────────────────────
  const lastRow = gridSize - 1;
  const lastCol = gridSize - 1;

  let correct: { shape: string; color: string };
  let layerCount = 1;

  const grid: { shape: string; color: string }[][] = Array.from({ length: gridSize }, () =>
    Array(gridSize).fill({ shape: '?', color: '#5A5A68' })
  );

  if (scheme === 'layered') {
    // ── Original high-tier multi-rule system ──────────────────────────────
    layerCount = Math.min(6, 1 + Math.floor(patternTier / 3));
    const baseS = randInt(0, shapePool.length - 1);
    const baseC = randInt(0, colorPool.length - 1);

    const useRotation       = layerCount >= 1;
    const useColorShift     = layerCount >= 2;
    const useMirrorL        = layerCount >= 3;
    const useSubstitution   = layerCount >= 4;
    const useDiagonalL      = layerCount >= 5;
    const usePositionalShift = layerCount >= 6;

    for (let row = 0; row < gridSize; row++) {
      grid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        if (row === lastRow && col === lastCol) {
          grid[row][col] = { shape: '?', color: '#5A5A68' };
          continue;
        }
        let sIdx = baseS;
        let cIdx = baseC;
        if (useRotation) sIdx = (baseS + row + col) % shapePool.length;
        if (useColorShift) cIdx = (baseC + row) % colorPool.length;
        if (useMirrorL && col >= Math.floor(gridSize / 2)) sIdx = (sIdx + gridSize - col) % shapePool.length;
        if (useSubstitution && row % 2 === 1) sIdx = (sIdx + 1) % shapePool.length;
        if (useDiagonalL && row === col) cIdx = (cIdx + 2) % colorPool.length;
        if (usePositionalShift) cIdx = (baseC + row + col) % colorPool.length;
        if (stagnationMode === 'variant') sIdx = (sIdx + row * col) % shapePool.length;
        grid[row][col] = { shape: shapePool[sIdx], color: colorPool[cIdx] };
      }
    }

    let cSIdx = baseS;
    let cCIdx = baseC;
    if (useRotation) cSIdx = (baseS + lastRow + lastCol) % shapePool.length;
    if (useColorShift) cCIdx = (baseC + lastRow) % colorPool.length;
    if (useMirrorL && lastCol >= Math.floor(gridSize / 2)) cSIdx = (cSIdx + gridSize - lastCol) % shapePool.length;
    if (useSubstitution && lastRow % 2 === 1) cSIdx = (cSIdx + 1) % shapePool.length;
    if (useDiagonalL && lastRow === lastCol) cCIdx = (cCIdx + 2) % colorPool.length;
    if (usePositionalShift) cCIdx = (baseC + lastRow + lastCol) % colorPool.length;
    if (stagnationMode === 'variant') cSIdx = (cSIdx + lastRow * lastCol) % shapePool.length;
    correct = { shape: shapePool[cSIdx], color: colorPool[cCIdx] };
  } else {
    // ── Named scheme ──────────────────────────────────────────────────────
    for (let row = 0; row < gridSize; row++) {
      grid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        grid[row][col] = (row === lastRow && col === lastCol)
          ? { shape: '?', color: '#5A5A68' }
          : cellOf(row, col);
      }
    }
    correct = cellOf(lastRow, lastCol);
  }

  // ── Build PLAUSIBLE distractors ───────────────────────────────────────────
  // Always include:
  //   d1 — correct shape, wrong color  (tests if user tracked color)
  //   d2 — wrong shape, correct color  (tests if user tracked shape)
  //   d3 — wrong shape AND wrong color
  const options: { shape: string; color: string }[] = [correct];

  const altColor = colorPool.find(c => c !== correct.color)
    ?? SHAPE_COLORS.find(c => c !== correct.color)!;
  const altShape = shapePool.find(s => s !== correct.shape)
    ?? SHAPES.find(s => s !== correct.shape)!;

  const d1 = { shape: correct.shape, color: altColor };
  const d2 = { shape: altShape, color: correct.color };
  if (!options.find(o => o.shape === d1.shape && o.color === d1.color)) options.push(d1);
  if (!options.find(o => o.shape === d2.shape && o.color === d2.color)) options.push(d2);

  let attempts = 0;
  while (options.length < 4 && attempts < 60) {
    attempts++;
    const s = shapePool[randInt(0, shapePool.length - 1)];
    const c = colorPool[randInt(0, colorPool.length - 1)];
    if (!options.find(o => o.shape === s && o.color === c)) options.push({ shape: s, color: c });
  }
  while (options.length < 4) {
    options.push({ shape: SHAPES[options.length % SHAPES.length], color: SHAPE_COLORS[options.length % SHAPE_COLORS.length] });
  }

  const shuffled = shuffle(options.slice(0, 4));
  const correctIndex = shuffled.findIndex(o => o.shape === correct.shape && o.color === correct.color);

  return { type: 'pattern', grid, options: shuffled, correctIndex, transformationCount: layerCount, ruleHint, schemeName };
}

export interface MemoryQuestion {
  type: 'memory';
  sequence: { symbol: string; color: string }[];
  task: 'reverse' | 'sort' | 'filter' | 'swap' | 'removeAndReverse';
  taskDescription: string;
  options: string[][];
  correctIndex: number;
  displayTimeMs: number;
}

export function generateMemoryQuestion(memorySpan: number, memoryTier: number, stagnationMode: string | null): MemoryQuestion {
  const baseSpan = memorySpan + (stagnationMode === 'variant' ? 1 : 0);
  const tierBonus = Math.floor(memoryTier / 5);
  const count = Math.min(10, baseSpan + tierBonus);
  const selectedSymbols = pick(SYMBOLS, count);
  const selectedColors = selectedSymbols.map(() => SHAPE_COLORS[randInt(0, SHAPE_COLORS.length - 1)]);
  const sequence = selectedSymbols.map((s, i) => ({ symbol: s, color: selectedColors[i] }));

  const reverseDescs = ['Select the REVERSE order', 'Choose the sequence in backwards order', 'Reorder from last to first'];
  const sortDescs = ['Select the SORTED order (A-Z)', 'Arrange alphabetically and select', 'Choose the A-to-Z sequence'];
  const filterDescs = ['Select only the ODD-positioned items (1st, 3rd, 5th, etc.)', 'Keep positions 1, 3, 5... and drop the rest', 'Pick every other item starting at position 1'];
  const swapDescs = ['Swap the first and last, then select', 'Exchange first and last items, then pick the result', 'Switch the first and last positions'];
  const removeDescs = ['Remove the middle item, then reverse', 'Drop the center element, then reverse the rest', 'Eliminate the middle, then flip the order'];

  const availableTasks: { task: MemoryQuestion['task']; desc: string }[] = [
    { task: 'reverse', desc: reverseDescs[randInt(0, reverseDescs.length - 1)] },
  ];
  if (memoryTier >= 3) availableTasks.push({ task: 'sort', desc: sortDescs[randInt(0, sortDescs.length - 1)] });
  if (memoryTier >= 5) availableTasks.push({ task: 'filter', desc: filterDescs[randInt(0, filterDescs.length - 1)] });
  if (memoryTier >= 7) availableTasks.push({ task: 'swap', desc: swapDescs[randInt(0, swapDescs.length - 1)] });
  if (memoryTier >= 10) availableTasks.push({ task: 'removeAndReverse', desc: removeDescs[randInt(0, removeDescs.length - 1)] });

  if (stagnationMode === 'formatChange' && availableTasks.length > 1) {
    availableTasks.reverse();
  }

  const chosen = availableTasks[randInt(0, availableTasks.length - 1)];

  let correctAnswer: string[];
  switch (chosen.task) {
    case 'reverse':
      correctAnswer = [...selectedSymbols].reverse();
      break;
    case 'sort':
      correctAnswer = [...selectedSymbols].sort();
      break;
    case 'filter':
      correctAnswer = selectedSymbols.filter((_, i) => i % 2 === 0);
      break;
    case 'swap': {
      const swapped = [...selectedSymbols];
      if (swapped.length >= 2) {
        [swapped[0], swapped[swapped.length - 1]] = [swapped[swapped.length - 1], swapped[0]];
      }
      correctAnswer = swapped;
      break;
    }
    case 'removeAndReverse': {
      const mid = Math.floor(selectedSymbols.length / 2);
      const removed = selectedSymbols.filter((_, i) => i !== mid);
      correctAnswer = removed.reverse();
      break;
    }
    default:
      correctAnswer = [...selectedSymbols].reverse();
  }

  const options: string[][] = [correctAnswer];
  let attempts = 0;
  while (options.length < 4 && attempts < 50) {
    attempts++;
    const wrong = [...correctAnswer];
    const swapCount = randInt(1, Math.min(3, wrong.length - 1));
    for (let s = 0; s < swapCount; s++) {
      const i = randInt(0, wrong.length - 2);
      [wrong[i], wrong[i + 1]] = [wrong[i + 1], wrong[i]];
    }
    if (!options.find(o => JSON.stringify(o) === JSON.stringify(wrong))) {
      options.push(wrong);
    }
  }
  while (options.length < 4) {
    options.push(shuffle([...correctAnswer]));
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(o => JSON.stringify(o) === JSON.stringify(correctAnswer));

  // Level 1–10: at least 7s so new users can view the sequence. Higher tiers scale down.
  const stagnationBonus = stagnationMode === 'timerCompress' ? -500 : 0;
  const displayTimeMs =
    memoryTier <= 10
      ? Math.max(6500, 7000 + stagnationBonus)
      : Math.max(600, 7000 - (memoryTier - 10) * 250 + stagnationBonus);

  return {
    type: 'memory',
    sequence,
    task: chosen.task,
    taskDescription: chosen.desc,
    options: shuffled,
    correctIndex,
    displayTimeMs,
  };
}

export interface RuleMutationQuestion {
  type: 'ruleMutation';
  startValue: number;
  currentRule: string;
  ruleDescription: string;
  options: number[];
  correctIndex: number;
  ruleChanged: boolean;
  ruleIndex: number;
}

interface Rule {
  desc: string;
  apply: (n: number) => number;
}

const RULE_VARIANTS: { desc: string; apply: (n: number) => number }[][] = [
  [{ desc: 'Add 3', apply: n => n + 3 }, { desc: 'Plus 3', apply: n => n + 3 }],
  [{ desc: 'Multiply by 2', apply: n => n * 2 }, { desc: 'Double it', apply: n => n * 2 }],
  [{ desc: 'Subtract 4', apply: n => n - 4 }, { desc: 'Minus 4', apply: n => n - 4 }],
  [{ desc: 'Add 7', apply: n => n + 7 }, { desc: 'Plus 7', apply: n => n + 7 }],
  [{ desc: 'Multiply by 3', apply: n => n * 3 }, { desc: 'Triple it', apply: n => n * 3 }],
  [{ desc: 'Double and add 1', apply: n => n * 2 + 1 }, { desc: '2× then +1', apply: n => n * 2 + 1 }],
  [{ desc: 'Square root (round down)', apply: n => Math.floor(Math.sqrt(Math.abs(n))) }, { desc: '√n, floor', apply: n => Math.floor(Math.sqrt(Math.abs(n))) }],
  [{ desc: 'Add 11 then halve', apply: n => Math.floor((n + 11) / 2) }, { desc: '(n+11)/2, floor', apply: n => Math.floor((n + 11) / 2) }],
  [{ desc: 'Triple and subtract 5', apply: n => n * 3 - 5 }, { desc: '3× minus 5', apply: n => n * 3 - 5 }],
  [{ desc: 'If even halve, if odd triple', apply: n => n % 2 === 0 ? n / 2 : n * 3 }, { desc: 'Even→÷2, odd→×3', apply: n => n % 2 === 0 ? n / 2 : n * 3 }],
  [{ desc: 'Multiply by 2 then add digits', apply: n => { const d = n * 2; return d + Math.floor(d / 10) + (d % 10); } }, { desc: '2× then sum of digits', apply: n => { const d = n * 2; return d + Math.floor(d / 10) + (d % 10); } }],
  [{ desc: 'Add digits of n', apply: n => Math.abs(n).toString().split('').reduce((s, c) => s + parseInt(c, 10), 0) }, { desc: 'Sum of digits', apply: n => Math.abs(n).toString().split('').reduce((s, c) => s + parseInt(c, 10), 0) }],
  [{ desc: 'If n>5 add 2, else subtract 2', apply: n => n > 5 ? n + 2 : n - 2 }, { desc: '>5 then +2, else −2', apply: n => n > 5 ? n + 2 : n - 2 }],
  [{ desc: 'n² mod 20', apply: n => ((n * n) % 20 + 20) % 20 }, { desc: 'Square, mod 20', apply: n => ((n * n) % 20 + 20) % 20 }],
];

function pickRuleVariant(idx: number): Rule {
  const v = RULE_VARIANTS[idx][randInt(0, RULE_VARIANTS[idx].length - 1)];
  return { desc: v.desc, apply: v.apply };
}

function getRulesForTier(tier: number): Rule[] {
  const rules: Rule[] = [
    pickRuleVariant(0),
    pickRuleVariant(1),
    pickRuleVariant(2),
    pickRuleVariant(3),
  ];
  if (tier >= 3) {
    rules.push(pickRuleVariant(4));
    rules.push(pickRuleVariant(5));
  }
  if (tier >= 6) {
    rules.push(pickRuleVariant(6));
    rules.push(pickRuleVariant(7));
  }
  if (tier >= 9) {
    rules.push(pickRuleVariant(8));
    rules.push(pickRuleVariant(9));
  }
  if (tier >= 12) {
    rules.push(pickRuleVariant(10));
    rules.push(pickRuleVariant(11));
  }
  if (tier >= 15) {
    rules.push(pickRuleVariant(12));
    rules.push(pickRuleVariant(13));
  }
  return rules;
}

export function generateRuleMutationQuestion(
  speedTier: number,
  questionIndex: number,
  previousRuleIdx: number | undefined,
  stagnationMode: string | null,
): RuleMutationQuestion {
  const rules = getRulesForTier(speedTier);
  const ruleChangeFrequency = Math.max(2, 5 - Math.floor(speedTier / 3));
  const ruleChanged = questionIndex > 0 && questionIndex % ruleChangeFrequency === 0;
  const forceChange = stagnationMode === 'variant' && questionIndex > 0 && questionIndex % 2 === 0;

  let ruleIdx: number;
  if (ruleChanged || forceChange || previousRuleIdx === undefined) {
    do {
      ruleIdx = randInt(0, rules.length - 1);
    } while (ruleIdx === previousRuleIdx && rules.length > 1);
  } else {
    ruleIdx = previousRuleIdx;
  }

  const rule = rules[ruleIdx];
  const startValue = randInt(2, 5 + speedTier);
  const correctAnswer = rule.apply(startValue);

  const options: number[] = [correctAnswer];
  let attempts = 0;
  while (options.length < 4 && attempts < 50) {
    attempts++;
    const offset = randInt(1, Math.max(3, Math.floor(Math.abs(correctAnswer) * 0.3) + 1));
    const sign = Math.random() > 0.5 ? 1 : -1;
    const wrong = correctAnswer + offset * sign;
    if (!options.includes(wrong)) {
      options.push(wrong);
    }
  }
  while (options.length < 4) {
    options.push(correctAnswer + options.length * 2);
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(n => n === correctAnswer);

  return {
    type: 'ruleMutation',
    startValue,
    currentRule: ruleIdx.toString(),
    ruleDescription: (ruleChanged || forceChange) ? `New Rule! ${rule.desc}` : rule.desc,
    options: shuffled,
    correctIndex,
    ruleChanged: ruleChanged || forceChange,
    ruleIndex: ruleIdx,
  };
}

export interface DualTaskQuestion {
  type: 'dualTask';
  visualTask: {
    sequence: string[];
    missingIndex: number;
    options: string[];
    correctIndex: number;
  };
  countingTask: {
    targetColor: string;
    flashes: string[];
    correctCount: number;
    options: number[];
    correctIndex: number;
  };
  distractorEnabled: boolean;
}

export function generateDualTaskQuestion(flexTier: number, stagnationMode: string | null): DualTaskQuestion {
  const seqLength = Math.min(8, 4 + Math.floor(flexTier / 3));
  const baseShapes = pick(SHAPES, Math.min(6, 2 + Math.floor(flexTier / 4)));

  const visualSeq: string[] = [];
  // How many learnable pattern types to offer grows with tier
  const maxPattern = flexTier >= 8 ? 4 : flexTier >= 5 ? 3 : flexTier >= 3 ? 2 : 1;
  const patternType = randInt(0, maxPattern);

  if (patternType === 0) {
    // Simple n-cycle: A B C A B C …
    for (let i = 0; i < seqLength; i++) {
      visualSeq.push(baseShapes[i % baseShapes.length]);
    }
  } else if (patternType === 1) {
    // Alternating pairs: A A B B A A B B …  (uses first 2 shapes)
    const a = baseShapes[0];
    const b = baseShapes[Math.min(1, baseShapes.length - 1)];
    for (let i = 0; i < seqLength; i++) {
      visualSeq.push(Math.floor(i / 2) % 2 === 0 ? a : b);
    }
  } else if (patternType === 2) {
    // Interleaved anchor: shape A at every even index, other shapes cycle at odd indices
    // e.g. A B A C A D A B … — rule is clearly "A comes back every other step"
    const anchor = baseShapes[0];
    const rest = baseShapes.slice(1);
    let restIdx = 0;
    for (let i = 0; i < seqLength; i++) {
      if (i % 2 === 0) {
        visualSeq.push(anchor);
      } else {
        visualSeq.push(rest[restIdx % Math.max(1, rest.length)]);
        restIdx++;
      }
    }
  } else if (patternType === 3) {
    // Growing blocks: 1× shape A, 2× shape B, 3× shape C, then wrap
    // e.g. A B B C C C A B B …
    let blockShape = 0;
    let blockSize = 1;
    let filled = 0;
    for (let i = 0; i < seqLength; i++) {
      visualSeq.push(baseShapes[blockShape % baseShapes.length]);
      filled++;
      if (filled >= blockSize) {
        blockShape++;
        blockSize++;
        filled = 0;
        if (blockSize > 3) { blockShape = 0; blockSize = 1; }
      }
    }
  } else {
    // Reverse n-cycle: C B A C B A … (descending through pool)
    for (let i = 0; i < seqLength; i++) {
      visualSeq.push(baseShapes[(baseShapes.length - 1 - (i % baseShapes.length))]);
    }
  }
  const missingIndex = seqLength - 1;
  const correctShape = visualSeq[missingIndex];
  visualSeq[missingIndex] = '?';

  const wrongShapes = SHAPES.filter(s => s !== correctShape);
  const visualOptions = shuffle([correctShape, ...pick(wrongShapes, Math.min(3, wrongShapes.length))]);
  while (visualOptions.length < 4) visualOptions.push(SHAPES[visualOptions.length]);
  const visualCorrectIndex = visualOptions.indexOf(correctShape);

  const targetColor = SHAPE_COLORS[randInt(0, SHAPE_COLORS.length - 1)];
  const flashCount = Math.min(14, 5 + Math.floor(flexTier / 2) + (flexTier >= 10 ? 2 : 0));
  const flashes: string[] = [];
  let targetCount = randInt(1, Math.min(5, Math.floor(flashCount / 2)));
  const targetCountTarget = targetCount;

  for (let i = 0; i < flashCount; i++) {
    if (targetCount > 0 && (Math.random() > 0.5 || flashCount - i <= targetCount)) {
      flashes.push(targetColor);
      targetCount--;
    } else {
      const otherColors = SHAPE_COLORS.filter(c => c !== targetColor);
      flashes.push(otherColors[randInt(0, otherColors.length - 1)]);
    }
  }
  const correctCount = flashes.filter(f => f === targetColor).length;

  // Spread options symmetrically: -2, -1, correct, +1
  const countOptionsSet = new Set([correctCount]);
  countOptionsSet.add(Math.max(0, correctCount - 1));
  countOptionsSet.add(correctCount + 1);
  countOptionsSet.add(Math.max(0, correctCount - 2));
  if (countOptionsSet.size < 4) countOptionsSet.add(correctCount + 2);
  const countOptions = shuffle([...countOptionsSet]).slice(0, 4);
  const countCorrectIndex = countOptions.indexOf(correctCount);

  const distractorEnabled = flexTier >= 6 || stagnationMode === 'variant';

  return {
    type: 'dualTask',
    visualTask: {
      sequence: visualSeq,
      missingIndex,
      options: visualOptions,
      correctIndex: visualCorrectIndex,
    },
    countingTask: {
      targetColor,
      flashes,
      correctCount,
      options: countOptions,
      correctIndex: countCorrectIndex,
    },
    distractorEnabled,
  };
}

export interface RapidLogicQuestion {
  type: 'rapidLogic';
  question: string;
  options: string[];
  correctIndex: number;
  timerSeconds: number;
}

const LOGIC_POOLS: Record<string, { q: string; options: string[]; correct: number }[]> = {
  easy: [
    { q: 'All cats are animals. Some animals are pets. Are all cats pets?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If it rains, the ground gets wet. The ground is wet. Did it rain?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'All squares are rectangles. This shape is a rectangle. Is it a square?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'No fish can fly. A penguin is not a fish. Can a penguin fly?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If A > B and B > C, is A > C?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'All dogs bark. Rex is a dog. Does Rex bark?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'If all A are B and all B are C, are all A also C?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'No plants are animals. A rose is a plant. Is a rose an animal?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'If X = 5 and Y = X + 3, what is Y?', options: ['5', '8', '3'], correct: 1 },
    { q: 'Some birds swim. All penguins are birds. Do all penguins swim?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If it is Monday, then it is a weekday. It is a weekday. Is it Monday?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'All tigers are striped. Leo is striped. Is Leo a tiger?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'All books have pages. This has pages. Is it a book?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If A = B and B = C, is A = C?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'All mammals breathe air. A whale is a mammal. Does it breathe air?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'Some fruits are red. All apples are fruits. Are all apples red?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If the door is open, air flows. Air is flowing. Is the door open?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'All vehicles have wheels. A boat has no wheels. Is a boat a vehicle?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'If Z = 10 and W = Z − 4, what is W?', options: ['10', '6', '14'], correct: 1 },
    { q: 'No reptiles are warm-blooded. A snake is a reptile. Is it warm-blooded?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
  ],
  medium: [
    { q: 'If some A are B and no B are C, can any A be C?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'All roses are flowers. Some flowers fade quickly. Do all roses fade quickly?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If P implies Q, and Q is false, what about P?', options: ['P is true', 'P is false', 'Cannot determine'], correct: 1 },
    { q: 'If all X are Y, and some Z are X, are some Z also Y?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'A is taller than B. C is shorter than B. Who is tallest?', options: ['A', 'B', 'C'], correct: 0 },
    { q: 'If not all heroes wear capes, and John wears a cape, is John a hero?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'Every circle is round. This object is round. Is it a circle?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If A or B is true, and A is false, what about B?', options: ['True', 'False', 'Cannot determine'], correct: 0 },
    { q: 'Some doctors are tall. All tall people can reach high shelves. Can some doctors reach high shelves?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'No mammals lay eggs (exception: monotremes). A platypus is a monotreme. Does it lay eggs?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
    { q: 'If the lamp is on, the room is bright. The room is dark. Is the lamp on?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'All efficient workers finish early. Sam finished early. Is Sam efficient?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'Some musicians play piano. All pianists are musicians. Do all musicians play piano?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If M > N and N > O and O > P, which is smallest?', options: ['M', 'N', 'P'], correct: 2 },
    { q: 'All metals conduct electricity. Wood is not a metal. Does wood conduct?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If (A and B) then C. C is true. What do we know?', options: ['A and B are true', 'At least one is true', 'Cannot determine'], correct: 2 },
    { q: 'Some athletes run. All runners are fit. Are all athletes fit?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If X implies Y, and X is false, what about Y?', options: ['Y is true', 'Y is false', 'Cannot determine'], correct: 2 },
  ],
  hard: [
    { q: 'If all A are B, and no C are B, but some D are C, can any D be A?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'If P implies Q, and R implies not Q, and R is true, what is P?', options: ['True', 'False', 'Cannot determine'], correct: 1 },
    { q: 'All M are N. Some N are O. No O are P. Can any M be P?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If (A and B) implies C, and C is false, what do we know?', options: ['A is false', 'B is false', 'At least one of A or B is false'], correct: 2 },
    { q: 'No S are T. All T are U. Some U are V. Can any S be V?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If all poets are dreamers and some dreamers are realists, are some poets realists?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
    { q: 'If A then B. If B then C. If not C, then what?', options: ['Not A and not B', 'Not A only', 'Cannot determine'], correct: 0 },
    { q: 'If exactly one of P, Q, R is true, and P implies Q, which must be true?', options: ['P', 'Q', 'R'], correct: 2 },
    { q: 'All X who are Y are also Z. Some W are X but not Y. Can W be Z?', options: ['Yes, always', 'No, never', 'Cannot determine'], correct: 2 },
    { q: 'If no A are B, and all C are A, can any C be B?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'A > B, C > D, B > C. Rank greatest to least.', options: ['A, B, C, D', 'A, C, B, D', 'Cannot determine'], correct: 0 },
    { q: 'If (P or Q) and (not P or R), and Q is false, what must be true?', options: ['P and R', 'R only', 'Cannot determine'], correct: 0 },
    { q: 'All P are Q. No Q are R. Some S are R. Can any S be P?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
    { q: 'If A→B, B→C, C→D, and A is true, what about D?', options: ['D is true', 'D is false', 'Cannot determine'], correct: 0 },
    { q: 'Exactly two of X, Y, Z are true. X implies Y. Y is false. Which are true?', options: ['X and Z', 'Y and Z', 'X and Y'], correct: 0 },
    { q: 'All G are H. Some H are J. No J are K. Can any G be K?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  ],
};

const ANALOGY_POOLS: Record<string, { q: string; options: string[]; correct: number }[]> = {
  easy: [
    { q: 'Hand → Glove  |  Foot → ___', options: ['Shoe', 'Leg', 'Floor', 'Sock'], correct: 0 },
    { q: 'Bird → Fly  |  Fish → ___', options: ['Swim', 'Jump', 'Run', 'Breathe'], correct: 0 },
    { q: 'Doctor → Hospital  |  Teacher → ___', options: ['School', 'Student', 'Book', 'Desk'], correct: 0 },
    { q: 'Hot → Cold  |  Day → ___', options: ['Night', 'Sun', 'Warm', 'Sky'], correct: 0 },
    { q: 'Pen → Write  |  Knife → ___', options: ['Cut', 'Cook', 'Draw', 'Point'], correct: 0 },
    { q: 'Author → Book  |  Composer → ___', options: ['Symphony', 'Piano', 'Orchestra', 'Sound'], correct: 0 },
    { q: 'Tree → Forest  |  Star → ___', options: ['Galaxy', 'Sky', 'Planet', 'Space'], correct: 0 },
    { q: 'Eye → See  |  Ear → ___', options: ['Hear', 'Touch', 'Smell', 'Taste'], correct: 0 },
    { q: 'Clock → Time  |  Ruler → ___', options: ['Length', 'Weight', 'Speed', 'Area'], correct: 0 },
    { q: 'Cup → Drink  |  Plate → ___', options: ['Eat', 'Cook', 'Serve', 'Pour'], correct: 0 },
    { q: 'Child → Adult  |  Seed → ___', options: ['Tree', 'Flower', 'Leaf', 'Root'], correct: 0 },
    { q: 'Hammer → Nail  |  Key → ___', options: ['Lock', 'Door', 'Open', 'Metal'], correct: 0 },
  ],
  medium: [
    { q: 'Affluent → Poor  |  Courageous → ___', options: ['Cowardly', 'Brave', 'Bold', 'Strong'], correct: 0 },
    { q: 'Surgeon → Scalpel  |  Painter → ___', options: ['Brush', 'Canvas', 'Palette', 'Art'], correct: 0 },
    { q: 'Prologue → Epilogue  |  Introduction → ___', options: ['Conclusion', 'Beginning', 'Chapter', 'Index'], correct: 0 },
    { q: 'Harmony → Discord  |  Order → ___', options: ['Chaos', 'Pattern', 'Rule', 'System'], correct: 0 },
    { q: 'Barometer → Pressure  |  Thermometer → ___', options: ['Temperature', 'Heat', 'Weather', 'Liquid'], correct: 0 },
    { q: 'Elegy → Mourning  |  Hymn → ___', options: ['Worship', 'Sadness', 'Joy', 'Music'], correct: 0 },
    { q: 'Myopic → Near  |  Hyperopic → ___', options: ['Far', 'Blind', 'Focused', 'Clear'], correct: 0 },
    { q: 'Chronicle → Events  |  Biography → ___', options: ['Life', 'History', 'Fiction', 'Place'], correct: 0 },
    { q: 'General → Army  |  Captain → ___', options: ['Ship', 'Team', 'Crew', 'Plane'], correct: 0 },
    { q: 'Mitigate → Worsen  |  Clarity → ___', options: ['Confusion', 'Vision', 'Clearness', 'Light'], correct: 0 },
  ],
  hard: [
    { q: 'Sycophant → Flatter  |  Iconoclast → ___', options: ['Challenge', 'Support', 'Create', 'Praise'], correct: 0 },
    { q: 'Laconic → Verbose  |  Lucid → ___', options: ['Opaque', 'Clear', 'Brief', 'Bright'], correct: 0 },
    { q: 'Catalyst → Reaction  |  Incentive → ___', options: ['Action', 'Reward', 'Cause', 'Result'], correct: 0 },
    { q: 'Parochial → Cosmopolitan  |  Temporal → ___', options: ['Eternal', 'Worldly', 'Brief', 'Local'], correct: 0 },
    { q: 'Ephemeral → Permanent  |  Tacit → ___', options: ['Explicit', 'Silent', 'Quiet', 'Hidden'], correct: 0 },
    { q: 'Obfuscate → Clarify  |  Exacerbate → ___', options: ['Alleviate', 'Worsen', 'Cause', 'Ignore'], correct: 0 },
  ],
};

const NUMBER_SERIES_POOLS: Record<string, { q: string; options: string[]; correct: number; rule: string }[]> = {
  easy: [
    { q: '2, 4, 6, 8, ___', options: ['10', '9', '12', '11'], correct: 0, rule: '+2' },
    { q: '5, 10, 15, 20, ___', options: ['25', '22', '24', '30'], correct: 0, rule: '+5' },
    { q: '100, 90, 80, 70, ___', options: ['60', '50', '65', '55'], correct: 0, rule: '−10' },
    { q: '1, 2, 4, 8, ___', options: ['16', '12', '14', '10'], correct: 0, rule: '×2' },
    { q: '1, 4, 9, 16, ___', options: ['25', '20', '24', '36'], correct: 0, rule: 'n²' },
    { q: '3, 6, 12, 24, ___', options: ['48', '36', '42', '44'], correct: 0, rule: '×2' },
    { q: '10, 8, 6, 4, ___', options: ['2', '0', '3', '1'], correct: 0, rule: '−2' },
    { q: '1, 3, 5, 7, ___', options: ['9', '8', '10', '11'], correct: 0, rule: '+2 (odd)' },
    { q: '2, 6, 18, 54, ___', options: ['162', '108', '144', '180'], correct: 0, rule: '×3' },
    { q: '50, 45, 40, 35, ___', options: ['30', '25', '32', '28'], correct: 0, rule: '−5' },
  ],
  medium: [
    { q: '1, 1, 2, 3, 5, 8, ___', options: ['13', '11', '10', '12'], correct: 0, rule: 'Fibonacci' },
    { q: '2, 5, 10, 17, 26, ___', options: ['37', '33', '35', '39'], correct: 0, rule: 'n²+1' },
    { q: '1, 2, 4, 7, 11, 16, ___', options: ['22', '20', '18', '24'], correct: 0, rule: '+1,+2,+3…' },
    { q: '4, 7, 11, 18, 29, ___', options: ['47', '43', '40', '45'], correct: 0, rule: 'a+b=next' },
    { q: '1, 1, 2, 6, 24, ___', options: ['120', '48', '100', '96'], correct: 0, rule: 'n!' },
    { q: '3, 7, 15, 31, 63, ___', options: ['127', '112', '120', '124'], correct: 0, rule: '2n+1' },
    { q: '81, 27, 9, 3, ___', options: ['1', '2', '0', '3'], correct: 0, rule: '÷3' },
    { q: '1, 3, 7, 13, 21, ___', options: ['31', '29', '33', '27'], correct: 0, rule: '+2,+4,+6…' },
    { q: '2, 3, 5, 7, 11, 13, ___', options: ['17', '15', '19', '14'], correct: 0, rule: 'Primes' },
    { q: '0, 1, 3, 6, 10, ___', options: ['15', '13', '14', '16'], correct: 0, rule: 'Triangular' },
  ],
  hard: [
    { q: '1, 8, 27, 64, 125, ___', options: ['216', '196', '180', '210'], correct: 0, rule: 'n³' },
    { q: '2, 6, 12, 20, 30, 42, ___', options: ['56', '50', '54', '48'], correct: 0, rule: 'n(n+1)' },
    { q: '1, 2, 6, 24, 120, ___', options: ['720', '600', '480', '360'], correct: 0, rule: 'n!' },
    { q: '1, 5, 14, 30, 55, ___', options: ['91', '84', '77', '70'], correct: 0, rule: 'Pyramid' },
    { q: '2, 3, 5, 11, 17, 41, ___', options: ['83', '71', '59', '67'], correct: 0, rule: 'Twin primes' },
    { q: '1, 3, 6, 10, 15, 21, 28, ___', options: ['36', '35', '30', '33'], correct: 0, rule: 'Triangular n' },
  ],
};

export function generateRapidLogicQuestion(
  dualTier: number,
  timerMultiplier: number,
  stagnationMode: string | null,
): RapidLogicQuestion {
  const baseTimer = dualTier <= 4 ? 10 : dualTier <= 9 ? 8 : 6;
  const timerSeconds = Math.max(4, Math.round(baseTimer * timerMultiplier));

  // Mix question types based on tier: higher tiers get more variety
  const rand = Math.random();
  const analogyChance = dualTier >= 3 ? 0.3 : 0;
  const seriesChance = dualTier >= 3 ? 0.3 : 0;

  if (rand < analogyChance) {
    // Verbal Analogy
    const pool = dualTier <= 5 ? ANALOGY_POOLS.easy : dualTier <= 12 ? ANALOGY_POOLS.medium : ANALOGY_POOLS.hard;
    const q = pool[randInt(0, pool.length - 1)];
    return { type: 'rapidLogic', question: q.q, options: q.options, correctIndex: q.correct, timerSeconds };
  }

  if (rand < analogyChance + seriesChance) {
    // Number Series
    const pool = dualTier <= 5 ? NUMBER_SERIES_POOLS.easy : dualTier <= 12 ? NUMBER_SERIES_POOLS.medium : NUMBER_SERIES_POOLS.hard;
    const q = pool[randInt(0, pool.length - 1)];
    return { type: 'rapidLogic', question: q.q, options: q.options, correctIndex: q.correct, timerSeconds };
  }

  // Classic syllogism / logic
  let pool: { q: string; options: string[]; correct: number }[];
  if (dualTier <= 4) pool = LOGIC_POOLS.easy;
  else if (dualTier <= 9) pool = [...LOGIC_POOLS.easy.slice(-4), ...LOGIC_POOLS.medium];
  else pool = [...LOGIC_POOLS.medium.slice(-4), ...LOGIC_POOLS.hard];

  if (stagnationMode === 'variant' && dualTier <= 9) {
    pool = [...pool, ...LOGIC_POOLS.hard.slice(0, 5)];
  }

  const q = pool[randInt(0, pool.length - 1)];
  return {
    type: 'rapidLogic',
    question: q.q,
    options: q.options,
    correctIndex: q.correct,
    timerSeconds,
  };
}

// ─── Raven's Matrix (explicit rule-based, IQ-style) ───────────────────────────

export type RavenRule = 'rotation' | 'colorShift' | 'mirror' | 'substitution' | 'diagonal' | 'positionalShift';

export interface RavenMatrixQuestion {
  type: 'ravenMatrix';
  grid: { shape: string; color: string }[][];
  options: { shape: string; color: string }[];
  correctIndex: number;
  ruleCount: number;
  rules: RavenRule[];
}

export function generateRavenMatrix(patternTier: number): RavenMatrixQuestion {
  // Always 3x3 grid (Raven's standard)
  const GRID_SIZE = 3;
  const ruleCount = Math.min(5, 1 + Math.floor(patternTier / 8));
  const rulesPool: RavenRule[] = ['rotation', 'colorShift', 'mirror', 'substitution', 'diagonal', 'positionalShift'];
  const activeRules: RavenRule[] = rulesPool.slice(0, ruleCount);

  const shapePool = pick(SHAPES, Math.min(SHAPES.length, 3 + Math.floor(patternTier / 12)));
  const colorPool = pick(SHAPE_COLORS, Math.min(SHAPE_COLORS.length, 3 + Math.floor(patternTier / 15)));
  const baseS = randInt(0, shapePool.length - 1);
  const baseC = randInt(0, colorPool.length - 1);

  const grid: { shape: string; color: string }[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_SIZE; col++) {
      if (row === GRID_SIZE - 1 && col === GRID_SIZE - 1) {
        grid[row][col] = { shape: '?', color: '#5A5A68' };
        continue;
      }
      let sIdx = baseS;
      let cIdx = baseC;
      if (activeRules.includes('rotation')) sIdx = (baseS + row + col) % shapePool.length;
      if (activeRules.includes('colorShift')) cIdx = (baseC + row) % colorPool.length;
      if (activeRules.includes('mirror') && col >= 1) sIdx = (sIdx + GRID_SIZE - col) % shapePool.length;
      if (activeRules.includes('substitution') && row % 2 === 1) sIdx = (sIdx + 1) % shapePool.length;
      if (activeRules.includes('diagonal') && row === col) cIdx = (cIdx + 2) % colorPool.length;
      if (activeRules.includes('positionalShift')) cIdx = (baseC + row + col) % colorPool.length;
      grid[row][col] = { shape: shapePool[sIdx], color: colorPool[cIdx] };
    }
  }

  const lr = GRID_SIZE - 1;
  const lc = GRID_SIZE - 1;
  let cSIdx = baseS;
  let cCIdx = baseC;
  if (activeRules.includes('rotation')) cSIdx = (baseS + lr + lc) % shapePool.length;
  if (activeRules.includes('colorShift')) cCIdx = (baseC + lr) % colorPool.length;
  if (activeRules.includes('mirror') && lc >= 1) cSIdx = (cSIdx + GRID_SIZE - lc) % shapePool.length;
  if (activeRules.includes('substitution') && lr % 2 === 1) cSIdx = (cSIdx + 1) % shapePool.length;
  if (activeRules.includes('diagonal') && lr === lc) cCIdx = (cCIdx + 2) % colorPool.length;
  if (activeRules.includes('positionalShift')) cCIdx = (baseC + lr + lc) % colorPool.length;

  const correct = { shape: shapePool[cSIdx], color: colorPool[cCIdx] };
  const options: { shape: string; color: string }[] = [correct];
  let attempts = 0;
  while (options.length < 6 && attempts < 100) {
    attempts++;
    const s = shapePool[randInt(0, shapePool.length - 1)];
    const c = colorPool[randInt(0, colorPool.length - 1)];
    if (!options.find(o => o.shape === s && o.color === c)) options.push({ shape: s, color: c });
  }
  while (options.length < 6) options.push({ shape: SHAPES[options.length % SHAPES.length], color: SHAPE_COLORS[options.length % SHAPE_COLORS.length] });

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(o => o.shape === correct.shape && o.color === correct.color);

  return { type: 'ravenMatrix', grid, options: shuffled, correctIndex, ruleCount, rules: activeRules };
}

// ─── Mental Rotation ──────────────────────────────────────────────────────────

export interface MentalRotationQuestion {
  type: 'mentalRotation';
  targetShape: string;
  targetColor: string;
  targetRotation: number;  // 0, 45, 90, 135, 180, 225, 270, 315
  options: { shape: string; color: string; rotation: number; isSame: boolean }[];
  correctIndex: number;
  difficulty: number;
}

export function generateMentalRotationQuestion(speedTier: number): MentalRotationQuestion {
  const difficulty = Math.min(4, Math.floor(speedTier / 10));
  const targetShape = SHAPES[randInt(0, SHAPES.length - 1)];
  const targetColor = SHAPE_COLORS[randInt(0, SHAPE_COLORS.length - 1)];
  const targetRotation = randInt(0, 7) * 45;

  // Correct answer: same shape & color, but different rotation
  const offsets = [90, 135, 180, 225];
  const correctRotation = (targetRotation + offsets[randInt(0, offsets.length - 1)]) % 360;
  const correct = { shape: targetShape, color: targetColor, rotation: correctRotation, isSame: true };

  const distractors: { shape: string; color: string; rotation: number; isSame: boolean }[] = [];
  for (let i = 0; i < 3; i++) {
    let dShape: string;
    if (difficulty >= 3) {
      // Hardest: same shape, different color (mirror confusion)
      dShape = targetShape;
    } else if (difficulty >= 2) {
      // Medium: shapes from same pool
      dShape = SHAPES[randInt(0, SHAPES.length - 1)];
    } else {
      // Easy: clearly different shapes
      const others = SHAPES.filter(s => s !== targetShape);
      dShape = others[randInt(0, others.length - 1)];
    }
    const dColor = difficulty >= 3
      ? SHAPE_COLORS.filter(c => c !== targetColor)[randInt(0, SHAPE_COLORS.length - 2)]
      : targetColor;
    distractors.push({ shape: dShape, color: dColor, rotation: randInt(0, 7) * 45, isSame: false });
  }

  const options = shuffle([correct, ...distractors]);
  const correctIndex = options.findIndex(o => o.isSame);
  return { type: 'mentalRotation', targetShape, targetColor, targetRotation, options, correctIndex, difficulty };
}

// ─── Dual N-Back ──────────────────────────────────────────────────────────────

export interface DualNBackTrial {
  type: 'dualNBack';
  n: number;
  totalTrials: number;
  currentTrial: number;
  visualPosition: number;  // 0-8 on a 3x3 grid
  auditoryLetter: string;  // A-H
  isVisualMatch: boolean;
  isAuditoryMatch: boolean;
}

export interface DualNBackSession {
  n: number;
  trials: DualNBackTrial[];
}

const NBACK_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function generateDualNBackSession(memoryTier: number, nOverride?: number): DualNBackSession {
  const baseN = Math.max(2, Math.min(6, 2 + Math.floor(memoryTier / 12)));
  const n = nOverride ? Math.max(2, Math.min(6, nOverride)) : baseN;
  const totalTrials = Math.min(25, 18 + Math.floor(memoryTier / 15));
  const MATCH_PROB = 0.3;

  const posHistory: number[] = [];
  const letHistory: string[] = [];
  const trials: DualNBackTrial[] = [];

  for (let t = 0; t < totalTrials; t++) {
    let visualPos: number;
    let isVisualMatch = false;
    if (t >= n && Math.random() < MATCH_PROB) {
      visualPos = posHistory[t - n];
      isVisualMatch = true;
    } else {
      do { visualPos = randInt(0, 8); }
      while (t >= n && visualPos === posHistory[t - n]);
    }

    let letter: string;
    let isAuditoryMatch = false;
    if (t >= n && Math.random() < MATCH_PROB) {
      letter = letHistory[t - n];
      isAuditoryMatch = true;
    } else {
      do { letter = NBACK_LETTERS[randInt(0, NBACK_LETTERS.length - 1)]; }
      while (t >= n && letter === letHistory[t - n]);
    }

    posHistory.push(visualPos);
    letHistory.push(letter);

    trials.push({
      type: 'dualNBack',
      n,
      totalTrials,
      currentTrial: t,
      visualPosition: visualPos,
      auditoryLetter: letter,
      isVisualMatch,
      isAuditoryMatch,
    });
  }

  return { n, trials };
}

export interface BaselineQuestion {
  category: 'pattern' | 'memory' | 'logic' | 'speed' | 'flexibility';
  question: string;
  options: string[];
  correctIndex: number;
}

export function generateBaselineQuestions(): BaselineQuestion[] {
  const questions: BaselineQuestion[] = [];

  const patternQs: BaselineQuestion[] = [
    { category: 'pattern', question: 'What shape comes next: circle, square, circle, square, ?', options: ['Triangle', 'Circle', 'Square', 'Diamond'], correctIndex: 1 },
    { category: 'pattern', question: 'Complete: 2, 4, 6, 8, ?', options: ['9', '10', '12', '11'], correctIndex: 1 },
    { category: 'pattern', question: 'What comes next: A, C, E, G, ?', options: ['H', 'I', 'J', 'K'], correctIndex: 1 },
    { category: 'pattern', question: 'Complete: 1, 4, 9, 16, ?', options: ['20', '25', '24', '36'], correctIndex: 1 },
    { category: 'pattern', question: 'What comes next: red, blue, red, blue, red, ?', options: ['Red', 'Blue', 'Green', 'Yellow'], correctIndex: 1 },
    { category: 'pattern', question: 'Complete: 3, 6, 12, 24, ?', options: ['36', '48', '30', '42'], correctIndex: 1 },
  ];

  const memoryQs: BaselineQuestion[] = [
    { category: 'memory', question: 'Remember: 7, 3, 9, 1. What was the second number?', options: ['7', '3', '9', '1'], correctIndex: 1 },
    { category: 'memory', question: 'Remember: blue, red, green, yellow. What was third?', options: ['Blue', 'Green', 'Red', 'Yellow'], correctIndex: 1 },
    { category: 'memory', question: 'Remember: 5, 2, 8, 4, 6. What was the fourth?', options: ['8', '2', '4', '6'], correctIndex: 2 },
    { category: 'memory', question: 'Remember: cat, dog, bird, fish. What was first?', options: ['Dog', 'Cat', 'Bird', 'Fish'], correctIndex: 1 },
    { category: 'memory', question: 'Remember: 9, 1, 7, 3, 5. What is the sum of the first two?', options: ['10', '8', '16', '12'], correctIndex: 0 },
    { category: 'memory', question: 'Remember: A, E, I, O, U. What are the last two reversed?', options: ['U, O', 'O, U', 'I, O', 'A, E'], correctIndex: 0 },
  ];

  const logicQs: BaselineQuestion[] = [
    { category: 'logic', question: 'All apples are fruits. This is an apple. Is it a fruit?', options: ['Yes', 'No', 'Maybe', 'Not sure'], correctIndex: 0 },
    { category: 'logic', question: 'If it is sunny, I go outside. It is sunny. Do I go outside?', options: ['Yes', 'No', 'Maybe', 'Not sure'], correctIndex: 0 },
    { category: 'logic', question: 'No fish can walk. A salmon is a fish. Can it walk?', options: ['Yes', 'No', 'Maybe', 'Sometimes'], correctIndex: 1 },
    { category: 'logic', question: 'If A > B and B > C, which is smallest?', options: ['A', 'B', 'C', 'Cannot tell'], correctIndex: 2 },
    { category: 'logic', question: 'All birds have wings. A penguin is a bird. Does it have wings?', options: ['Yes', 'No', 'Maybe', 'Not sure'], correctIndex: 0 },
    { category: 'logic', question: 'If X = 3 and Y = X + 2, what is Y?', options: ['3', '5', '6', '2'], correctIndex: 1 },
  ];

  const speedQs: BaselineQuestion[] = [
    { category: 'speed', question: 'Quick: 7 + 8 = ?', options: ['14', '15', '16', '13'], correctIndex: 1 },
    { category: 'speed', question: 'Quick: 12 - 5 = ?', options: ['6', '8', '7', '9'], correctIndex: 2 },
    { category: 'speed', question: 'Quick: 6 x 4 = ?', options: ['20', '28', '24', '22'], correctIndex: 2 },
    { category: 'speed', question: 'Quick: 36 / 6 = ?', options: ['5', '7', '8', '6'], correctIndex: 3 },
    { category: 'speed', question: 'Quick: 15 + 17 = ?', options: ['31', '32', '33', '30'], correctIndex: 1 },
    { category: 'speed', question: 'Quick: 9 x 7 = ?', options: ['56', '63', '72', '54'], correctIndex: 1 },
  ];

  const flexQs: BaselineQuestion[] = [
    { category: 'flexibility', question: 'If the rule is "add 3" and you start at 2, what is the third result?', options: ['8', '11', '14', '5'], correctIndex: 1 },
    { category: 'flexibility', question: 'Switch rule: first multiply by 2, then add 1. Start at 3. Result?', options: ['7', '8', '9', '6'], correctIndex: 0 },
    { category: 'flexibility', question: 'Odd numbers get +1, even numbers get x2. What happens to 4?', options: ['5', '6', '8', '3'], correctIndex: 2 },
    { category: 'flexibility', question: 'Alternate: +2, -1, +2, -1. Start at 5. After 4 steps?', options: ['7', '8', '9', '6'], correctIndex: 0 },
    { category: 'flexibility', question: 'If vowels = 1 and consonants = 0, what is "CAT"?', options: ['010', '101', '001', '100'], correctIndex: 0 },
    { category: 'flexibility', question: 'Reverse the rule: if output is 10 and rule was "multiply by 2", input was?', options: ['5', '8', '20', '12'], correctIndex: 0 },
  ];

  questions.push(...patternQs, ...memoryQs, ...logicQs, ...speedQs, ...flexQs);
  return shuffle(questions).slice(0, 30);
}
