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
}

export function generatePatternQuestion(patternTier: number, stagnationMode: string | null): PatternQuestion {
  const layerCount = Math.min(6, 1 + Math.floor(patternTier / 3));
  const shapePool = pick(SHAPES, Math.min(SHAPES.length, 2 + Math.floor(patternTier / 4)));
  const colorPool = pick(SHAPE_COLORS, Math.min(SHAPE_COLORS.length, 2 + Math.floor(patternTier / 5)));

  const gridSize = patternTier >= 15 ? 4 : 3;
  const grid: { shape: string; color: string }[][] = [];
  const baseS = randInt(0, shapePool.length - 1);
  const baseC = randInt(0, colorPool.length - 1);

  const useRotation = layerCount >= 1;
  const useColorShift = layerCount >= 2;
  const useMirror = layerCount >= 3;
  const useSubstitution = layerCount >= 4;
  const useDiagonal = layerCount >= 5;
  const usePositionalShift = layerCount >= 6;

  for (let row = 0; row < gridSize; row++) {
    grid[row] = [];
    for (let col = 0; col < gridSize; col++) {
      if (row === gridSize - 1 && col === gridSize - 1) {
        grid[row][col] = { shape: '?', color: '#5A5A68' };
        continue;
      }

      let sIdx = baseS;
      let cIdx = baseC;

      if (useRotation) sIdx = (baseS + row + col) % shapePool.length;
      if (useColorShift) cIdx = (baseC + row) % colorPool.length;
      if (useMirror && col >= Math.floor(gridSize / 2)) sIdx = (sIdx + gridSize - col) % shapePool.length;
      if (useSubstitution && row % 2 === 1) sIdx = (sIdx + 1) % shapePool.length;
      if (useDiagonal && row === col) cIdx = (cIdx + 2) % colorPool.length;
      if (usePositionalShift) cIdx = (baseC + row + col) % colorPool.length;

      if (stagnationMode === 'variant') {
        sIdx = (sIdx + row * col) % shapePool.length;
      }

      grid[row][col] = { shape: shapePool[sIdx], color: colorPool[cIdx] };
    }
  }

  let correctSIdx = baseS;
  let correctCIdx = baseC;
  const lastRow = gridSize - 1;
  const lastCol = gridSize - 1;

  if (useRotation) correctSIdx = (baseS + lastRow + lastCol) % shapePool.length;
  if (useColorShift) correctCIdx = (baseC + lastRow) % colorPool.length;
  if (useMirror && lastCol >= Math.floor(gridSize / 2)) correctSIdx = (correctSIdx + gridSize - lastCol) % shapePool.length;
  if (useSubstitution && lastRow % 2 === 1) correctSIdx = (correctSIdx + 1) % shapePool.length;
  if (useDiagonal && lastRow === lastCol) correctCIdx = (correctCIdx + 2) % colorPool.length;
  if (usePositionalShift) correctCIdx = (baseC + lastRow + lastCol) % colorPool.length;
  if (stagnationMode === 'variant') correctSIdx = (correctSIdx + lastRow * lastCol) % shapePool.length;

  const correct = { shape: shapePool[correctSIdx], color: colorPool[correctCIdx] };

  const options: { shape: string; color: string }[] = [correct];
  let attempts = 0;
  while (options.length < 4 && attempts < 50) {
    attempts++;
    const s = shapePool[randInt(0, shapePool.length - 1)];
    const c = colorPool[randInt(0, colorPool.length - 1)];
    if (!options.find(o => o.shape === s && o.color === c)) {
      options.push({ shape: s, color: c });
    }
  }
  while (options.length < 4) {
    options.push({ shape: SHAPES[options.length], color: SHAPE_COLORS[options.length] });
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(o => o.shape === correct.shape && o.color === correct.color);

  return { type: 'pattern', grid, options: shuffled, correctIndex, transformationCount: layerCount };
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
  const count = Math.min(10, memorySpan + (stagnationMode === 'variant' ? 1 : 0));
  const selectedSymbols = pick(SYMBOLS, count);
  const selectedColors = selectedSymbols.map(() => SHAPE_COLORS[randInt(0, SHAPE_COLORS.length - 1)]);
  const sequence = selectedSymbols.map((s, i) => ({ symbol: s, color: selectedColors[i] }));

  const availableTasks: { task: MemoryQuestion['task']; desc: string }[] = [
    { task: 'reverse', desc: 'Select the REVERSE order' },
  ];
  if (memoryTier >= 3) availableTasks.push({ task: 'sort', desc: 'Select the SORTED order (A-Z)' });
  if (memoryTier >= 5) availableTasks.push({ task: 'filter', desc: 'Select only the ODD-positioned items' });
  if (memoryTier >= 7) availableTasks.push({ task: 'swap', desc: 'Swap the first and last, then select' });
  if (memoryTier >= 10) availableTasks.push({ task: 'removeAndReverse', desc: 'Remove the middle item, then reverse' });

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

  const baseDisplay = 2000;
  const tierReduction = memoryTier * 80;
  const stagnationBonus = stagnationMode === 'timerCompress' ? -200 : 0;
  const displayTimeMs = Math.max(600, baseDisplay - tierReduction + stagnationBonus);

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

function getRulesForTier(tier: number): Rule[] {
  const rules: Rule[] = [
    { desc: 'Add 3', apply: n => n + 3 },
    { desc: 'Multiply by 2', apply: n => n * 2 },
    { desc: 'Subtract 4', apply: n => n - 4 },
    { desc: 'Add 7', apply: n => n + 7 },
  ];
  if (tier >= 3) {
    rules.push({ desc: 'Multiply by 3', apply: n => n * 3 });
    rules.push({ desc: 'Double and add 1', apply: n => n * 2 + 1 });
  }
  if (tier >= 6) {
    rules.push({ desc: 'Square root (round down)', apply: n => Math.floor(Math.sqrt(Math.abs(n))) });
    rules.push({ desc: 'Add 11 then halve', apply: n => Math.floor((n + 11) / 2) });
  }
  if (tier >= 9) {
    rules.push({ desc: 'Triple and subtract 5', apply: n => n * 3 - 5 });
    rules.push({ desc: 'If even halve, if odd triple', apply: n => n % 2 === 0 ? n / 2 : n * 3 });
  }
  if (tier >= 12) {
    rules.push({ desc: 'Multiply by 2 then add digits', apply: n => { const d = n * 2; return d + Math.floor(d / 10) + (d % 10); } });
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
    ruleDescription: (ruleChanged || forceChange) ? 'New Rule!' : rule.desc,
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
  const baseShapes = pick(SHAPES, Math.min(4, 2 + Math.floor(flexTier / 4)));

  const visualSeq: string[] = [];
  for (let i = 0; i < seqLength; i++) {
    visualSeq.push(baseShapes[i % baseShapes.length]);
  }
  const missingIndex = seqLength - 1;
  const correctShape = visualSeq[missingIndex];
  visualSeq[missingIndex] = '?';

  const wrongShapes = SHAPES.filter(s => s !== correctShape);
  const visualOptions = shuffle([correctShape, ...pick(wrongShapes, Math.min(3, wrongShapes.length))]);
  while (visualOptions.length < 4) visualOptions.push(SHAPES[visualOptions.length]);
  const visualCorrectIndex = visualOptions.indexOf(correctShape);

  const targetColor = SHAPE_COLORS[randInt(0, 2)];
  const flashCount = Math.min(12, 5 + Math.floor(flexTier / 2));
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

  const countOptionsSet = new Set([correctCount]);
  countOptionsSet.add(Math.max(0, correctCount - 1));
  countOptionsSet.add(correctCount + 1);
  countOptionsSet.add(Math.max(0, correctCount + 2));
  if (countOptionsSet.size < 4) countOptionsSet.add(correctCount + 3);
  const countOptions = shuffle([...countOptionsSet]).slice(0, 4);
  const countCorrectIndex = countOptions.indexOf(correctCount);

  const distractorEnabled = flexTier >= 8 || stagnationMode === 'variant';

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
  ],
};

export function generateRapidLogicQuestion(
  dualTier: number,
  timerMultiplier: number,
  stagnationMode: string | null,
): RapidLogicQuestion {
  let pool: { q: string; options: string[]; correct: number }[];
  if (dualTier <= 4) pool = LOGIC_POOLS.easy;
  else if (dualTier <= 9) pool = LOGIC_POOLS.medium;
  else pool = LOGIC_POOLS.hard;

  if (stagnationMode === 'variant' && dualTier <= 9) {
    pool = [...pool, ...LOGIC_POOLS.hard.slice(0, 3)];
  }

  const q = pool[randInt(0, pool.length - 1)];
  const baseTimer = dualTier <= 4 ? 10 : dualTier <= 9 ? 8 : 6;
  const timerSeconds = Math.max(4, Math.round(baseTimer * timerMultiplier));

  return {
    type: 'rapidLogic',
    question: q.q,
    options: q.options,
    correctIndex: q.correct,
    timerSeconds,
  };
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
