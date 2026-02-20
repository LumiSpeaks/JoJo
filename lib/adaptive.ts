import { UserProfile, ModuleScore, TraitAdjustment } from './storage';

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
  recentSessions: { averageAccuracy: number }[],
): AdaptiveResult {
  const adjustments: TraitAdjustment[] = [];
  const updated = { ...profile };
  let traitIncreased = false;

  const traits: { name: string; key: keyof UserProfile; score: ModuleScore; currentTier: number }[] = [
    { name: 'Pattern Level', key: 'patternLevel', score: moduleScores.pattern, currentTier: profile.patternLevel },
    { name: 'Memory Span', key: 'memorySpan', score: moduleScores.memory, currentTier: profile.memorySpan },
    { name: 'Speed Index', key: 'speedIndex', score: moduleScores.ruleMutation, currentTier: profile.speedIndex },
    { name: 'Flexibility', key: 'flexibilityScore', score: moduleScores.dualTask, currentTier: profile.flexibilityScore },
    { name: 'Dual-Task', key: 'dualTaskCapacity', score: moduleScores.rapidLogic, currentTier: profile.dualTaskCapacity },
  ];

  traits.sort((a, b) => a.currentTier - b.currentTier);

  for (const trait of traits) {
    const accuracy = trait.score.accuracy;

    if (accuracy >= 80 && !traitIncreased) {
      const maxTier = updated.subscriptionType === 'premium' ? 50 : 20;
      const newVal = Math.min((trait.currentTier as number) + 1, maxTier);
      (updated as any)[trait.key] = newVal;
      adjustments.push({ trait: trait.name, change: 1, reason: `Accuracy ${accuracy.toFixed(0)}% - increased` });
      traitIncreased = true;
    } else if (accuracy < 60) {
      const newVal = Math.max((trait.currentTier as number) - 1, 1);
      (updated as any)[trait.key] = newVal;
      adjustments.push({ trait: trait.name, change: -1, reason: `Accuracy ${accuracy.toFixed(0)}% - decreased` });
    } else {
      adjustments.push({ trait: trait.name, change: 0, reason: `Accuracy ${accuracy.toFixed(0)}% - maintained` });
    }
  }

  let leveledUp = false;
  const last3 = [...recentSessions.slice(-2), { averageAccuracy: calculateOverallAccuracy(moduleScores) }];
  if (last3.length >= 3) {
    const avgLast3 = last3.reduce((sum, s) => sum + s.averageAccuracy, 0) / last3.length;
    const allModulesAbove70 = Object.values(moduleScores).every(m => m.accuracy >= 70);
    const maxLevel = updated.subscriptionType === 'premium' ? 50 : 20;

    if (avgLast3 >= 85 && allModulesAbove70 && updated.level < maxLevel) {
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
  return scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length;
}

export function calculateBaselineLevel(results: { category: string; correct: boolean; reactionTimeMs: number }[]): {
  level: number;
  patternLevel: number;
  memorySpan: number;
  speedIndex: number;
  flexibilityScore: number;
  dualTaskCapacity: number;
} {
  const categories: Record<string, { correct: number; total: number; avgTime: number }> = {};

  for (const r of results) {
    if (!categories[r.category]) {
      categories[r.category] = { correct: 0, total: 0, avgTime: 0 };
    }
    categories[r.category].total++;
    if (r.correct) categories[r.category].correct++;
    categories[r.category].avgTime += r.reactionTimeMs;
  }

  for (const cat of Object.values(categories)) {
    cat.avgTime = cat.total > 0 ? cat.avgTime / cat.total : 5000;
  }

  const getScore = (cat: string): number => {
    const c = categories[cat];
    if (!c) return 1;
    const accuracy = c.correct / c.total;
    const speedBonus = c.avgTime < 3000 ? 1 : 0;
    return Math.max(1, Math.min(5, Math.round(accuracy * 5 + speedBonus)));
  };

  const patternLevel = getScore('pattern');
  const memorySpan = Math.max(4, getScore('memory') + 3);
  const speedIndex = getScore('speed');
  const flexibilityScore = getScore('flexibility');
  const dualTaskCapacity = Math.round((patternLevel + speedIndex) / 2);

  const composite = (patternLevel + speedIndex + flexibilityScore + dualTaskCapacity) / 4;
  const level = Math.max(1, Math.min(5, Math.round(composite)));

  return { level, patternLevel, memorySpan, speedIndex, flexibilityScore, dualTaskCapacity };
}

export function getTimerForModule(module: string, tier: number): number {
  const base: Record<string, number> = {
    pattern: 15,
    memory: 10,
    ruleMutation: 12,
    dualTask: 15,
    rapidLogic: 10,
  };
  const b = base[module] || 12;
  return Math.max(4, b - Math.floor(tier / 3));
}
