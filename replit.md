# AceStudy

## Overview

AceStudy is an adaptive cognitive training mobile application built with Expo/React Native. It delivers truly personalized, AI-driven difficulty scaling across 5 cognitive training modules (Pattern Density, Working Memory Stretch, Rule Mutation, Dual-Task Processing, Rapid Logic Fire). Each user gets an individualized baseline assessment, and the system continuously analyzes their specific trait weaknesses to bias 15% more training toward their weakest areas. The app tracks stagnation (no improvement over 5 sessions) and dynamically adjusts difficulty, timer compression, and challenge variants per-trait. Includes 3-session daily cap for basic users, premium unlimited at $30/month, and level progression from 1-50.

## User Preferences

Preferred communication style: Simple, everyday language.
The system must be completely personalized and AI-directed—not generic levels, but truly adaptive difficulty calculated per-trait. The level system isn't the AI jurisdiction; the AI levels out what's needed. The process is all completely personal and calculated and directed.

## System Architecture

### Frontend (Expo/React Native)
- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture (`newArchEnabled: true`)
- **Routing**: expo-router with file-based routing. Main routes include:
  - `app/index.tsx` - Entry point that redirects based on profile state (onboarding vs tabs)
  - `app/onboarding.tsx` - Baseline cognitive assessment flow (30 questions across 5 categories)
  - `app/(tabs)/` - Main app with "Train" and "Progress" tabs
  - `app/session.tsx` - Active training session with 5 cognitive modules
  - `app/session-complete.tsx` - Post-session results and trait adjustment display
- **State Management**: React Context (`UserContext`) for user profile and session logs, TanStack React Query for server data fetching
- **UI**: Custom dark theme defined in `constants/colors.ts`, Inter font family via `@expo-google-fonts/inter`, Ionicons for icons
- **Animations**: React Native Animated API and react-native-reanimated

### Backend (Express)
- **Framework**: Express 5 with TypeScript, runs on port 5000
- **Server Entry**: `server/index.ts` sets up CORS, static file serving
- **Routes**: `server/routes.ts` - Minimal, designed for `/api` prefixed routes
- **Data storage is entirely client-side via AsyncStorage**

### Data Storage

**Client-side (Primary)**: AsyncStorage stores user profiles and session logs locally. `lib/storage.ts` defines:
- `UserProfile` - Contains 5 cognitive trait scores (patternLevel, memorySpan, speedIndex, flexibilityScore, dualTaskCapacity), level, subscription type, session counts
- `SessionLog` - Records per-module scores (accuracy, reaction time, difficulty tier), trait adjustments, level changes
- `ModuleScore` - Per-module performance metrics (accuracy, reactionTime, difficultyTier, questionsAnswered, correctAnswers)
- `TraitAdjustment` - Records trait changes with reasons after each session

### Adaptive Difficulty Engine (`lib/adaptive.ts`)

This is the core of the personalization system. Everything is calculated per-individual:

1. **Weakness Analysis** (`analyzeWeaknesses`): Ranks all 5 traits by current value, identifies the weakest, and determines which trait to focus on
2. **Stagnation Detection**: Checks the last 5 sessions for each trait. If a trait has had zero total change across 5 sessions, it's marked stagnant and gets variant challenges (format changes, timer compression, or completely different question types)
3. **15% Bias Weighting**: The weakest/focus trait gets 15% more question allocation than others. `questionCountBias` distributes session time unevenly toward weak areas
4. **Per-Trait Tier Calculation**: Each module's difficulty tier is independently calculated from that trait's value multiplied by a level factor. Pattern uses patternTier, Memory uses memoryTier, Rule Mutation uses speedTier, Dual-Task uses flexTier, Rapid Logic uses dualTier
5. **Timer Compression**: Global timer multiplier decreases by 1.5% per level (min 50%), making questions faster as the user improves
6. **Session Results Processing** (`processSessionResults`): Only ONE trait can increase per session (the weakest-performing one that scored 80%+ with improving reaction times). Traits below 60% accuracy decrease. Level-ups require 3 consecutive sessions averaging 85%+ with all modules above 70% and improving reaction times
7. **Stagnation Adjustments**: Three types - 'variant' (different question format), 'timerCompress' (shorter timers), 'formatChange' (different task type within the module)

**Trait-to-Module Mapping**:
- Pattern Density → patternLevel (pattern recognition)
- Working Memory Stretch → memorySpan (working memory span, min 4)
- Rule Mutation → speedIndex (processing speed)
- Dual-Task Processing → flexibilityScore (cognitive flexibility)
- Rapid Logic Fire → dualTaskCapacity (dual-task capacity)

### Question Generation (`lib/questions.ts`)

All questions are algorithmically generated on-the-fly based on the user's individual trait tiers:

- **Pattern**: Grid puzzles with 1-6 transformation layers (rotation, color shift, mirror, substitution, diagonal, positional shift) scaling with patternTier
- **Memory**: Sequences of 4-10 symbols with tasks (reverse, sort, filter, swap, removeAndReverse) that unlock at higher memoryTiers. Display time decreases with tier.
- **Rule Mutation**: Mathematical operations that change mid-session. Rule complexity and change frequency scale with speedTier. Higher tiers get complex operations (square root, conditional rules)
- **Dual-Task**: Simultaneous visual sequence completion + color flash counting. Sequence length and flash count scale with flexTier. Distractors activate at tier 8+
- **Rapid Logic**: Syllogisms and logical reasoning with countdown timer. Easy/medium/hard pools selected by dualTier. Timer shrinks with tier and global timerMultiplier

### Subscription Model
- **Basic**: Max Level 20, 3 sessions/day, core training
- **Premium**: Max Level 50, unlimited sessions, advanced analytics, faster adaptive scaling ($30/month)
- Enforced client-side in `UserContext.canStartSession`

## External Dependencies

### Core Framework
- **Expo SDK 54** - Cross-platform mobile framework
- **React 19.1** / **React Native 0.81** - UI framework
- **Express 5** - Backend HTTP server

### Data & State
- **@tanstack/react-query** - Server state management and caching
- **@react-native-async-storage/async-storage** - Local persistent storage

### UI & UX
- **expo-router** - File-based navigation
- **expo-linear-gradient** - Gradient backgrounds
- **expo-blur / expo-glass-effect** - Visual effects
- **expo-haptics** - Haptic feedback on native
- **react-native-reanimated** - Advanced animations
- **react-native-safe-area-context** - Safe area insets
- **@expo-google-fonts/inter** - Typography
- **@expo/vector-icons / Ionicons** - Icon sets

### Build Tools
- **esbuild** - Server bundling for production
- **tsx** - TypeScript execution for development

## Recent Changes

- 2026-02-20: Complete overhaul of adaptive engine to be truly personalized per-trait. Each module now reads from individual trait tiers calculated from the user's specific performance data. Added stagnation detection (5-session window), 15% weakness bias, timer compression, variant challenges for stagnant traits. Only one trait increases per session (weakest-performing prioritized). Home screen now shows "Adaptive Focus" card with AI targeting info.
