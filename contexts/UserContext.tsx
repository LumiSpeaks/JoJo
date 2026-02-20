import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  UserProfile,
  SessionLog,
  getUserProfile,
  saveUserProfile,
  getSessionLogs,
  saveSessionLog,
  createDefaultProfile,
} from '@/lib/storage';

interface UserContextValue {
  profile: UserProfile | null;
  sessionLogs: SessionLog[];
  isLoading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  addSessionLog: (log: SessionLog) => Promise<void>;
  resetProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  canStartSession: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const p = await getUserProfile();
    const logs = await getSessionLogs();
    setProfile(p);
    setSessionLogs(logs);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    await saveUserProfile(updated);
    setProfile(updated);
  };

  const addSessionLog = async (log: SessionLog) => {
    await saveSessionLog(log);
    setSessionLogs(prev => [...prev, log]);
  };

  const resetProfile = async () => {
    const newProfile = createDefaultProfile();
    await saveUserProfile(newProfile);
    setProfile(newProfile);
    setSessionLogs([]);
  };

  const refreshProfile = async () => {
    await loadData();
  };

  const canStartSession = useMemo(() => {
    if (!profile) return false;
    if (profile.subscriptionType === 'premium') return true;
    const today = new Date().toDateString();
    const sessionsToday = profile.lastSessionDate === today ? profile.sessionsToday : 0;
    return sessionsToday < 3;
  }, [profile]);

  const value = useMemo(
    () => ({
      profile,
      sessionLogs,
      isLoading,
      updateProfile,
      addSessionLog,
      resetProfile,
      refreshProfile,
      canStartSession,
    }),
    [profile, sessionLogs, isLoading, canStartSession],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
