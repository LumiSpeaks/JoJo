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
  transformations: string[];
}

export function generatePatternQuestion(tier: number): PatternQuestion {
  const shapes = pick(SHAPES, 3);
  const colors = pick(SHAPE_COLORS, 3);

  const rotateShape = (idx: number) => (idx + 1) % shapes.length;
  const rotateColor = (idx: number) => (idx + 1) % colors.length;

  const grid: { shape: string; color: string }[][] = [];
  const baseShapeIdx = randInt(0, shapes.length - 1);
  const baseColorIdx = randInt(0, colors.length - 1);

  for (let row = 0; row < 3; row++) {
    grid[row] = [];
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) {
        grid[row][col] = { shape: '?', color: '#5A5A68' };
        continue;
      }
      let sIdx = (baseShapeIdx + row + col) % shapes.length;
      let cIdx = (baseColorIdx + row) % colors.length;
      if (tier > 3) cIdx = (baseColorIdx + row + col) % colors.length;
      grid[row][col] = { shape: shapes[sIdx], color: colors[cIdx] };
    }
  }

  const correctShapeIdx = (baseShapeIdx + 2 + 2) % shapes.length;
  let correctColorIdx = (baseColorIdx + 2) % colors.length;
  if (tier > 3) correctColorIdx = (baseColorIdx + 2 + 2) % colors.length;

  const correct = { shape: shapes[correctShapeIdx], color: colors[correctColorIdx] };

  const options: { shape: string; color: string }[] = [correct];
  while (options.length < 4) {
    const s = shapes[randInt(0, shapes.length - 1)];
    const c = colors[randInt(0, colors.length - 1)];
    if (!options.find(o => o.shape === s && o.color === c)) {
      options.push({ shape: s, color: c });
    }
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(o => o.shape === correct.shape && o.color === correct.color);

  const transformations = ['rotation'];
  if (tier > 2) transformations.push('color-shift');
  if (tier > 5) transformations.push('mirroring');
  if (tier > 8) transformations.push('substitution');

  return { type: 'pattern', grid, options: shuffled, correctIndex, transformations };
}

export interface MemoryQuestion {
  type: 'memory';
  sequence: { symbol: string; color: string }[];
  task: 'reverse' | 'sort' | 'filter';
  options: string[][];
  correctIndex: number;
  displayTimeMs: number;
}

export function generateMemoryQuestion(span: number, tier: number): MemoryQuestion {
  const count = Math.min(span + randInt(0, 1), 10);
  const selectedSymbols = pick(SYMBOLS, count);
  const selectedColors = selectedSymbols.map(() => SHAPE_COLORS[randInt(0, SHAPE_COLORS.length - 1)]);

  const sequence = selectedSymbols.map((s, i) => ({ symbol: s, color: selectedColors[i] }));

  const tasks: ('reverse' | 'sort' | 'filter')[] = ['reverse'];
  if (tier > 3) tasks.push('sort');
  if (tier > 6) tasks.push('filter');
  const task = tasks[randInt(0, tasks.length - 1)];

  let correctAnswer: string[];
  if (task === 'reverse') {
    correctAnswer = [...selectedSymbols].reverse();
  } else if (task === 'sort') {
    correctAnswer = [...selectedSymbols].sort();
  } else {
    correctAnswer = selectedSymbols.filter((_, i) => i % 2 === 0);
  }

  const options: string[][] = [correctAnswer];
  while (options.length < 4) {
    const wrong = shuffle([...correctAnswer]);
    if (wrong.length > 1) {
      const i = randInt(0, wrong.length - 2);
      [wrong[i], wrong[i + 1]] = [wrong[i + 1], wrong[i]];
    }
    if (!options.find(o => JSON.stringify(o) === JSON.stringify(wrong))) {
      options.push(wrong);
    }
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(o => JSON.stringify(o) === JSON.stringify(correctAnswer));

  const displayTimeMs = Math.max(800, 2000 - tier * 100);

  return { type: 'memory', sequence, task, options: shuffled, correctIndex, displayTimeMs };
}

export interface RuleMutationQuestion {
  type: 'ruleMutation';
  startValue: number;
  currentRule: string;
  ruleDescription: string;
  options: number[];
  correctIndex: number;
  ruleChanged: boolean;
}

const RULES: { desc: string; apply: (n: number) => number }[] = [
  { desc: 'Multiply by 2', apply: n => n * 2 },
  { desc: 'Add 7', apply: n => n + 7 },
  { desc: 'Subtract 3', apply: n => n - 3 },
  { desc: 'Multiply by 3', apply: n => n * 3 },
  { desc: 'Add 5', apply: n => n + 5 },
  { desc: 'Subtract 4', apply: n => n - 4 },
  { desc: 'Double and subtract 1', apply: n => n * 2 - 1 },
  { desc: 'Add 11', apply: n => n + 11 },
  { desc: 'Multiply by 2 then add 3', apply: n => n * 2 + 3 },
  { desc: 'Triple and subtract 5', apply: n => n * 3 - 5 },
];

export function generateRuleMutationQuestion(
  tier: number,
  questionIndex: number,
  previousRule?: number,
): RuleMutationQuestion {
  const startValue = randInt(2, 15);
  const ruleChangeFrequency = Math.max(2, 5 - Math.floor(tier / 3));
  const ruleChanged = questionIndex > 0 && questionIndex % ruleChangeFrequency === 0;

  let ruleIdx: number;
  if (ruleChanged || previousRule === undefined) {
    do {
      ruleIdx = randInt(0, Math.min(RULES.length - 1, 3 + Math.floor(tier / 2)));
    } while (ruleIdx === previousRule);
  } else {
    ruleIdx = previousRule;
  }

  const rule = RULES[ruleIdx];
  const correctAnswer = rule.apply(startValue);

  const options: number[] = [correctAnswer];
  while (options.length < 4) {
    const offset = randInt(-5, 5);
    const wrong = correctAnswer + offset;
    if (wrong !== correctAnswer && !options.includes(wrong) && wrong > 0) {
      options.push(wrong);
    }
  }

  const shuffled = shuffle(options);
  const correctIndex = shuffled.findIndex(n => n === correctAnswer);

  return {
    type: 'ruleMutation',
    startValue,
    currentRule: ruleIdx.toString(),
    ruleDescription: ruleChanged ? 'New Rule!' : rule.desc,
    options: shuffled,
    correctIndex,
    ruleChanged,
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
}

export function generateDualTaskQuestion(tier: number): DualTaskQuestion {
  const seqLength = 4 + Math.min(tier, 4);
  const baseShapes = pick(SHAPES, 3);
  const visualSeq: string[] = [];
  for (let i = 0; i < seqLength; i++) {
    visualSeq.push(baseShapes[i % baseShapes.length]);
  }
  const missingIndex = seqLength - 1;
  const correctShape = visualSeq[missingIndex];
  visualSeq[missingIndex] = '?';

  const visualOptions = shuffle([correctShape, ...pick(SHAPES.filter(s => s !== correctShape), 3)]);
  const visualCorrectIndex = visualOptions.indexOf(correctShape);

  const targetColor = SHAPE_COLORS[randInt(0, 2)];
  const flashCount = 5 + tier;
  const flashes: string[] = [];
  let targetCount = randInt(1, Math.min(4, Math.floor(flashCount / 2)));
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

  const countOptions = shuffle([
    correctCount,
    Math.max(0, correctCount - 1),
    correctCount + 1,
    Math.max(0, correctCount + 2),
  ].filter((v, i, a) => a.indexOf(v) === i));
  while (countOptions.length < 4) countOptions.push(correctCount + countOptions.length);
  const countCorrectIndex = countOptions.indexOf(correctCount);

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
      options: countOptions.slice(0, 4),
      correctIndex: countCorrectIndex,
    },
  };
}

export interface RapidLogicQuestion {
  type: 'rapidLogic';
  question: string;
  options: string[];
  correctIndex: number;
  timerSeconds: number;
}

const LOGIC_QUESTIONS_EASY: { q: string; options: string[]; correct: number }[] = [
  { q: 'All cats are animals. Some animals are pets. Are all cats pets?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If it rains, the ground gets wet. The ground is wet. Did it rain?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'All squares are rectangles. This shape is a rectangle. Is it a square?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'No fish can fly. A penguin is not a fish. Can a penguin fly?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If A > B and B > C, is A > C?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
  { q: 'All dogs bark. Rex is a dog. Does Rex bark?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
  { q: 'Some birds swim. All penguins are birds. Do some penguins swim?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If all A are B and all B are C, are all A also C?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
  { q: 'No plants are animals. A rose is a plant. Is a rose an animal?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
  { q: 'If X = 5 and Y = X + 3, what is Y?', options: ['5', '8', '3'], correct: 1 },
];

const LOGIC_QUESTIONS_MEDIUM: { q: string; options: string[]; correct: number }[] = [
  { q: 'If some A are B and no B are C, can any A be C?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'All roses are flowers. Some flowers fade quickly. Do all roses fade quickly?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If P implies Q, and Q is false, what about P?', options: ['P is true', 'P is false', 'Cannot determine'], correct: 1 },
  { q: 'No mammals lay eggs. A platypus is a mammal. Does it lay eggs?', options: ['Yes, rule is wrong', 'No', 'Cannot determine'], correct: 0 },
  { q: 'If all X are Y, and some Z are X, are some Z also Y?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
  { q: 'A is taller than B. C is shorter than B. Who is tallest?', options: ['A', 'B', 'C'], correct: 0 },
  { q: 'If not all heroes wear capes, and John wears a cape, is John a hero?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'Every circle is round. This object is round. Is it a circle?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If A or B is true, and A is false, what about B?', options: ['True', 'False', 'Cannot determine'], correct: 0 },
  { q: 'Some doctors are tall. All tall people see well. Do some doctors see well?', options: ['Yes', 'No', 'Cannot determine'], correct: 0 },
];

const LOGIC_QUESTIONS_HARD: { q: string; options: string[]; correct: number }[] = [
  { q: 'If all A are B, and no C are B, but some D are C, can any D be A?', options: ['Yes', 'No', 'Cannot determine'], correct: 1 },
  { q: 'If P implies Q, and R implies not Q, and R is true, what is P?', options: ['True', 'False', 'Cannot determine'], correct: 1 },
  { q: 'All M are N. Some N are O. No O are P. Can any M be P?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If (A and B) implies C, and C is false, what do we know?', options: ['A is false', 'B is false', 'A or B (or both) is false'], correct: 2 },
  { q: 'X is greater than Y. Z is less than X but greater than W. Y is greater than W. Order from greatest:', options: ['X, Z, Y, W', 'X, Y, Z, W', 'Cannot determine'], correct: 2 },
  { q: 'No S are T. All T are U. Some U are V. Can any S be V?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If all poets are dreamers and some dreamers are realists, are some poets realists?', options: ['Yes', 'No', 'Cannot determine'], correct: 2 },
  { q: 'If A then B. If B then C. If not C, then what?', options: ['Not A and not B', 'Not A only', 'Cannot determine'], correct: 0 },
  { q: 'Some X are Y. All Y are Z. No Z are W. Can any X be W?', options: ['Some can', 'None of the Y-type X can', 'Cannot determine'], correct: 1 },
  { q: 'If exactly one of P, Q, R is true, and P implies Q, which is true?', options: ['P', 'Q', 'R'], correct: 2 },
];

export function generateRapidLogicQuestion(tier: number): RapidLogicQuestion {
  let pool: { q: string; options: string[]; correct: number }[];
  if (tier <= 5) pool = LOGIC_QUESTIONS_EASY;
  else if (tier <= 10) pool = LOGIC_QUESTIONS_MEDIUM;
  else pool = LOGIC_QUESTIONS_HARD;

  const q = pool[randInt(0, pool.length - 1)];
  const timerSeconds = Math.max(5, 10 - Math.floor(tier / 3));

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
    { category: 'memory', question: 'Remember: 9, 1, 7, 3, 5. What was the sum of the first two?', options: ['10', '8', '16', '12'], correctIndex: 0 },
    { category: 'memory', question: 'Remember: A, E, I, O, U. Reverse the last two letters:', options: ['U, O', 'O, U', 'I, O', 'A, E'], correctIndex: 0 },
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
    { category: 'flexibility', question: 'Alternate: +2, -1, +2, -1. Start at 5. After 4 steps?', options: ['7', '8', '9', '6'], correct: 0, correctIndex: 0 },
    { category: 'flexibility', question: 'If vowels = 1 and consonants = 0, what is "CAT"?', options: ['010', '101', '001', '100'], correctIndex: 0 },
    { category: 'flexibility', question: 'Reverse the rule: if output is 10 and rule was "multiply by 2", input was?', options: ['5', '8', '20', '12'], correctIndex: 0 },
  ];

  questions.push(...patternQs, ...memoryQs, ...logicQs, ...speedQs, ...flexQs);
  return shuffle(questions).slice(0, 30);
}
