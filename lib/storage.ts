import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stored answers from the onboarding questionnaire (learning capacity & goals). */
export interface OnboardingAnswers {
  /** e.g. "slow-to-grasp" | "forget-quickly" | "easily-distracted" | "want-faster" */
  learningSituation?: string;
  /** e.g. ["short-focus", "overload", "slow-processing", "poor-retention"] */
  learningChallenges?: string[];
  /** e.g. "speed" | "memory" | "patterns" | "focus" | "all" */
  learningArea?: string;
  /** e.g. "less-time" | "retain-more" | "focus-under-pressure" | "think-faster" | "habit" */
  learningGoal?: string;
  /** e.g. "frustrated" | "behind" | "stuck" | "okay-want-better" | "worried" */
  futureIfNoChange?: string;
  /** e.g. "every-day" | "most-days" | "few-times-week" | "when-deadline" */
  studyFrequency?: string;
  /** e.g. ["short-sessions", "adaptive-difficulty", "clear-progress", "variety"] */
  whatWouldHelp?: string[];
}

/** Higher-order intelligence indices derived from module performance. */
export interface IntelligenceIndices {
  /** Composite reasoning / problem-solving score (0–100). */
  reasoning: number;
  /** Composite spatial / visual reasoning score (0–100). */
  spatial: number;
  /** Composite fluid intelligence proxy (0–100). */
  fluid: number;
  /** Composite crystallized intelligence proxy (0–100). */
  crystallized: number;
}

export interface UserProfile {
  id: string;
  level: number;
  patternLevel: number;
  memorySpan: number;
  speedIndex: number;
  flexibilityScore: number;
  dualTaskCapacity: number;
  calibrationScore: number;
  subscriptionType: 'basic' | 'premium';
  sessionsToday: number;
  lastSessionDate: string;
  baselineCompleted: boolean;
  /** When true, user has completed the initial goal/clarity questionnaire. */
  questionnaireCompleted: boolean;
  /** Answers from the onboarding questionnaire; used to adapt the experience. */
  onboardingAnswers?: OnboardingAnswers;
  totalSessions: number;
  createdAt: string;
  /** Higher-order intelligence indices (0–100), derived from modules. */
  reasoningIndex?: number;
  spatialIndex?: number;
  fluidIndex?: number;
  crystallizedIndex?: number;
  /** Consecutive days trained (for streak tracking). */
  currentStreak?: number;
  /** Longest streak ever achieved. */
  longestStreak?: number;
  /** Last date streak was updated. */
  lastStreakDate?: string;
  /** Current Dual N-Back level (2 = 2-back, 3 = 3-back, etc.) */
  nBackLevel?: number;
  /** Best N-Back level ever achieved. */
  nBackBest?: number;
  /** App Theme preference */
  theme?: 'system' | 'light' | 'dark';
  /** App Language preference */
  language?: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ru';
  /** Jojo Protocol: Strict Mode (Fail session if accuracy < 80%) */
  strictMode?: boolean;
}

export interface SessionLog {
  id: string;
  date: string;
  moduleScores: {
    pattern: ModuleScore;
    memory: ModuleScore;
    ruleMutation: ModuleScore;
    dualTask: ModuleScore;
    rapidLogic: ModuleScore;
  };
  averageAccuracy: number;
  averageReactionTime: number;
  traitAdjustments: TraitAdjustment[];
  levelBefore: number;
  levelAfter: number;
  /** Higher-order intelligence indices for this session. */
  intelligenceIndices?: IntelligenceIndices;
}

export interface ModuleScore {
  accuracy: number;
  reactionTime: number;
  difficultyTier: number;
  questionsAnswered: number;
  correctAnswers: number;
}

export interface TraitAdjustment {
  trait: string;
  change: number;
  reason: string;
}

const KEYS = {
  USER_PROFILE: 'jojo_user_profile',
  SESSION_LOGS: 'jojo_session_logs',
  CURRENT_SESSION: 'jojo_current_session',
};

export function createDefaultProfile(): UserProfile {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    level: 1,
    patternLevel: 1,
    memorySpan: 4,
    speedIndex: 1,
    flexibilityScore: 1,
    dualTaskCapacity: 1,
    calibrationScore: 1,
    subscriptionType: 'basic',
    sessionsToday: 0,
    lastSessionDate: '',
    baselineCompleted: false,
    questionnaireCompleted: false,
    totalSessions: 0,
    createdAt: new Date().toISOString(),
    reasoningIndex: 0,
    spatialIndex: 0,
    fluidIndex: 0,
    crystallizedIndex: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStreakDate: '',
    nBackLevel: 2,
    nBackBest: 2,
    theme: 'system',
    language: 'en',
    strictMode: false,
  };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
  if (!data) return null;
  const profile: UserProfile = JSON.parse(data);
  if (profile.questionnaireCompleted === undefined) {
    profile.questionnaireCompleted = false;
  }
  if (profile.reasoningIndex === undefined) {
    profile.reasoningIndex = 0;
    profile.spatialIndex = 0;
    profile.fluidIndex = 0;
    profile.crystallizedIndex = 0;
  }
  if (profile.currentStreak === undefined) {
    profile.currentStreak = 0;
    profile.longestStreak = 0;
    profile.lastStreakDate = '';
  }
  if (profile.nBackLevel === undefined) {
    profile.nBackLevel = 2;
    profile.nBackBest = 2;
  }
  if (profile.theme === undefined) profile.theme = 'system';
  if (profile.language === undefined) profile.language = 'en';
  if (profile.strictMode === undefined) profile.strictMode = false;

  const today = new Date().toDateString();
  if (profile.lastSessionDate !== today) {
    profile.sessionsToday = 0;
  }
  return profile;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
}

export async function getSessionLogs(): Promise<SessionLog[]> {
  const data = await AsyncStorage.getItem(KEYS.SESSION_LOGS);
  if (!data) return [];
  return JSON.parse(data);
}

export async function saveSessionLog(log: SessionLog): Promise<void> {
  const logs = await getSessionLogs();
  logs.push(log);
  await AsyncStorage.setItem(KEYS.SESSION_LOGS, JSON.stringify(logs));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
