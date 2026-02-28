# Intelligence Matrix: Progressive Scoring System

## Overview

The Intelligence Matrix provides four higher-order cognitive indices that are **truly progressive** — they increase as users advance through levels and tackle harder questions.

## The Four Indices

1. **Reasoning** - Problem solving & logical thinking
2. **Spatial** - Visual-spatial reasoning
3. **Fluid** - Novel problem solving ability (adapting to new situations)
4. **Crystallized** - Knowledge application (using learned patterns)

---

## How Progressive Scoring Works

### The Problem with Simple Accuracy

❌ **Old approach (broken):**
```
Reasoning = 0.3 × Pattern Accuracy + 0.3 × Speed Accuracy + 0.4 × Logic Accuracy
```

**Issue:** A Level 1 user scoring 80% on easy Tier 1 questions gets the same score (80) as a Level 50 user scoring 80% on hard Tier 50 questions.

### The Solution: Weighted Difficulty Scoring

✅ **New approach (progressive):**
```
Raw Score = (Accuracy / 100) × Difficulty Tier × Level Multiplier
Final Score = (Raw Score / Max Possible Score) × 100
```

### Components

1. **Accuracy** (0-100%): How well they performed
2. **Difficulty Tier** (1-100): How hard the questions were
3. **Level Multiplier** (1.0-1.5x): Bonus based on overall level
   - Level 1: 1.0x
   - Level 50: 1.25x
   - Level 100: 1.5x

4. **Max Possible Score**: 100 (tier) × 1.5 (multiplier) = 150

---

## Example Progression

### Scenario: User maintaining 80% accuracy as they level up

| User Level | Tier | Level Mult | Raw Score | Final Reasoning | Interpretation |
|------------|------|------------|-----------|-----------------|----------------|
| 1          | 1    | 1.0x       | 0.8       | **5**           | Beginner |
| 10         | 10   | 1.05x      | 8.4       | **19**          | Novice |
| 25         | 25   | 1.125x     | 22.5      | **40**          | Intermediate |
| 50         | 50   | 1.25x      | 50        | **67**          | Advanced |
| 75         | 75   | 1.375x     | 82.5      | **85**          | Expert |
| 100        | 100  | 1.5x       | 120       | **93**          | Master |

**Key insight:** Even with constant 80% accuracy, the score increases from 5 → 93 as the user tackles progressively harder content.

---

## Calculation Details

### Per-Module Weighted Scores

For each cognitive module:
```typescript
moduleWeightedScore = (accuracy / 100) × difficultyTier × levelMultiplier
```

Example for Pattern module at Level 50:
- Accuracy: 85%
- Difficulty Tier: 50
- Level Multiplier: 1.25
- **Weighted Score: 0.85 × 50 × 1.25 = 53.125**

### Combining into Indices

Each index combines multiple modules with domain-specific weights:

**Reasoning Index:**
```
(0.3 × Pattern + 0.3 × RuleMutation + 0.4 × RapidLogic) / 150 × 100
```

**Spatial Index:**
```
(0.55 × Pattern + 0.45 × DualTask) / 150 × 100
```

**Fluid Index:**
```
(0.25 × Pattern + 0.25 × Memory + 0.25 × RuleMutation + 0.25 × DualTask) / 150 × 100
```

**Crystallized Index:**
```
(0.8 × RapidLogic + 0.2 × Pattern) / 150 × 100
```

---

## Why This Design Works

### 1. Reflects Absolute Ability
Scores increase with level because users are solving objectively harder problems.

### 2. Rewards Mastery
Maintaining high accuracy on high-tier content yields proportionally higher scores.

### 3. Prevents Inflation
Normalization to max possible score (150) keeps scores in 0-100 range.

### 4. Motivates Progression
Users see tangible score growth as they advance, even if their accuracy plateaus.

---

## Expected Score Ranges by Level

| Level Range | Expected Index Range | Description |
|-------------|---------------------|-------------|
| 1-10        | 5-20                | Beginner - Building foundations |
| 11-25       | 20-45               | Novice - Gaining competence |
| 26-40       | 45-60               | Intermediate - Solid skills |
| 41-60       | 60-75               | Advanced - Strong performance |
| 61-80       | 75-88               | Expert - High mastery |
| 81-100      | 88-100              | Master - Peak performance |

---

## Implementation Notes

### Where It's Calculated
- **File:** `lib/adaptive.ts`
- **Function:** `calculateIntelligenceIndices(moduleScores, userLevel)`

### Where It's Used
- **Session Complete Screen:** Displays all 4 indices after each session
- **User Profile:** Stored as `reasoningIndex`, `spatialIndex`, `fluidIndex`, `crystallizedIndex`
- **Session Logs:** Tracked over time for progress visualization

### Key Invariants
- Indices always range from 0 to 100
- Higher level + higher tier + same accuracy = higher score
- Score increases are proportional to difficulty increases
- Level multiplier provides a small (up to 50%) bonus at max level

---

## Future Enhancements

Potential additions to make indices even more meaningful:

1. **Historical Trending:** Show 30-day moving average
2. **Percentile Ranking:** Compare to all users
3. **Domain Recommendations:** "Your Spatial score is lagging; focus on Pattern modules"
4. **IQ Proxy Calibration:** Map scores to approximate IQ ranges (with disclaimers)
5. **Certificate Milestones:** Award achievements at 50, 75, 90 thresholds
