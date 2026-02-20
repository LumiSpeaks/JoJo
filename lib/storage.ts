import AsyncStorage from '@react-native-async-storage/async-storage';

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
  totalSessions: number;
  createdAt: string;
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
  USER_PROFILE: 'acestudy_user_profile',
  SESSION_LOGS: 'acestudy_session_logs',
  CURRENT_SESSION: 'acestudy_current_session',
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
    totalSessions: 0,
    createdAt: new Date().toISOString(),
  };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
  if (!data) return null;
  const profile: UserProfile = JSON.parse(data);
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
