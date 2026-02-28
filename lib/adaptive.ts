import { UserProfile, ModuleScore, TraitAdjustment, SessionLog, IntelligenceIndices } from './storage';
import { MAX_LEVEL, FREE_TIER_MAX_LEVEL } from './constants';

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

  const maxPossible = MAX_LEVEL;
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
  const focusBias = 0.25;

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

export function calculateJojoIQ(level: number): number {
  // Jojo IQ Protocol:
  // Level 1 (Baseline) -> ~90 IQ
  // Level 50 (Target) -> 130 IQ (Gifted)
  // Level > 50 -> +1 IQ per level (e.g., Lvl 100 = 180 IQ)

  if (level >= 50) {
    // Linear progression from 130 upwards
    return 130 + (level - 50);
  } else {
    // Linear interpolation from 90 to 130
    // (130 - 90) / 49 = ~0.816 per level
    const progress = (level - 1) / 49;
    return Math.round(90 + (progress * 40));
  }
}

export function calculateSessionDifficulty(
  profile: UserProfile,
  recentSessions: SessionLog[],
): SessionDifficultyConfig {
  const analysis = analyzeWeaknesses(profile, recentSessions);
  const currentIQ = calculateJojoIQ(profile.level);

  // Difficulty scaling factor based on IQ target.
  // We want the app to push users HARDER as they approach IQ 130.
  // At Level 1 (IQ 90), difficulty multiplier is 1.0
  // At Level 50 (IQ 130), multiplier is ~2.5 (High intensity)
  // At Level 100 (IQ 180), multiplier is 4.0 (Extreme)
  
  // Base multiplier curves exponentially slightly to ramp up difficulty
  const levelMultiplier = 1 + Math.pow((profile.level / 100), 1.2) * 3; 

  const computeTier = (traitValue: number): number => {
    // Tier calculation now heavily weighted by the global level multiplier
    // This ensures even if a specific trait score lags, the overall session pushes them up.
    // We clamp minimum to 1 and allow it to go very high (e.g. 150+) for Genius level.
    return Math.max(1, Math.round(traitValue * 0.4 + (profile.level * 0.6 * levelMultiplier)));
  };

  const stagnationAdjustments: Record<string, 'variant' | 'timerCompress' | 'formatChange' | null> = {};
  // Below level 15, timer compression is too punishing for developing users —
  // only apply variety-based challenges instead.
  const canCompressTimer = profile.level >= 15;
  for (const tm of TRAIT_MAP) {
    if (analysis.stagnantTraits.find(st => st.key === tm.key)) {
      const rand = Math.random();
      if (canCompressTimer) {
        if (rand < 0.33) stagnationAdjustments[tm.module] = 'variant';
        else if (rand < 0.66) stagnationAdjustments[tm.module] = 'timerCompress';
        else stagnationAdjustments[tm.module] = 'formatChange';
      } else {
        stagnationAdjustments[tm.module] = rand < 0.5 ? 'variant' : 'formatChange';
      }
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
  const totalSeconds = 840; // ~14 min total
  const baseAlloc: Record<string, number> = {
    pattern: 180,
    memory: 180,
    ruleMutation: 180,
    dualTask: 180,
    rapidLogic: 120,
  };

  const weight = biasWeights[module] || 0.2;
  const normalized = weight / 0.2;
  const base = baseAlloc[module] || 180;
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

  const maxTier = profile.subscriptionType === 'premium' ? MAX_LEVEL : FREE_TIER_MAX_LEVEL;

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
      updated.level = Math.min(updated.level + 1, maxTier);
      leveledUp = true;
    }
  }

  updated.level = Math.min(updated.level, maxTier);

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

/**
 * Derive higher-order intelligence indices from per-module scores.
 *
 * These indices are PROGRESSIVE: they factor in difficulty tier and user level,
 * so a Level 50 user scoring 80% on Tier 50 questions gets a HIGHER score than
 * a Level 1 user scoring 80% on Tier 1 questions.
 *
 * The score reflects absolute cognitive ability, not just relative performance.
 */
export function calculateIntelligenceIndices(
  moduleScores: {
    pattern: ModuleScore;
    memory: ModuleScore;
    ruleMutation: ModuleScore;
    dualTask: ModuleScore;
    rapidLogic: ModuleScore;
  },
  userLevel: number
): IntelligenceIndices {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  // Level multiplier: users at higher levels get a baseline boost
  // Level 1: 1.0x, Level 50: 1.25x, Level 100: 1.5x
  const levelMultiplier = 1 + (userLevel / MAX_LEVEL) * 0.5;

  // Calculate weighted scores: (accuracy/100) × tier × levelMultiplier
  // This means higher tiers and higher levels yield higher raw scores
  const patternScore =
    (moduleScores.pattern.accuracy / 100) *
    moduleScores.pattern.difficultyTier *
    levelMultiplier;

  const memoryScore =
    (moduleScores.memory.accuracy / 100) *
    moduleScores.memory.difficultyTier *
    levelMultiplier;

  const speedScore =
    (moduleScores.ruleMutation.accuracy / 100) *
    moduleScores.ruleMutation.difficultyTier *
    levelMultiplier;

  const dualScore =
    (moduleScores.dualTask.accuracy / 100) *
    moduleScores.dualTask.difficultyTier *
    levelMultiplier;

  const rapidScore =
    (moduleScores.rapidLogic.accuracy / 100) *
    moduleScores.rapidLogic.difficultyTier *
    levelMultiplier;

  // Maximum possible score at max level (Tier 100 × 1.5 multiplier = 150)
  const maxPossibleScore = MAX_LEVEL * 1.5;

  // Combine weighted scores with domain-specific weights, then normalize to 0-100
  const reasoning = clamp(
    ((patternScore * 0.3 + speedScore * 0.3 + rapidScore * 0.4) / maxPossibleScore) * 100
  );

  const spatial = clamp(
    ((patternScore * 0.55 + dualScore * 0.45) / maxPossibleScore) * 100
  );

  const fluid = clamp(
    ((patternScore * 0.25 + memoryScore * 0.25 + speedScore * 0.25 + dualScore * 0.25) / maxPossibleScore) * 100
  );

  const crystallized = clamp(
    ((rapidScore * 0.8 + patternScore * 0.2) / maxPossibleScore) * 100
  );

  return {
    reasoning,
    spatial,
    fluid,
    crystallized,
  };
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

/**
 * Calculate Learning Velocity Index: measures how fast user is improving.
 * Higher values = faster cognitive growth rate.
 * 
 * Formula: (current week avg intelligence - last week avg intelligence) / last week avg * session frequency bonus
 */
export function calculateLearningVelocity(
  profile: UserProfile,
  recentSessions: SessionLog[]
): { velocity: number; weekOverWeekChange: number; interpretation: string } {
  if (recentSessions.length < 2) {
    return {
      velocity: 0,
      weekOverWeekChange: 0,
      interpretation: 'Complete more sessions to track learning velocity',
    };
  }

  // Get sessions from last 7 days and previous 7 days
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const lastWeekSessions = recentSessions.filter(s => {
    const sessionTime = new Date(s.date).getTime();
    return sessionTime >= sevenDaysAgo && sessionTime <= now;
  });

  const previousWeekSessions = recentSessions.filter(s => {
    const sessionTime = new Date(s.date).getTime();
    return sessionTime >= fourteenDaysAgo && sessionTime < sevenDaysAgo;
  });

  if (lastWeekSessions.length === 0) {
    return {
      velocity: 0,
      weekOverWeekChange: 0,
      interpretation: 'Train this week to measure velocity',
    };
  }

  // Calculate average intelligence indices for each period
  const getAvgIntelligence = (sessions: SessionLog[]) => {
    if (sessions.length === 0) return 0;
    const sum = sessions.reduce((total, s) => {
      if (!s.intelligenceIndices) return total;
      return total + (
        s.intelligenceIndices.reasoning +
        s.intelligenceIndices.spatial +
        s.intelligenceIndices.fluid +
        s.intelligenceIndices.crystallized
      ) / 4;
    }, 0);
    return sum / sessions.length;
  };

  const currentWeekAvg = getAvgIntelligence(lastWeekSessions);
  const previousWeekAvg = previousWeekSessions.length > 0 ? getAvgIntelligence(previousWeekSessions) : currentWeekAvg * 0.9;

  // Calculate percentage change
  const weekOverWeekChange = previousWeekAvg > 0
    ? ((currentWeekAvg - previousWeekAvg) / previousWeekAvg) * 100
    : 0;

  // Session frequency bonus (more sessions = faster improvement is more meaningful)
  const sessionFrequencyBonus = 1 + (lastWeekSessions.length / 7) * 0.5;

  // Final velocity score
  const velocity = weekOverWeekChange * sessionFrequencyBonus;

  // Interpretation
  let interpretation = '';
  if (velocity > 15) {
    interpretation = 'Exceptional growth - you\'re learning significantly faster';
  } else if (velocity > 8) {
    interpretation = 'Strong improvement - cognitive capacity expanding rapidly';
  } else if (velocity > 3) {
    interpretation = 'Steady progress - consistent cognitive enhancement';
  } else if (velocity > 0) {
    interpretation = 'Gradual growth - keep training consistently';
  } else if (velocity > -5) {
    interpretation = 'Consolidating - maintaining current capacity';
  } else {
    interpretation = 'Take a rest day - recovery helps long-term growth';
  }

  return { velocity, weekOverWeekChange, interpretation };
}

/**
 * Update streak tracking when a session completes.
 * Returns updated streak values.
 */
export function updateStreak(profile: UserProfile): {
  currentStreak: number;
  longestStreak: number;
  isNewRecord: boolean;
} {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  
  const lastStreakDate = profile.lastStreakDate || '';
  let currentStreak = profile.currentStreak || 0;
  const longestStreak = profile.longestStreak || 0;

  if (lastStreakDate === today) {
    // Already counted today
    return { currentStreak, longestStreak, isNewRecord: false };
  } else if (lastStreakDate === yesterday) {
    // Continuing streak
    currentStreak += 1;
  } else if (lastStreakDate === '') {
    // First ever session
    currentStreak = 1;
  } else {
    // Streak broken, start over
    currentStreak = 1;
  }

  const isNewRecord = currentStreak > longestStreak;
  const newLongestStreak = Math.max(currentStreak, longestStreak);

  return {
    currentStreak,
    longestStreak: newLongestStreak,
    isNewRecord,
  };
}
