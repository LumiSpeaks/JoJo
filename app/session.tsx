import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { ModuleScore } from '@/lib/storage';
import {
  generatePatternQuestion,
  generateMemoryQuestion,
  generateRuleMutationQuestion,
  generateDualTaskQuestion,
  generateRapidLogicQuestion,
  generateRavenMatrix,
  generateMentalRotationQuestion,
  generateDualNBackSession,
  PatternQuestion,
  MemoryQuestion,
  RuleMutationQuestion,
  DualTaskQuestion,
  RapidLogicQuestion,
  RavenMatrixQuestion,
  MentalRotationQuestion,
  DualNBackSession,
} from '@/lib/questions';
import {
  calculateSessionDifficulty,
  getTimerForModule,
  getModuleDuration,
  SessionDifficultyConfig,
} from '@/lib/adaptive';
import { generateChallenge, GeneratedQuestion } from '@/lib/gemini'; // J.A.R.V.I.S. Protocol

const { width } = Dimensions.get('window');

type ModuleType = 'pattern' | 'memory' | 'ruleMutation' | 'dualTask' | 'rapidLogic';

const MODULE_META: { type: ModuleType; name: string; icon: string; color: string }[] = [
  { type: 'pattern', name: 'Pattern Density', icon: 'grid', color: Colors.dark.brand },
  { type: 'memory', name: 'Memory Stretch', icon: 'layers', color: '#7B61FF' },
  { type: 'ruleMutation', name: 'Rule Mutation', icon: 'shuffle', color: '#00E676' },
  { type: 'dualTask', name: 'Dual-Task', icon: 'git-merge', color: '#FFB74D' },
  { type: 'rapidLogic', name: 'Rapid Logic', icon: 'flash', color: '#FF6EC7' },
];

const SHAPE_ICONS: Record<string, string> = {
  circle: 'ellipse',
  triangle: 'triangle',
  square: 'square',
  diamond: 'diamond',
  star: 'star',
  hexagon: 'hexagon',
};

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const { profile, sessionLogs } = useUser();
  const [phase, setPhase] = useState<'intro' | 'moduleIntro' | 'playing' | 'done' | 'failed'>('intro');
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [previousRuleIdx, setPreviousRuleIdx] = useState<number | undefined>();
  const [memoryPhase, setMemoryPhase] = useState<'show' | 'answer'>('answer');
  const [dualTaskPhase, setDualTaskPhase] = useState<'visual' | 'count'>('visual');
  const [dualVisualAnswer, setDualVisualAnswer] = useState<number | null>(null);
  const [confidenceLevel, setConfidenceLevel] = useState<string | null>(null);
  const [moduleTimeLeft, setModuleTimeLeft] = useState(0);
  const [questionTimerLeft, setQuestionTimerLeft] = useState(0);
  const [diffConfig, setDiffConfig] = useState<SessionDifficultyConfig | null>(null);
  const [moduleDurations, setModuleDurations] = useState<Record<string, number>>({});

  const [moduleResults, setModuleResults] = useState<Record<ModuleType, { correct: number; total: number; totalReactionTime: number }>>({
    pattern: { correct: 0, total: 0, totalReactionTime: 0 },
    memory: { correct: 0, total: 0, totalReactionTime: 0 },
    ruleMutation: { correct: 0, total: 0, totalReactionTime: 0 },
    dualTask: { correct: 0, total: 0, totalReactionTime: 0 },
    rapidLogic: { correct: 0, total: 0, totalReactionTime: 0 },
  });

  // Dual N-Back state
  const [nBackSession, setNBackSession] = useState<DualNBackSession | null>(null);
  const [nBackTrialIndex, setNBackTrialIndex] = useState(0);
  const [nBackResponses, setNBackResponses] = useState<{ visual: boolean; auditory: boolean }[]>([]);
  const [nBackTrialVisible, setNBackTrialVisible] = useState(false);
  const [nBackUserPressedVisual, setNBackUserPressedVisual] = useState(false);
  const [nBackUserPressedAuditory, setNBackUserPressedAuditory] = useState(false);
  const [nBackScore, setNBackScore] = useState({ correct: 0, total: 0 });
  const [nBackComplete, setNBackComplete] = useState(false);
  const [nBackTutorialDismissed, setNBackTutorialDismissed] = useState(false);
  // Ref so scoring closure always reads the latest button presses (fixes stale-closure bug)
  const nBackResponsesRef = useRef<{ visual: boolean; auditory: boolean }[]>([]);

  // Session duration selection: 'quick' | 'standard' | 'deep'
  const [sessionDuration, setSessionDuration] = useState<'quick' | 'standard' | 'deep'>('standard');

  // Mental Rotation state
  const [rotationSelected, setRotationSelected] = useState<number | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceModuleRef = useRef<() => void>(() => {});
  const questionTimerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nBackTrialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  useEffect(() => {
    if (!profile) return;

    const config = calculateSessionDifficulty(profile, sessionLogs);
    setDiffConfig(config);

    const durations: Record<string, number> = {};
    for (const mod of MODULE_META) {
      durations[mod.type] = getModuleDuration(mod.type, config.questionCountBias);
    }
    setModuleDurations(durations);

    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // Auto-advance after 4s so user has time to pick duration; tapping a duration card also advances
    const introTimer = setTimeout(() => {
      setPhase('moduleIntro');
    }, 4000);

    return () => {
      clearTimeout(introTimer);
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
      if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
      if (nBackTrialTimerRef.current) clearTimeout(nBackTrialTimerRef.current);
    };
  }, []);

  const getTierForModule = useCallback((moduleType: ModuleType): number => {
    if (!diffConfig) return 1;
    switch (moduleType) {
      case 'pattern': return diffConfig.patternTier;
      case 'memory': return diffConfig.memoryTier;
      case 'ruleMutation': return diffConfig.speedTier;
      case 'dualTask': return diffConfig.flexTier;
      case 'rapidLogic': return diffConfig.dualTier;
      default: return 1;
    }
  }, [diffConfig]);

  const getStagnationMode = useCallback((moduleType: ModuleType): string | null => {
    if (!diffConfig) return null;
    return diffConfig.stagnationAdjustments[moduleType] || null;
  }, [diffConfig]);

  // Duration multipliers per session type
  const durationMultiplier = sessionDuration === 'quick' ? 0.33 : sessionDuration === 'deep' ? 2.0 : 1.0;

  const startModule = useCallback(() => {
    const moduleType = MODULE_META[currentModuleIndex].type;
    const baseDuration = moduleDurations[moduleType] || 180;
    const duration = Math.round(baseDuration * durationMultiplier);
    setPhase('playing');
    setQuestionIndex(0);
    setSelectedOption(null);
    setModuleTimeLeft(duration);
    setPreviousRuleIdx(undefined);
    setNBackComplete(false);
    generateNextQuestion(moduleType, 0);

    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = setInterval(() => {
      setModuleTimeLeft(prev => {
        if (prev <= 1) {
          if (timerInterval.current) clearInterval(timerInterval.current);
          // Always call the latest version via ref — fixes stale-closure bug
          advanceModuleRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentModuleIndex, profile, diffConfig, moduleDurations, durationMultiplier]);

  // Dual N-Back: auto-advance through pre-generated trials
  // Uses nBackResponsesRef so scoring always reads the LATEST button presses,
  // avoiding the stale-closure bug where initResponses (all false) was used.
  const runNBackTrial = useCallback((session: DualNBackSession, trialIdx: number) => {
    if (trialIdx >= session.trials.length) {
      // Score using the ref — guaranteed to be up-to-date
      const trialList = session.trials;
      const latestResponses = nBackResponsesRef.current;
      let correct = 0;
      const total = trialList.length * 2;
      latestResponses.forEach((r, i) => {
        if (r.visual === trialList[i].isVisualMatch) correct++;
        if (r.auditory === trialList[i].isAuditoryMatch) correct++;
      });
      setNBackScore({ correct, total });
      setModuleResults(prev => ({
        ...prev,
        memory: {
          correct: prev.memory.correct + correct,
          total: prev.memory.total + total,
          totalReactionTime: prev.memory.totalReactionTime + 2500,
        },
      }));
      setNBackTrialVisible(false);
      setNBackComplete(true);
      return;
    }
    setNBackTrialIndex(trialIdx);
    setNBackUserPressedVisual(false);
    setNBackUserPressedAuditory(false);
    setNBackTrialVisible(true);
    if (nBackTrialTimerRef.current) clearTimeout(nBackTrialTimerRef.current);
    nBackTrialTimerRef.current = setTimeout(() => {
      setNBackTrialVisible(false);
      nBackTrialTimerRef.current = setTimeout(() => {
        runNBackTrial(session, trialIdx + 1);
      }, 350);
    }, 2500);
  }, []);

  const generateNextQuestion = useCallback(async (moduleType: ModuleType, qIndex: number) => {
    if (!profile || !diffConfig) return;
    const tier = getTierForModule(moduleType);
    const stagnation = getStagnationMode(moduleType);

    // J.A.R.V.I.S. Protocol: Infinite Logic Generation
    if (moduleType === 'rapidLogic') {
      try {
        const challenge = await generateChallenge(tier, 'logic');
        if (challenge) {
          const timerSec = Math.max(10, 30 - Math.floor(tier / 5));
          setCurrentQuestion({
            type: 'rapidLogic',
            question: challenge.question,
            options: challenge.options,
            correctIndex: challenge.correctIndex,
            timerSeconds: timerSec,
            explanation: challenge.explanation // Stored for review
          });
          setQuestionStartTime(Date.now());
          setSelectedOption(null);
          setQuestionTimerLeft(timerSec);
          if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
          questionTimerInterval.current = setInterval(() => {
            setQuestionTimerLeft(prev => {
              if (prev <= 1) {
                if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          return;
        }
      } catch (e) {
        console.warn("J.A.R.V.I.S. Generation Failed, using fallback.");
      }
    }

    let question: any;
    switch (moduleType) {
      case 'pattern': {
        if (tier >= 5 && Math.random() < 0.45) { // Accelerated: was 15
          question = generateMentalRotationQuestion(tier);
          setRotationSelected(null);
        } else if (tier >= 3) { // Accelerated: was 8
          question = generateRavenMatrix(tier);
        } else {
          question = generatePatternQuestion(tier, stagnation);
        }
        break;
      }
      case 'memory': {
        if (tier >= 2 && qIndex === 0) { // Accelerated: was 8. Dual N-Back is now primary for tiers 2+
          const session = generateDualNBackSession(tier, profile.nBackLevel);
          const initResponses = Array.from({ length: session.trials.length }, () => ({ visual: false, auditory: false }));
          nBackResponsesRef.current = initResponses;
          setNBackSession(session);
          setNBackTrialIndex(0);
          setNBackResponses(initResponses);
          setNBackScore({ correct: 0, total: 0 });
          setNBackComplete(false);
          setNBackTutorialDismissed(false);
          runNBackTrial(session, 0);
          setCurrentQuestion(null);
          setQuestionStartTime(Date.now());
          setSelectedOption(null);
          return;
        } else if (tier >= 2) { // Match N-Back cutoff
          return;
        }
        question = generateMemoryQuestion(profile.memorySpan, tier, stagnation);
        setMemoryPhase('show');
        if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
        memoryTimerRef.current = setTimeout(() => setMemoryPhase('answer'), question.displayTimeMs);
        break;
      }
      case 'ruleMutation':
        question = generateRuleMutationQuestion(tier, qIndex, previousRuleIdx, stagnation);
        setPreviousRuleIdx(question.ruleIndex);
        break;
      case 'dualTask':
        question = generateDualTaskQuestion(tier, stagnation);
        setDualTaskPhase('visual');
        setDualVisualAnswer(null);
        break;
      case 'rapidLogic': {
        question = generateRapidLogicQuestion(tier, diffConfig.timerMultiplier, stagnation);
        setConfidenceLevel(null);
        const timerSec = question.timerSeconds;
        setQuestionTimerLeft(timerSec);
        if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
        questionTimerInterval.current = setInterval(() => {
          setQuestionTimerLeft(prev => {
            if (prev <= 1) {
              if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        break;
      }
    }

    setCurrentQuestion(question);
    setQuestionStartTime(Date.now());
    setSelectedOption(null);
  }, [profile, diffConfig, previousRuleIdx, getTierForModule, getStagnationMode, runNBackTrial]);

  const advanceModule = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
    if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
    if (nBackTrialTimerRef.current) clearTimeout(nBackTrialTimerRef.current);

    const maxModules = sessionDuration === 'quick' ? 2 : MODULE_META.length;
    if (currentModuleIndex < maxModules - 1) {
      setCurrentModuleIndex(prev => prev + 1);
      setPhase('moduleIntro');
    } else {
      setPhase('done');
      const scores: Record<string, ModuleScore> = {};
      for (const mod of MODULE_META) {
        const r = moduleResults[mod.type];
        scores[mod.type] = {
          accuracy: r.total > 0 ? (r.correct / r.total) * 100 : 0,
          reactionTime: r.total > 0 ? r.totalReactionTime / r.total : 0,
          difficultyTier: getTierForModule(mod.type),
          questionsAnswered: r.total,
          correctAnswers: r.correct,
        };
      }
      const memTier = diffConfig?.memoryTier ?? 1;
      const nBackN = nBackSession?.n ?? 0;
      router.replace({
        pathname: '/session-complete',
        params: {
          scores: JSON.stringify(scores),
          nBackN: nBackN.toString(),
          nBackAccuracy: nBackScore.total > 0
            ? ((nBackScore.correct / nBackScore.total) * 100).toFixed(1)
            : '0',
          memTier: memTier.toString(),
        },
      });
    }
  }, [currentModuleIndex, moduleResults, profile, getTierForModule, diffConfig, nBackSession, nBackScore]);

  // Keep the ref always pointing to the latest advanceModule — fixes stale-closure in setInterval
  advanceModuleRef.current = advanceModule;

  const handleAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const reactionTime = Date.now() - questionStartTime;
    const moduleType = MODULE_META[currentModuleIndex].type;
    const isCorrect = optionIndex === currentQuestion?.correctIndex;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }

    const newCorrect = prev[moduleType].correct + (isCorrect ? 1 : 0);
    const newTotal = prev[moduleType].total + 1;

    // J.A.R.V.I.S. Protocol: Strict Mode Failure Check
    if (profile?.strictMode && newTotal >= 5) {
      const currentAcc = (newCorrect / newTotal) * 100;
      if (currentAcc < 80) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setPhase('failed');
        return; // Stop processing
      }
    }

    setModuleResults(prev => ({
      ...prev,
      [moduleType]: {
        correct: newCorrect,
        total: newTotal,
        totalReactionTime: prev[moduleType].totalReactionTime + reactionTime,
      },
    }));

    if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);

    setTimeout(() => {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      generateNextQuestion(moduleType, nextIndex);
    }, 500);
  }, [selectedOption, questionStartTime, currentModuleIndex, currentQuestion, questionIndex, generateNextQuestion]);

  const handleDualVisualAnswer = useCallback((optionIndex: number) => {
    if (dualVisualAnswer !== null) return;
    setDualVisualAnswer(optionIndex);

    const isCorrect = optionIndex === currentQuestion?.visualTask?.correctIndex;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }

    setTimeout(() => {
      setDualTaskPhase('count');
    }, 400);
  }, [dualVisualAnswer, currentQuestion]);

  const handleDualCountAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const reactionTime = Date.now() - questionStartTime;
    const visualCorrect = dualVisualAnswer === currentQuestion?.visualTask?.correctIndex;
    const countCorrect = optionIndex === currentQuestion?.countingTask?.correctIndex;
    const bothCorrect = visualCorrect && countCorrect;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(bothCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }

    const newCorrect = prev.dualTask.correct + (bothCorrect ? 1 : 0);
    const newTotal = prev.dualTask.total + 1;

    // J.A.R.V.I.S. Protocol: Strict Mode Failure
    if (profile?.strictMode && newTotal >= 5) {
      if ((newCorrect / newTotal) * 100 < 80) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPhase('failed');
        return;
      }
    }

    setModuleResults(prev => ({
      ...prev,
      dualTask: {
        correct: newCorrect,
        total: newTotal,
        totalReactionTime: prev.dualTask.totalReactionTime + reactionTime,
      },
    }));

    setTimeout(() => {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      generateNextQuestion('dualTask', nextIndex);
    }, 500);
  }, [selectedOption, dualVisualAnswer, currentQuestion, questionStartTime, questionIndex, generateNextQuestion]);

  const handleNBackVisualPress = useCallback(() => {
    if (nBackUserPressedVisual || !nBackTrialVisible) return;
    setNBackUserPressedVisual(true);
    // Write to ref immediately (no re-render delay) so scoring sees the press
    if (nBackResponsesRef.current[nBackTrialIndex]) {
      nBackResponsesRef.current[nBackTrialIndex] = { ...nBackResponsesRef.current[nBackTrialIndex], visual: true };
    }
    setNBackResponses(prev => {
      const updated = [...prev];
      if (updated[nBackTrialIndex]) updated[nBackTrialIndex] = { ...updated[nBackTrialIndex], visual: true };
      return updated;
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [nBackUserPressedVisual, nBackTrialVisible, nBackTrialIndex]);

  const handleNBackAuditoryPress = useCallback(() => {
    if (nBackUserPressedAuditory || !nBackTrialVisible) return;
    setNBackUserPressedAuditory(true);
    // Write to ref immediately (no re-render delay) so scoring sees the press
    if (nBackResponsesRef.current[nBackTrialIndex]) {
      nBackResponsesRef.current[nBackTrialIndex] = { ...nBackResponsesRef.current[nBackTrialIndex], auditory: true };
    }
    setNBackResponses(prev => {
      const updated = [...prev];
      if (updated[nBackTrialIndex]) updated[nBackTrialIndex] = { ...updated[nBackTrialIndex], auditory: true };
      return updated;
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [nBackUserPressedAuditory, nBackTrialVisible, nBackTrialIndex]);

  const handleRotationAnswer = useCallback((optionIndex: number) => {
    if (rotationSelected !== null) return;
    setRotationSelected(optionIndex);
    const reactionTime = Date.now() - questionStartTime;
    const isCorrect = optionIndex === (currentQuestion as MentalRotationQuestion)?.correctIndex;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }
    setModuleResults(prev => ({
      ...prev,
      pattern: {
        correct: prev.pattern.correct + (isCorrect ? 1 : 0),
        total: prev.pattern.total + 1,
        totalReactionTime: prev.pattern.totalReactionTime + reactionTime,
      },
    }));
    setTimeout(() => {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      generateNextQuestion('pattern', nextIndex);
    }, 500);
  }, [rotationSelected, questionStartTime, currentQuestion, questionIndex, generateNextQuestion]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (phase === 'failed') {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.failCard}>
          <Ionicons name="warning" size={64} color={Colors.dark.error} />
          <Text style={styles.failTitle}>PROTOCOL FAILED</Text>
          <Text style={styles.failSub}>Accuracy dropped below 80%.</Text>
          <Text style={styles.failDesc}>
            J.A.R.V.I.S. demands excellence. Strict Mode requires near-perfect execution to ensure rapid cognitive adaptation.
          </Text>
          <View style={styles.failStats}>
            <Text style={styles.failStatLabel}>Module Failed:</Text>
            <Text style={styles.failStatValue}>{MODULE_META[currentModuleIndex].name}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.failBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.failBtnText}>ABORT SESSION</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === 'intro') {
    const focusName = diffConfig?.focusTraitName || 'Cognitive Training';
    const isPremium = profile?.subscriptionType === 'premium';
    const durations = [
      { key: 'quick' as const, label: 'Quick Boost', mins: '5 min', desc: '1–2 modules', icon: 'flash' as const, premium: false },
      { key: 'standard' as const, label: 'Standard', mins: '15 min', desc: '5 modules', icon: 'fitness' as const, premium: false },
      { key: 'deep' as const, label: 'Deep Focus', mins: '30 min', desc: 'Extended training', icon: 'rocket' as const, premium: true },
    ];
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Animated.View style={[styles.introContent, { opacity: fadeAnim }]}>
          <Text style={styles.introLabel}>SESSION FOCUS</Text>
          <Text style={styles.introTitle}>{focusName}</Text>

          <Text style={styles.durationPickerLabel}>Choose session length</Text>
          <View style={styles.durationPicker}>
            {durations.map(d => {
              const locked = d.premium && !isPremium;
              return (
                <Pressable
                  key={d.key}
                  style={[
                    styles.durationOption,
                    sessionDuration === d.key && !locked && styles.durationOptionActive,
                    locked && styles.durationOptionLocked,
                  ]}
                  onPress={() => {
                    if (locked) return;
                    setSessionDuration(d.key);
                    setPhase('moduleIntro');
                  }}
                >
                  <Ionicons
                    name={locked ? 'lock-closed' : d.icon}
                    size={20}
                    color={locked ? Colors.dark.textTertiary : sessionDuration === d.key ? Colors.dark.brand : Colors.dark.textSecondary}
                  />
                  <Text style={[
                    styles.durationOptionLabel,
                    sessionDuration === d.key && !locked && styles.durationOptionLabelActive,
                    locked && styles.durationOptionLabelLocked,
                  ]}>{d.label}</Text>
                  <Text style={[styles.durationOptionMins, locked && { color: Colors.dark.textTertiary }]}>{d.mins}</Text>
                  {locked
                    ? <Text style={styles.durationOptionPremiumBadge}>Premium</Text>
                    : <Text style={styles.durationOptionDesc}>{d.desc}</Text>
                  }
                </Pressable>
              );
            })}
          </View>

          {diffConfig && (
            <View style={styles.introTierPreview}>
              {[
                { label: 'PTN', val: diffConfig.patternTier },
                { label: 'MEM', val: diffConfig.memoryTier },
                { label: 'SPD', val: diffConfig.speedTier },
                { label: 'FLX', val: diffConfig.flexTier },
                { label: 'DUL', val: diffConfig.dualTier },
              ].map((t, i) => (
                <View key={i} style={styles.introTierItem}>
                  <Text style={styles.introTierValue}>{t.val}</Text>
                  <Text style={styles.introTierLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </View>
    );
  }

  if (phase === 'moduleIntro') {
    const meta = MODULE_META[currentModuleIndex];
    const duration = moduleDurations[meta.type] || 240;
    const tier = getTierForModule(meta.type);
    const stagnation = getStagnationMode(meta.type);

    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.moduleIntroContent}>
          <View style={styles.moduleCounter}>
            <Text style={styles.moduleCounterText}>MODULE {currentModuleIndex + 1} / 5</Text>
          </View>
          <View style={[styles.moduleIconBg, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon as any} size={40} color={meta.color} />
          </View>
          <Text style={styles.moduleIntroTitle}>{meta.name}</Text>
          <Text style={styles.moduleIntroDuration}>{Math.ceil(duration / 60)} min  |  Tier {tier}</Text>
          {stagnation && (
            <View style={styles.stagnationBadge}>
              <Ionicons name="pulse" size={14} color={Colors.dark.warning} />
              <Text style={styles.stagnationText}>Variant challenge active</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.moduleStartBtn, pressed && { opacity: 0.85 }]}
            onPress={startModule}
          >
            <Ionicons name="play" size={20} color="#0A0A0F" />
            <Text style={styles.moduleStartBtnText}>Begin</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = MODULE_META[currentModuleIndex];
  const moduleType = meta.type;

  const renderQuestion = () => {
    // ── Dual N-Back (memory module at tier >= 8) ────────────────────────────
    if (moduleType === 'memory' && nBackSession) {
      const trial = nBackSession.trials[nBackTrialIndex];
      const gridPos = trial?.visualPosition ?? 0;
      const letter = trial?.auditoryLetter ?? '';
      const n = nBackSession.n;
      const totalTrials = nBackSession.trials.length;
      const progressPct = (Math.min(nBackTrialIndex + 1, totalTrials) / totalTrials) * 100;
      const trialsUntilActive = Math.max(0, n - nBackTrialIndex);
      const buttonsLocked = !nBackTrialVisible || nBackTrialIndex < n;
      const isFirstEverNBack = (profile?.nBackBest ?? 2) <= 2 && (profile?.totalSessions ?? 0) < 3;

      // N-Back complete — show results while waiting for module timer
      if (nBackComplete) {
        const accuracy = nBackScore.total > 0 ? Math.round((nBackScore.correct / nBackScore.total) * 100) : 0;
        return (
          <View style={styles.questionArea}>
            <View style={styles.nBackCompleteCard}>
              <Ionicons name="checkmark-circle" size={44} color={accuracy >= 80 ? Colors.dark.success : accuracy >= 50 ? Colors.dark.warning : Colors.dark.error} />
              <Text style={styles.nBackCompleteTitle}>Memory Challenge Done</Text>
              <Text style={styles.nBackCompleteScore}>{accuracy}%</Text>
              <Text style={styles.nBackCompleteLabel}>accuracy on {n}-Back</Text>
              <Text style={styles.nBackCompleteHint}>
                {accuracy >= 80 ? `N-Back level advances to ${n + 1} next session` : accuracy >= 50 ? 'Keep practicing — level holds' : `Level adjusts to ${Math.max(2, n - 1)}-Back next session`}
              </Text>
              <Text style={styles.nBackCompleteWait}>Next module starts automatically...</Text>
            </View>
          </View>
        );
      }

      // First-time tutorial — shown via explicit state, dismissed by user tap
      if (isFirstEverNBack && !nBackTutorialDismissed) {
        return (
          <View style={styles.questionArea}>
            <View style={styles.nBackTutorialCard}>
              <View style={styles.nBackTutorialHeader}>
                <Ionicons name="layers" size={22} color="#7B61FF" />
                <Text style={styles.nBackTutorialTitle}>Memory Challenge Unlocked</Text>
              </View>
              <Text style={styles.nBackTutorialBody}>
                Watch the grid — a square will <Text style={styles.nBackTutorialHighlight}>light up</Text>.{'\n'}
                A <Text style={styles.nBackTutorialHighlight}>letter</Text> will appear below it.{'\n\n'}
                After {n} trials, tap:
              </Text>
              <View style={styles.nBackTutorialRows}>
                <View style={styles.nBackTutorialRow}>
                  <Ionicons name="grid" size={16} color={Colors.dark.brand} />
                  <Text style={styles.nBackTutorialRowText}>
                    <Text style={{ color: Colors.dark.brand }}>Position Match</Text> — same square as {n} ago
                  </Text>
                </View>
                <View style={styles.nBackTutorialRow}>
                  <Ionicons name="text" size={16} color="#7B61FF" />
                  <Text style={styles.nBackTutorialRowText}>
                    <Text style={{ color: '#7B61FF' }}>Letter Match</Text> — same letter as {n} ago
                  </Text>
                </View>
              </View>
              <Text style={styles.nBackTutorialNote}>
                You can tap both, one, or neither — each trial is independent.
              </Text>
              <Pressable
                style={styles.nBackTutorialBtn}
                onPress={() => setNBackTutorialDismissed(true)}
              >
                <Text style={styles.nBackTutorialBtnText}>Got it — Start</Text>
                <Ionicons name="arrow-forward" size={16} color="#0A0A0F" />
              </Pressable>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.questionArea}>
          <Text style={styles.nBackLabel}>{n}-BACK  ·  Trial {nBackTrialIndex + 1}/{totalTrials}</Text>
          <View style={styles.nBackProgressBar}>
            <View style={[styles.nBackProgressFill, { width: `${progressPct}%` }]} />
          </View>
          {nBackTrialIndex < n ? (
            <Text style={styles.nBackHint}>
              Memorising... {trialsUntilActive > 0 ? `${trialsUntilActive} more before you respond` : 'Ready!'}
            </Text>
          ) : (
            <Text style={styles.nBackHint}>Does this match {n} trials ago?</Text>
          )}

          {/* 3×3 position grid */}
          <View style={styles.nBackGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.nBackCell,
                  nBackTrialVisible && i === gridPos && styles.nBackCellActive,
                ]}
              />
            ))}
          </View>

          {/* Auditory letter display */}
          <View style={styles.nBackLetterBox}>
            <Text style={[styles.nBackLetter, nBackTrialVisible ? styles.nBackLetterVisible : styles.nBackLetterHidden]}>
              {nBackTrialVisible ? letter : '·'}
            </Text>
          </View>

          {/* Response buttons — show countdown when locked */}
          <View style={styles.nBackBtnRow}>
            <Pressable
              style={[
                styles.nBackBtn,
                nBackUserPressedVisual && styles.nBackBtnPressed,
                buttonsLocked && styles.nBackBtnLocked,
              ]}
              onPress={handleNBackVisualPress}
              disabled={buttonsLocked}
            >
              <Ionicons
                name="grid"
                size={20}
                color={buttonsLocked ? Colors.dark.textTertiary : nBackUserPressedVisual ? Colors.dark.brand : Colors.dark.textSecondary}
              />
              <View>
                <Text style={[
                  styles.nBackBtnText,
                  nBackUserPressedVisual && styles.nBackBtnTextActive,
                  buttonsLocked && styles.nBackBtnTextLocked,
                ]}>
                  Position Match
                </Text>
                {buttonsLocked && trialsUntilActive > 0 && (
                  <Text style={styles.nBackBtnCountdown}>{trialsUntilActive} more to go</Text>
                )}
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.nBackBtn,
                nBackUserPressedAuditory && styles.nBackBtnPressed,
                buttonsLocked && styles.nBackBtnLocked,
              ]}
              onPress={handleNBackAuditoryPress}
              disabled={buttonsLocked}
            >
              <Ionicons
                name="text"
                size={20}
                color={buttonsLocked ? Colors.dark.textTertiary : nBackUserPressedAuditory ? '#7B61FF' : Colors.dark.textSecondary}
              />
              <View>
                <Text style={[
                  styles.nBackBtnText,
                  nBackUserPressedAuditory && { color: '#7B61FF' },
                  buttonsLocked && styles.nBackBtnTextLocked,
                ]}>
                  Letter Match
                </Text>
                {buttonsLocked && trialsUntilActive > 0 && (
                  <Text style={styles.nBackBtnCountdown}>{trialsUntilActive} more to go</Text>
                )}
              </View>
            </Pressable>
          </View>

          {nBackScore.total > 0 && (
            <Text style={styles.nBackScorePreview}>
              Score so far: {nBackScore.correct}/{nBackScore.total}
            </Text>
          )}
        </View>
      );
    }

    if (!currentQuestion) return null;

    // ── Raven's Matrix ───────────────────────────────────────────────────────
    if (currentQuestion.type === 'ravenMatrix') {
      const q = currentQuestion as RavenMatrixQuestion;
      const cellSize = Math.floor((width - 80) / 3);
      return (
        <View style={styles.questionArea}>
          <Text style={styles.transformInfo}>{q.ruleCount} rule{q.ruleCount > 1 ? 's' : ''} active</Text>
          <View style={styles.patternGrid}>
            {q.grid.map((row, ri) => (
              <View key={ri} style={styles.patternRow}>
                {row.map((cell, ci) => (
                  <View key={ci} style={[styles.patternCell, { borderColor: cell.color + '40', width: cellSize, height: cellSize }]}>
                    {cell.shape === '?' ? (
                      <Ionicons name="help" size={28} color={Colors.dark.textTertiary} />
                    ) : (
                      <Ionicons name={(SHAPE_ICONS[cell.shape] || 'ellipse') as any} size={28} color={cell.color} />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.questionPrompt}>What fills the missing space?</Text>
          <View style={styles.ravenOptions}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.ravenOptionBtn,
                  selectedOption === i && i === q.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleAnswer(i)}
                disabled={selectedOption !== null}
              >
                <Ionicons name={(SHAPE_ICONS[opt.shape] || 'ellipse') as any} size={22} color={opt.color} />
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    // ── Mental Rotation ───────────────────────────────────────────────────────
    if (currentQuestion.type === 'mentalRotation') {
      const q = currentQuestion as MentalRotationQuestion;
      const rotIcon = (SHAPE_ICONS[q.targetShape] || 'ellipse') as any;
      return (
        <View style={styles.questionArea}>
          <Text style={styles.questionPrompt}>Which is the SAME shape rotated?</Text>
          <View style={styles.rotationTargetBox}>
            <View style={[styles.rotationTargetInner, { transform: [{ rotate: `${q.targetRotation}deg` }] }]}>
              <Ionicons name={rotIcon} size={52} color={q.targetColor} />
            </View>
            <Text style={styles.rotationTargetLabel}>Target</Text>
          </View>
          <View style={styles.rotationOptionsGrid}>
            {q.options.map((opt, i) => {
              const icon = (SHAPE_ICONS[opt.shape] || 'ellipse') as any;
              const isSelected = rotationSelected === i;
              const isCorrect = i === q.correctIndex;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.rotationOptionBtn,
                    isSelected && isCorrect && styles.optionCorrectBg,
                    isSelected && !isCorrect && styles.optionWrongBg,
                    rotationSelected !== null && !isSelected && isCorrect && styles.optionCorrectBg,
                  ]}
                  onPress={() => handleRotationAnswer(i)}
                  disabled={rotationSelected !== null}
                >
                  <View style={{ transform: [{ rotate: `${opt.rotation}deg` }] }}>
                    <Ionicons name={icon} size={36} color={opt.color} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (moduleType === 'pattern') {
      const q = currentQuestion as PatternQuestion;
      return (
        <View style={styles.questionArea}>
          {/* Scheme badge + rule hint */}
          <View style={styles.patternRuleBadge}>
            <Ionicons name="git-branch" size={13} color={Colors.dark.brand} />
            <Text style={styles.patternRuleName}>{q.schemeName}</Text>
          </View>
          <Text style={styles.patternRuleHint}>{q.ruleHint}</Text>

          <View style={styles.patternGrid}>
            {q.grid.map((row, ri) => (
              <View key={ri} style={styles.patternRow}>
                {row.map((cell, ci) => (
                  <View key={ci} style={[styles.patternCell, { borderColor: cell.color + '40' }]}>
                    {cell.shape === '?' ? (
                      <Ionicons name="help" size={28} color={Colors.dark.textTertiary} />
                    ) : (
                      <Ionicons name={(SHAPE_ICONS[cell.shape] || 'ellipse') as any} size={28} color={cell.color} />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.questionPrompt}>What fills the missing space?</Text>
          <View style={styles.optionsRow}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.patternOption,
                  selectedOption === i && i === q.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleAnswer(i)}
                disabled={selectedOption !== null}
              >
                <Ionicons name={(SHAPE_ICONS[opt.shape] || 'ellipse') as any} size={28} color={opt.color} />
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (moduleType === 'memory') {
      const q = currentQuestion as MemoryQuestion;

      if (memoryPhase === 'show') {
        return (
          <View style={styles.questionArea}>
            {/* Task shown BEFORE memorization so users know what to encode for */}
            <View style={styles.memoryTaskBanner}>
              <Ionicons name="bulb" size={15} color={Colors.dark.warning} />
              <Text style={styles.memoryTaskBannerText}>{q.taskDescription}</Text>
            </View>
            <Text style={styles.memoryInstruction}>Memorise this sequence</Text>
            <Text style={styles.memoryDisplayTime}>{(q.displayTimeMs / 1000).toFixed(1)}s · then answer</Text>
            {/* Numbered chips — no misleading per-item colors */}
            <View style={styles.memorySequence}>
              {q.sequence.map((s, i) => (
                <View key={i} style={styles.memorySymbolWrap}>
                  <Text style={styles.memorySymbolPos}>{i + 1}</Text>
                  <View style={styles.memorySymbol}>
                    <Text style={styles.memorySymbolText}>{s.symbol}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      }

      // Answer phase — chip-style options + ghost reference row
      return (
        <View style={styles.questionArea}>
          <Text style={styles.questionPrompt}>{q.taskDescription}</Text>

          {/* Ghost reference: faded original sequence so user can verify recall */}
          <View style={styles.memoryGhostRow}>
            <Text style={styles.memoryGhostLabel}>Sequence was: </Text>
            {q.sequence.map((s, i) => (
              <Text key={i} style={styles.memoryGhostItem}>{s.symbol}{i < q.sequence.length - 1 ? ' · ' : ''}</Text>
            ))}
          </View>

          <View style={styles.memoryOptions}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.memoryOptionBtn,
                  selectedOption === i && i === q.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleAnswer(i)}
                disabled={selectedOption !== null}
              >
                {/* Chip-style display — each symbol in its own box */}
                <View style={styles.memoryOptChips}>
                  {opt.map((sym, j) => (
                    <View key={j} style={styles.memoryOptChip}>
                      <Text style={styles.memoryOptChipText}>{sym}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (moduleType === 'ruleMutation') {
      const q = currentQuestion as RuleMutationQuestion;
      return (
        <View style={styles.questionArea}>
          {q.ruleChanged && (
            <View style={styles.ruleChangeBanner}>
              <Ionicons name="warning" size={16} color={Colors.dark.warning} />
              <Text style={styles.ruleChangeText}>Rule Changed!</Text>
            </View>
          )}
          <Text style={styles.ruleDescription}>{q.ruleDescription}</Text>
          <View style={styles.ruleValueContainer}>
            <Text style={styles.ruleValue}>{q.startValue}</Text>
            <Ionicons name="arrow-forward" size={24} color={Colors.dark.textSecondary} />
            <Text style={styles.ruleValue}>?</Text>
          </View>
          <View style={styles.ruleOptions}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.ruleOptionBtn,
                  selectedOption === i && i === q.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleAnswer(i)}
                disabled={selectedOption !== null}
              >
                <Text style={styles.ruleOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (moduleType === 'dualTask') {
      const q = currentQuestion as DualTaskQuestion;
      if (dualTaskPhase === 'visual') {
        return (
          <View style={styles.questionArea}>
            <Text style={styles.questionPrompt}>Complete the sequence</Text>
            {q.distractorEnabled && (
              <View style={styles.distractorBadge}>
                <Ionicons name="eye-off" size={12} color={Colors.dark.error} />
                <Text style={styles.distractorText}>Distractors active</Text>
              </View>
            )}
            <View style={styles.dualSequence}>
              {q.visualTask.sequence.map((s, i) => (
                <View key={i} style={styles.dualSeqItem}>
                  {s === '?' ? (
                    <Ionicons name="help" size={22} color={Colors.dark.textTertiary} />
                  ) : (
                    <Ionicons name={(SHAPE_ICONS[s] || 'ellipse') as any} size={22} color={Colors.dark.brand} />
                  )}
                </View>
              ))}
            </View>
            <View style={styles.optionsRow}>
              {q.visualTask.options.map((opt, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.patternOption,
                    dualVisualAnswer === i && i === q.visualTask.correctIndex && styles.optionCorrectBg,
                    dualVisualAnswer === i && i !== q.visualTask.correctIndex && styles.optionWrongBg,
                  ]}
                  onPress={() => handleDualVisualAnswer(i)}
                  disabled={dualVisualAnswer !== null}
                >
                  <Ionicons name={(SHAPE_ICONS[opt] || 'ellipse') as any} size={24} color={Colors.dark.text} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      }

      return (
        <View style={styles.questionArea}>
          <Text style={styles.questionPrompt}>Count dots matching this color:</Text>
          <View style={[styles.colorSwatch, { backgroundColor: q.countingTask.targetColor }]} />
          <View style={styles.countFlashRow}>
            {q.countingTask.flashes.map((color, i) => (
              <View key={i} style={[styles.flashDot, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={styles.countQuestion}>How many dots match the target color?</Text>
          <View style={styles.optionsRow}>
            {q.countingTask.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.countOption,
                  selectedOption === i && i === q.countingTask.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.countingTask.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.countingTask.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleDualCountAnswer(i)}
                disabled={selectedOption !== null}
              >
                <Text style={styles.countOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (moduleType === 'rapidLogic') {
      const q = currentQuestion as RapidLogicQuestion;
      const timerPercent = q.timerSeconds > 0 ? (questionTimerLeft / q.timerSeconds) * 100 : 0;
      return (
        <View style={styles.questionArea}>
          <View style={styles.rapidTimerContainer}>
            <View style={[
              styles.rapidTimerBar,
              {
                width: `${timerPercent}%`,
                backgroundColor: timerPercent > 50 ? Colors.dark.brand : timerPercent > 25 ? Colors.dark.warning : Colors.dark.error,
              },
            ]} />
          </View>
          <Text style={[
            styles.rapidTimerText,
            { color: timerPercent > 25 ? Colors.dark.text : Colors.dark.error },
          ]}>
            {questionTimerLeft}s
          </Text>
          <Text style={styles.rapidQuestion}>{q.question}</Text>
          <View style={styles.rapidOptions}>
            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                style={[
                  styles.rapidOptionBtn,
                  selectedOption === i && i === q.correctIndex && styles.optionCorrectBg,
                  selectedOption === i && i !== q.correctIndex && styles.optionWrongBg,
                  selectedOption !== null && selectedOption !== i && i === q.correctIndex && styles.optionCorrectBg,
                ]}
                onPress={() => handleAnswer(i)}
                disabled={selectedOption !== null || questionTimerLeft === 0}
              >
                <Text style={styles.rapidOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          {selectedOption === null && questionTimerLeft > 0 && (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence:</Text>
              {['Low', 'Med', 'High'].map(c => (
                <Pressable
                  key={c}
                  style={[styles.confidenceBtn, confidenceLevel === c && styles.confidenceBtnActive]}
                  onPress={() => setConfidenceLevel(c)}
                >
                  <Text style={[styles.confidenceText, confidenceLevel === c && styles.confidenceTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding + 8 }]}>
      <View style={styles.sessionHeader}>
        <Pressable onPress={() => router.back()} style={styles.exitBtn}>
          <Ionicons name="close" size={22} color={Colors.dark.textSecondary} />
        </Pressable>
        <View style={styles.moduleInfo}>
          <View style={styles.moduleProgressDots}>
            {MODULE_META.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.moduleDot,
                  i < currentModuleIndex && styles.moduleDotComplete,
                  i === currentModuleIndex && styles.moduleDotActive,
                ]}
              />
            ))}
          </View>
          <Text style={styles.moduleNameText}>{meta.name} | T{getTierForModule(moduleType)}</Text>
        </View>
        <Text style={styles.timerText}>{formatTime(moduleTimeLeft)}</Text>
      </View>

      <View style={styles.sessionProgress}>
        <View style={[styles.sessionProgressFill, { width: `${((currentModuleIndex + 1) / MODULE_META.length) * 100}%`, backgroundColor: meta.color }]} />
      </View>

      <View style={styles.questionContainer}>{renderQuestion()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 20,
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  introTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.brand,
    textAlign: 'center',
    marginBottom: 12,
  },
  introSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.textTertiary,
    marginBottom: 28,
  },
  introTierPreview: {
    flexDirection: 'row',
    gap: 14,
  },
  introTierItem: {
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  introTierValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.text,
  },
  introTierLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.dark.textTertiary,
    letterSpacing: 1,
  },
  moduleIntroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  moduleCounter: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  moduleCounterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    letterSpacing: 2,
  },
  moduleIconBg: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleIntroTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
  },
  moduleIntroDuration: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  stagnationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.warningDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stagnationText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.warning,
  },
  moduleStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.brand,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginTop: 12,
  },
  moduleStartBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#0A0A0F',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  exitBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleInfo: {
    alignItems: 'center',
    gap: 4,
  },
  moduleProgressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  moduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.surfaceBorder,
  },
  moduleDotComplete: {
    backgroundColor: Colors.dark.success,
  },
  moduleDotActive: {
    backgroundColor: Colors.dark.brand,
    width: 20,
  },
  moduleNameText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  timerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.text,
  },
  sessionProgress: {
    height: 3,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sessionProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  questionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  questionArea: {
    alignItems: 'center',
    gap: 20,
  },
  transformInfo: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    letterSpacing: 1,
  },
  patternRuleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.dark.brandDim,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 4,
  },
  patternRuleName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.brand,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  patternRuleHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 17,
  },
  patternGrid: {
    gap: 8,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 8,
  },
  patternCell: {
    width: (width - 88) / 3,
    height: (width - 88) / 3,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  questionPrompt: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  patternOption: {
    width: 64,
    height: 64,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  optionCorrectBg: {
    backgroundColor: Colors.dark.successDim,
    borderColor: Colors.dark.success,
  },
  optionWrongBg: {
    backgroundColor: Colors.dark.errorDim,
    borderColor: Colors.dark.error,
  },
  // ── Memory task banner (shown DURING memorization) ───────────────────────
  memoryTaskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.dark.warningDim,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  memoryTaskBannerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.dark.warning,
    flex: 1,
    lineHeight: 18,
  },
  memoryInstruction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  memoryDisplayTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 4,
  },
  memorySequence: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  memorySymbolWrap: {
    alignItems: 'center',
    gap: 3,
  },
  memorySymbolPos: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  memorySymbol: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  memorySymbolText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.dark.text,
  },
  // ── Memory ghost reference row ────────────────────────────────────────────
  memoryGhostRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 4,
    gap: 1,
  },
  memoryGhostLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  memoryGhostItem: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  // ── Memory answer option chips ────────────────────────────────────────────
  memoryOptions: {
    width: '100%',
    gap: 8,
  },
  memoryOptionBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
  },
  memoryOptChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  memoryOptChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryOptChipText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.text,
  },
  memoryOptionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
    letterSpacing: 2,
  },
  ruleChangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.warningDim,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ruleChangeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.warning,
  },
  ruleDescription: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  ruleValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ruleValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 48,
    color: Colors.dark.text,
  },
  ruleOptions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ruleOptionBtn: {
    width: 72,
    height: 56,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  ruleOptionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
  },
  dualSequence: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dualSeqItem: {
    width: 40,
    height: 40,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  distractorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.errorDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distractorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.error,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  countFlashRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  flashDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  countQuestion: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  countOption: {
    width: 56,
    height: 56,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  countOptionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.dark.text,
  },
  rapidTimerContainer: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rapidTimerBar: {
    height: '100%',
    borderRadius: 3,
  },
  rapidTimerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
  },
  rapidQuestion: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 8,
  },
  rapidOptions: {
    width: '100%',
    gap: 10,
  },
  rapidOptionBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
  },
  rapidOptionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
  confidenceBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  confidenceBtnActive: {
    backgroundColor: Colors.dark.brandDim,
    borderColor: Colors.dark.brand,
  },
  confidenceText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  confidenceTextActive: {
    color: Colors.dark.brand,
  },
  // ── Raven's Matrix styles ────────────────────────────────────────────────
  ravenOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    maxWidth: width - 48,
  },
  ravenOptionBtn: {
    width: 60,
    height: 60,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  // ── Mental Rotation styles ───────────────────────────────────────────────
  rotationTargetBox: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.dark.brand + '60',
  },
  rotationTargetInner: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotationTargetLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.brand,
    letterSpacing: 2,
  },
  rotationOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    maxWidth: width - 40,
  },
  rotationOptionBtn: {
    width: 76,
    height: 76,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  // ── Dual N-Back styles ───────────────────────────────────────────────────
  nBackLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.dark.brand,
    letterSpacing: 2,
  },
  nBackProgressBar: {
    width: '90%',
    height: 4,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 2,
    overflow: 'hidden',
  },
  nBackProgressFill: {
    height: '100%',
    backgroundColor: '#7B61FF',
    borderRadius: 2,
  },
  nBackHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  nBackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 204,
    height: 204,
    gap: 6,
  },
  nBackCell: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  nBackCellActive: {
    backgroundColor: '#7B61FF40',
    borderColor: '#7B61FF',
  },
  nBackLetterBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  nBackLetter: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
  },
  nBackLetterVisible: {
    color: Colors.dark.text,
  },
  nBackLetterHidden: {
    color: Colors.dark.textTertiary,
  },
  nBackBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  nBackBtnPressed: {
    borderColor: Colors.dark.brand,
    backgroundColor: Colors.dark.brandDim,
  },
  nBackBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  nBackBtnTextActive: {
    color: Colors.dark.brand,
  },
  nBackScorePreview: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.success,
  },
  nBackBtnLocked: {
    opacity: 0.4,
  },
  nBackBtnTextLocked: {
    color: Colors.dark.textTertiary,
  },
  nBackBtnCountdown: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  // ── N-Back tutorial card ─────────────────────────────────────────────────
  nBackTutorialCard: {
    backgroundColor: '#7B61FF18',
    borderRadius: 20,
    padding: 22,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#7B61FF50',
    width: '100%',
  },
  nBackTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nBackTutorialTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.dark.text,
  },
  nBackTutorialBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  nBackTutorialHighlight: {
    fontFamily: 'Inter_700Bold',
    color: Colors.dark.text,
  },
  nBackTutorialRows: {
    gap: 10,
  },
  nBackTutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nBackTutorialRowText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  nBackTutorialNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  nBackTutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.brand,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 4,
  },
  nBackTutorialBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#0A0A0F',
  },
  // ── N-Back Complete card ─────────────────────────────────────────────────
  nBackCompleteCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
    width: '100%',
  },
  nBackCompleteTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
  },
  nBackCompleteScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 52,
    color: Colors.dark.text,
  },
  nBackCompleteLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: -8,
  },
  nBackCompleteHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  nBackCompleteWait: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  // ── Duration picker ──────────────────────────────────────────────────────
  durationPickerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  durationPicker: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  durationOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  durationOptionActive: {
    borderColor: Colors.dark.brand,
    backgroundColor: Colors.dark.brandDim,
  },
  durationOptionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  durationOptionLabelActive: {
    color: Colors.dark.brand,
  },
  durationOptionMins: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.dark.text,
  },
  durationOptionDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
  durationOptionLocked: {
    opacity: 0.5,
    borderColor: Colors.dark.surfaceBorder,
    borderStyle: 'dashed',
  },
  durationOptionLabelLocked: {
    color: Colors.dark.textTertiary,
  },
  durationOptionPremiumBadge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Colors.dark.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // ── J.A.R.V.I.S. Failure UI ──
  failCard: {
    backgroundColor: '#0F0505',
    borderColor: '#EF4444',
    borderWidth: 2,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 360,
  },
  failTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 28,
    color: '#EF4444',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  failSub: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#F87171',
  },
  failDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#FCA5A5',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  failStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  failStatLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#F87171',
  },
  failStatValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FECACA',
    textTransform: 'uppercase',
  },
  failBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  failBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
