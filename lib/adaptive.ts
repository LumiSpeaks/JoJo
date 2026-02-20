import { UserProfile, ModuleScore, TraitAdjustment, SessionLog } from './storage';

export type TraitKey = 'patternLevel' | 'memorySpan' | 'speedIndex' | 'flexibilityScore' | 'dualTaskCapacity';

export interface TraitMapping {
  key: TraitKey;
  name: string;
  module: string;
}

export const TRAIT_MAP: TraitMapping[] = [
  { key: 'patternLevel', name: 'Pattern Recognition', module: 'pattern' },
  { key: 'memorySpan', name: 'Working Memory', module: 'memory' },
  { key: 'speedIndex', name: 'Processing Speed', module: 'ruleMutation' },
  { key: 'flexibilityScore', name: 'Cognitive Flexibility', module: 'dualTask' },
  { key: 'dualTaskCapacity', name: 'Dual-Task Processing', module: 'rapidLogic' },
];

export interface WeaknessAnalysis {
  weakestTrait: TraitMapping;
  traitRankings: { trait: TraitMapping; value: number; percentile: number }[];
  stagnantTraits: TraitMapping[];
  focusTrait: TraitMapping;
  biasWeights: Record<string, number>;
}

export function analyzeWeaknesses(profile: UserProfile, recentSessions: SessionLog[]): WeaknessAnalysis {
  const traitValues: { trait: TraitMapping; value: number }[] = TRAIT_MAP.map(t => ({
    trait: t,
    value: profile[t.key] as number,
  }));

  traitValues.sort((a, b) => a.value - b.value);

  const maxPossible = profile.subscriptionType === 'premium' ? 50 : 20;
  const rankings = traitValues.map(tv => ({
    trait: tv.trait,
    value: tv.value,
    percentile: (tv.value / maxPossible) * 100,
  }));

  const weakestTrait = traitValues[0].trait;

  const stagnantTraits: TraitMapping[] = [];
  if (recentSessions.length >= 5) {
    for (const tm of TRAIT_MAP) {
      const last5Adjustments = recentSessions.slice(-5).map(s => {
        const adj = s.traitAdjustments.find(a => a.trait === tm.name);
        return adj ? adj.change : 0;
      });
      const totalChange = last5Adjustments.reduce((s, c) => s + c, 0);
      if (totalChange === 0) {
        stagnantTraits.push(tm);
      }
    }
  }

  let focusTrait = weakestTrait;
  if (stagnantTraits.length > 0) {
    const stagnantAndWeak = stagnantTraits.find(st =>
      (profile[st.key] as number) <= (profile[weakestTrait.key] as number) + 2
    );
    if (stagnantAndWeak) focusTrait = stagnantAndWeak;
  }

  const biasWeights: Record<string, number> = {};
  const baseBias = 0.2;
  const focusBias = 0.15;

  for (const tm of TRAIT_MAP) {
    biasWeights[tm.module] = baseBias;
  }
  biasWeights[focusTrait.module] = baseBias + focusBias;

  const totalWeight = Object.values(biasWeights).reduce((s, w) => s + w, 0);
  for (const key of Object.keys(biasWeights)) {
    biasWeights[key] = biasWeights[key] / totalWeight;
  }

  return {
    weakestTrait,
    traitRankings: rankings,
    stagnantTraits,
    focusTrait,
    biasWeights,
  };
}

export interface SessionDifficultyConfig {
  patternTier: number;
  memoryTier: number;
  speedTier: number;
  flexTier: number;
  dualTier: number;
  timerMultiplier: number;
  questionCountBias: Record<string, number>;
  focusTraitName: string;
  stagnationAdjustments: Record<string, 'variant' | 'timerCompress' | 'formatChange' | null>;
}

export function calculateSessionDifficulty(
  profile: UserProfile,
  recentSessions: SessionLog[],
): SessionDifficultyConfig {
  const analysis = analyzeWeaknesses(profile, recentSessions);

  const levelMultiplier = 1 + (profile.level - 1) * 0.04;

  const computeTier = (traitValue: number): number => {
    return Math.max(1, Math.round(traitValue * levelMultiplier));
  };

  const stagnationAdjustments: Record<string, 'variant' | 'timerCompress' | 'formatChange' | null> = {};
  for (const tm of TRAIT_MAP) {
    if (analysis.stagnantTraits.find(st => st.key === tm.key)) {
      const rand = Math.random();
      if (rand < 0.33) stagnationAdjustments[tm.module] = 'variant';
      else if (rand < 0.66) stagnationAdjustments[tm.module] = 'timerCompress';
      else stagnationAdjustments[tm.module] = 'formatChange';
    } else {
      stagnationAdjustments[tm.module] = null;
    }
  }

  const timerMultiplier = Math.max(0.5, 1 - (profile.level - 1) * 0.015);

  const questionCountBias: Record<string, number> = {};
  for (const tm of TRAIT_MAP) {
    questionCountBias[tm.module] = analysis.biasWeights[tm.module];
  }

  return {
    patternTier: computeTier(profile.patternLevel),
    memoryTier: computeTier(profile.memorySpan),
    speedTier: computeTier(profile.speedIndex),
    flexTier: computeTier(profile.flexibilityScore),
    dualTier: computeTier(profile.dualTaskCapacity),
    timerMultiplier,
    questionCountBias,
    focusTraitName: analysis.focusTrait.name,
    stagnationAdjustments,
  };
}

export function getTimerForModule(module: string, tier: number, timerMultiplier: number): number {
  const base: Record<string, number> = {
    pattern: 15,
    memory: 12,
    ruleMutation: 12,
    dualTask: 15,
    rapidLogic: 10,
  };
  const b = base[module] || 12;
  const adjusted = b * timerMultiplier - Math.floor(tier / 5);
  return Math.max(4, Math.round(adjusted));
}

export function getModuleDuration(module: string, biasWeights: Record<string, number>): number {
  const totalSeconds = 1200;
  const baseAlloc: Record<string, number> = {
    pattern: 300,
    memory: 240,
    ruleMutation: 240,
    dualTask: 240,
    rapidLogic: 180,
  };

  const weight = biasWeights[module] || 0.2;
  const normalized = weight / 0.2;
  const base = baseAlloc[module] || 240;
  return Math.round(base * Math.min(1.3, Math.max(0.8, normalized)));
}

export interface AdaptiveResult {
  updatedProfile: UserProfile;
  adjustments: TraitAdjustment[];
  leveledUp: boolean;
}

export function processSessionResults(
  profile: UserProfile,
  moduleScores: {
    pattern: ModuleScore;
    memory: ModuleScore;
    ruleMutation: ModuleScore;
    dualTask: ModuleScore;
    rapidLogic: ModuleScore;
  },
  recentSessions: SessionLog[],
): AdaptiveResult {
  const adjustments: TraitAdjustment[] = [];
  const updated = { ...profile };
  let traitIncreased = false;

  const traitModuleMap: { trait: TraitMapping; score: ModuleScore }[] = [
    { trait: TRAIT_MAP[0], score: moduleScores.pattern },
    { trait: TRAIT_MAP[1], score: moduleScores.memory },
    { trait: TRAIT_MAP[2], score: moduleScores.ruleMutation },
    { trait: TRAIT_MAP[3], score: moduleScores.dualTask },
    { trait: TRAIT_MAP[4], score: moduleScores.rapidLogic },
  ];

  traitModuleMap.sort((a, b) => {
    const aVal = profile[a.trait.key] as number;
    const bVal = profile[b.trait.key] as number;
    return aVal - bVal;
  });

  const last5ReactionTimes = recentSessions.slice(-5).map(s => s.averageReactionTime);
  const reactionTrend = last5ReactionTimes.length >= 2
    ? last5ReactionTimes[last5ReactionTimes.length - 1] < last5ReactionTimes[0]
    : true;

  const maxTier = updated.subscriptionType === 'premium' ? 50 : 20;

  for (const { trait, score } of traitModuleMap) {
    const accuracy = score.accuracy;
    const currentVal = updated[trait.key] as number;

    if (accuracy >= 80 && reactionTrend && !traitIncreased) {
      const newVal = Math.min(currentVal + 1, maxTier);
      (updated as any)[trait.key] = newVal;
      adjustments.push({
        trait: trait.name,
        change: 1,
        reason: `${accuracy.toFixed(0)}% accuracy with improving speed`,
      });
      traitIncreased = true;
    } else if (accuracy < 60) {
      const newVal = Math.max(currentVal - 1, 1);
      if (trait.key === 'memorySpan') {
        (updated as any)[trait.key] = Math.max(newVal, 4);
      } else {
        (updated as any)[trait.key] = newVal;
      }
      adjustments.push({
        trait: trait.name,
        change: -1,
        reason: `${accuracy.toFixed(0)}% accuracy - reducing to maintain edge-of-ability`,
      });
    } else {
      adjustments.push({
        trait: trait.name,
        change: 0,
        reason: `${accuracy.toFixed(0)}% accuracy - maintaining current difficulty`,
      });
    }
  }

  let leveledUp = false;
  const allSessionAccuracies = [
    ...recentSessions.slice(-2).map(s => s.averageAccuracy),
    calculateOverallAccuracy(moduleScores),
  ];

  if (allSessionAccuracies.length >= 3) {
    const avgLast3 = allSessionAccuracies.slice(-3).reduce((s, a) => s + a, 0) / 3;
    const allModulesAbove70 = Object.values(moduleScores).every(m => m.accuracy >= 70);

    if (avgLast3 >= 85 && allModulesAbove70 && reactionTrend && updated.level < maxTier) {
      updated.level += 1;
      leveledUp = true;
    }
  }

  updated.sessionsToday += 1;
  updated.lastSessionDate = new Date().toDateString();
  updated.totalSessions += 1;

  return { updatedProfile: updated, adjustments, leveledUp };
}

export function calculateOverallAccuracy(moduleScores: {
  pattern: ModuleScore;
  memory: ModuleScore;
  ruleMutation: ModuleScore;
  dualTask: ModuleScore;
  rapidLogic: ModuleScore;
}): number {
  const scores = Object.values(moduleScores);
  const validScores = scores.filter(s => s.questionsAnswered > 0);
  if (validScores.length === 0) return 0;
  return validScores.reduce((sum, s) => sum + s.accuracy, 0) / validScores.length;
}

export function calculateBaselineLevel(results: { category: string; correct: boolean; reactionTimeMs: number }[]): {
  level: number;
  patternLevel: number;
  memorySpan: number;
  speedIndex: number;
  flexibilityScore: number;
  dualTaskCapacity: number;
} {
  const categories: Record<string, { correct: number; total: number; totalTime: number }> = {};

  for (const r of results) {
    if (!categories[r.category]) {
      categories[r.category] = { correct: 0, total: 0, totalTime: 0 };
    }
    categories[r.category].total++;
    if (r.correct) categories[r.category].correct++;
    categories[r.category].totalTime += r.reactionTimeMs;
  }

  const getTraitScore = (cat: string, maxBase: number): number => {
    const c = categories[cat];
    if (!c || c.total === 0) return 1;
    const accuracy = c.correct / c.total;
    const avgTime = c.totalTime / c.total;
    const speedFactor = avgTime < 2000 ? 1.2 : avgTime < 4000 ? 1.0 : 0.8;
    return Math.max(1, Math.min(maxBase, Math.round(accuracy * maxBase * speedFactor)));
  };

  const patternLevel = getTraitScore('pattern', 5);
  const rawMemory = getTraitScore('memory', 4);
  const memorySpan = Math.max(4, rawMemory + 3);
  const speedIndex = getTraitScore('speed', 5);
  const flexibilityScore = getTraitScore('flexibility', 5);

  const dualAccuracy = (categories['pattern']?.correct || 0) + (categories['speed']?.correct || 0);
  const dualTotal = (categories['pattern']?.total || 1) + (categories['speed']?.total || 1);
  const dualTaskCapacity = Math.max(1, Math.min(5, Math.round((dualAccuracy / dualTotal) * 5)));

  const allCorrect = results.filter(r => r.correct).length;
  const totalQs = results.length || 1;
  const overallAccuracy = allCorrect / totalQs;
  const avgReaction = results.reduce((s, r) => s + r.reactionTimeMs, 0) / totalQs;

  let level: number;
  if (overallAccuracy >= 0.9 && avgReaction < 3000) level = 5;
  else if (overallAccuracy >= 0.8) level = 4;
  else if (overallAccuracy >= 0.65) level = 3;
  else if (overallAccuracy >= 0.5) level = 2;
  else level = 1;

  return { level, patternLevel, memorySpan, speedIndex, flexibilityScore, dualTaskCapacity };
}
