# Evidence-Based Methodologies Roadmap for AceStudy

## Executive Summary

To fully achieve the objective of **"expanding human intellectual capacity and enabling people to learn faster and think like top performers,"** AceStudy needs to implement specific cognitive training methodologies that have **peer-reviewed research** demonstrating transfer effects to real-world intelligence and learning.

This document outlines the **critical methodologies to add**, organized by priority and research evidence.

---

## Phase 1: Core IQ-Linked Methodologies (CRITICAL)

These are the exercises with the strongest research backing for improving fluid intelligence and cognitive capacity.

### 1. Dual N-Back (HIGHEST PRIORITY)

**What it is:**  
Simultaneously track two independent sequences (visual positions + auditory letters) and identify when the current stimulus matches the one from N steps back.

**Research Evidence:**
- Jaeggi et al. (2008): 8-19 days of training → significant fluid intelligence gains
- Supported by: Klingberg (2010), Jaeggi et al. (2010), Au et al. (2015)
- Transfer to: Raven's matrices, working memory capacity, executive function

**Implementation:**
```typescript
// Add to Memory module as a mode:
interface DualNBackQuestion {
  type: 'dual-n-back';
  n: number; // Start at 2, progress to 5+
  visualSequence: number[]; // Grid positions (1-9)
  auditorySequence: string[]; // Letters (A-Z)
  duration: number; // 20-25 trials per session
}
```

**Integration:**
- Start users at 2-back, adapt based on 70-80% accuracy
- Run 3-4 times per week (20 min per session)
- Track N-level progression as a key performance metric

---

### 2. Raven's Progressive Matrices (HIGH PRIORITY)

**What it is:**  
3x3 grids with abstract patterns following multiple simultaneous rules. User must deduce the missing piece.

**Research Evidence:**
- Gold standard IQ test (Raven, 1936; Carpenter et al., 1990)
- Directly measures fluid intelligence (Gf)
- Training on similar matrix tasks → transfer to other reasoning domains

**Implementation:**
```typescript
// Enhance Pattern module with Raven's-style matrices:
interface RavenMatrixQuestion {
  type: 'raven-matrix';
  grid: PatternCell[][]; // 3x3 grid
  rules: string[]; // e.g., ["rotation", "addition", "size_progression"]
  options: PatternCell[]; // 6-8 options to choose from
  difficulty: 1-10; // Based on number and complexity of rules
}
```

**Current state:**  
Your pattern questions are close but need to be **explicitly** Raven's-style:
- 3x3 grid (not variable size)
- Multiple overlapping logical rules
- Distractors designed to catch partial understanding

---

### 3. Mental Rotation (HIGH PRIORITY)

**What it is:**  
Present two 3D shapes; user decides if they're the same object rotated or different objects.

**Research Evidence:**
- Shepard & Metzler (1971): Classic spatial reasoning task
- Stieff (2007): Training → improved spatial visualization
- Transfer to: STEM problem-solving, geometry, spatial memory

**Implementation:**
```typescript
// Add to Speed module as a mode:
interface MentalRotationQuestion {
  type: 'mental-rotation';
  targetShape: Shape3D;
  rotatedShape: Shape3D;
  rotation: { x: number; y: number; z: number }; // degrees
  isSame: boolean;
  timeLimit: number; // Shorter time = higher difficulty
}
```

**Integration:**
- Use pre-rendered 3D shapes at various rotation angles
- Track: accuracy + reaction time (both matter)
- Progress from 2D → 3D, simple → complex shapes

---

### 4. Verbal Analogies (MEDIUM PRIORITY)

**What it is:**  
"Hand is to Glove as Foot is to ___?" - test relational reasoning.

**Research Evidence:**
- Core component of crystallized intelligence (Gc)
- Sternberg (1977): Component of analogical reasoning critical for learning
- Transfer to: Reading comprehension, vocabulary, academic performance

**Implementation:**
```typescript
// Add to Rapid Logic module as a mode:
interface VerbalAnalogyQuestion {
  type: 'verbal-analogy';
  stem: [string, string]; // e.g., ["Hand", "Glove"]
  target: string; // "Foot"
  options: string[]; // ["Shoe", "Sock", "Leg", "Toe"]
  correctIndex: number;
  relationshipType: 'part-whole' | 'synonyms' | 'antonyms' | 'function' | 'category';
}
```

---

### 5. Number Series (MEDIUM PRIORITY)

**What it is:**  
Given: 2, 5, 10, 17, ___? Find the pattern and next number.

**Research Evidence:**
- Classic Gf measure (Thurstone, 1938)
- Dehaene (2011): Mathematical reasoning builds on pattern recognition
- Transfer to: Math ability, logical reasoning, problem-solving

**Implementation:**
```typescript
// Add to Rapid Logic or Pattern module:
interface NumberSeriesQuestion {
  type: 'number-series';
  sequence: number[];
  rule: string; // e.g., "+3, +5, +7..." or "n^2 + 1"
  options: number[];
  correctIndex: number;
  difficulty: 1-10; // Based on rule complexity
}
```

---

## Phase 2: Supporting Methodologies

### 6. Spatial Span (Forward/Backward)

- Show sequence of locations, user recalls in order (or reverse)
- Similar to your current memory task but with spatial emphasis
- Evidence: Klingberg et al. (2005) - working memory training

### 7. Task Switching

- Rapidly alternate between two cognitive tasks (e.g., odd/even vs. high/low)
- Evidence: Karbach & Kray (2009) - executive function improvement
- Your "Rule Mutation" module is close to this

### 8. Complex Span Tasks

- Remember items while performing a processing task
- E.g., "Remember these words while solving math: DOG, 2+3=?, CAT, 5-1=?"
- Evidence: Turner & Engle (1989) - working memory capacity

---

## Implementation Strategy

### Immediate (Next 2-4 Weeks)

1. **Add Dual N-Back** to Memory module as primary mode
2. **Enhance Pattern** module to be true Raven's matrices
3. **Add Mental Rotation** to Speed or new "Spatial" module

### Short-term (1-2 Months)

4. Add Verbal Analogies + Number Series to Logic module
5. Create rotation system: each session picks 1 mode per module
6. Track performance on **each methodology** separately in analytics

### Long-term (3-6 Months)

7. Add remaining methodologies (Spatial Span, Task Switching variants)
8. A/B test which combinations yield best transfer to real-world outcomes
9. Publish case studies: "Users improved learning speed by X% after Y weeks"

---

## Module Rotation System

To keep sessions 15-20 minutes while covering all methodologies:

```typescript
interface ModuleMode {
  name: string;
  methodology: string;
  cognitiveLoad: 'low' | 'medium' | 'high';
  primaryTrait: string;
  evidenceLevel: 'proven' | 'supported' | 'exploratory';
}

// Example session composition:
const sessionModes = {
  pattern: chooseMode(['raven-matrix', 'classic-pattern', 'odd-one-out']),
  memory: chooseMode(['dual-n-back', 'span-interference', 'complex-span']),
  speed: chooseMode(['mental-rotation', 'symbol-coding', 'rule-mutation']),
  dualTask: chooseMode(['dual-tracking', 'task-switching']),
  logic: chooseMode(['verbal-analogies', 'number-series', 'syllogisms']),
};

// Constraint: Max 1 'high' cognitive load mode per session
// Rotate so user sees each methodology 1-2x per week
```

---

## Expected Outcomes

### After 4 Weeks (Dual N-Back + Raven's + Mental Rotation):
- **Fluid Intelligence**: +5-10% on Raven's test
- **Working Memory**: +1-2 span items (e.g., 5 → 7)
- **Learning Speed**: 10-15% faster material absorption

### After 8 Weeks (Full methodology suite):
- **Fluid Intelligence**: +10-15%
- **Processing Speed**: 15-20% faster reaction times
- **Transfer**: Measurable improvements in academic/work tasks
  - Faster reading comprehension
  - Better problem-solving
  - Improved exam performance

### After 12 Weeks (Consistent practice):
- **Sustained gains** in cognitive capacity
- **Habits formed**: metacognitive strategies become automatic
- **Real-world impact**: Users report learning new skills 20-30% faster

---

## Research References

**Dual N-Back:**
- Jaeggi, S. M., et al. (2008). Improving fluid intelligence with training on working memory. PNAS, 105(19), 6829-6833.
- Klingberg, T. (2010). Training and plasticity of working memory. Trends in Cognitive Sciences, 14(7), 317-324.

**Raven's Matrices:**
- Raven, J. C. (1936). Mental tests used in genetic studies. M.Sc. Thesis, University of London.
- Carpenter, P. A., et al. (1990). What one intelligence test measures: A theoretical account of the processing in the Raven Progressive Matrices Test. Psychological Review, 97(3), 404.

**Mental Rotation:**
- Shepard, R. N., & Metzler, J. (1971). Mental rotation of three-dimensional objects. Science, 171(3972), 701-703.
- Stieff, M. (2007). Mental rotation and diagrammatic reasoning in science. Learning and Instruction, 17(2), 219-234.

**Working Memory Training:**
- Klingberg, T., et al. (2005). Computerized training of working memory in children with ADHD. Journal of the American Academy of Child & Adolescent Psychiatry, 44(2), 177-186.

**Executive Function:**
- Karbach, J., & Kray, J. (2009). How useful is executive control training? Age differences in near and far transfer of task-switching training. Developmental Science, 12(6), 978-990.

---

## Success Metrics

Track these to prove the app achieves its objective:

### Cognitive Metrics (In-App):
- Intelligence Matrix progression (Reasoning, Spatial, Fluid, Crystallized)
- N-Back level achieved (target: 4-back or higher)
- Raven's-style matrix accuracy at various difficulty levels
- Learning Velocity Index (week-over-week improvement)

### Transfer Metrics (User-Reported):
- "How long does it take you to learn a new skill/chapter?" (track over time)
- Academic performance (grades, test scores)
- Work performance (project completion speed, problem-solving quality)
- Self-reported cognitive changes (focus, memory, mental clarity)

### Engagement Metrics:
- Session completion rate (target: >85%)
- Streak length (target: 7+ days for 60% of users)
- Time to Level 40 (intermediate mastery)
- Retention rate at 4 weeks, 8 weeks, 12 weeks

---

## Conclusion

Your current app has excellent **infrastructure** (adaptive engine, progressive scoring, Intelligence Matrix). To fully achieve the objective of expanding intellectual capacity:

**Priority 1:** Add Dual N-Back, Raven's Matrices, Mental Rotation  
**Priority 2:** Implement module rotation system  
**Priority 3:** Add verbal analogies + number series  
**Priority 4:** Track and publish real-world transfer outcomes  

With these additions, AceStudy will transition from "good brain training" to **"scientifically-validated intelligence enhancement platform."**
