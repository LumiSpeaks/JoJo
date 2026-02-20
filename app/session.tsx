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
  PatternQuestion,
  MemoryQuestion,
  RuleMutationQuestion,
  DualTaskQuestion,
  RapidLogicQuestion,
} from '@/lib/questions';
import {
  calculateSessionDifficulty,
  getTimerForModule,
  getModuleDuration,
  SessionDifficultyConfig,
} from '@/lib/adaptive';

const { width } = Dimensions.get('window');

type ModuleType = 'pattern' | 'memory' | 'ruleMutation' | 'dualTask' | 'rapidLogic';

const MODULE_META: { type: ModuleType; name: string; icon: string; color: string }[] = [
  { type: 'pattern', name: 'Pattern Density', icon: 'grid', color: '#00D4FF' },
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
  const [phase, setPhase] = useState<'intro' | 'moduleIntro' | 'playing' | 'done'>('intro');
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionTimerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const memoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    const introTimer = setTimeout(() => {
      setPhase('moduleIntro');
    }, 2500);

    return () => {
      clearTimeout(introTimer);
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
      if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
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

  const startModule = useCallback(() => {
    const moduleType = MODULE_META[currentModuleIndex].type;
    const duration = moduleDurations[moduleType] || 240;
    setPhase('playing');
    setQuestionIndex(0);
    setSelectedOption(null);
    setModuleTimeLeft(duration);
    setPreviousRuleIdx(undefined);
    generateNextQuestion(moduleType, 0);

    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = setInterval(() => {
      setModuleTimeLeft(prev => {
        if (prev <= 1) {
          if (timerInterval.current) clearInterval(timerInterval.current);
          advanceModule();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentModuleIndex, profile, diffConfig, moduleDurations]);

  const generateNextQuestion = useCallback((moduleType: ModuleType, qIndex: number) => {
    if (!profile || !diffConfig) return;
    const tier = getTierForModule(moduleType);
    const stagnation = getStagnationMode(moduleType);

    let question: any;
    switch (moduleType) {
      case 'pattern':
        question = generatePatternQuestion(tier, stagnation);
        break;
      case 'memory':
        question = generateMemoryQuestion(profile.memorySpan, tier, stagnation);
        setMemoryPhase('show');
        if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
        memoryTimerRef.current = setTimeout(() => setMemoryPhase('answer'), question.displayTimeMs);
        break;
      case 'ruleMutation':
        question = generateRuleMutationQuestion(tier, qIndex, previousRuleIdx, stagnation);
        setPreviousRuleIdx(question.ruleIndex);
        break;
      case 'dualTask':
        question = generateDualTaskQuestion(tier, stagnation);
        setDualTaskPhase('visual');
        setDualVisualAnswer(null);
        break;
      case 'rapidLogic':
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

    setCurrentQuestion(question);
    setQuestionStartTime(Date.now());
    setSelectedOption(null);
  }, [profile, diffConfig, previousRuleIdx, getTierForModule, getStagnationMode]);

  const advanceModule = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (questionTimerInterval.current) clearInterval(questionTimerInterval.current);
    if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);

    if (currentModuleIndex < MODULE_META.length - 1) {
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
      router.replace({
        pathname: '/session-complete',
        params: { scores: JSON.stringify(scores) },
      });
    }
  }, [currentModuleIndex, moduleResults, profile, getTierForModule]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);

    const reactionTime = Date.now() - questionStartTime;
    const moduleType = MODULE_META[currentModuleIndex].type;
    const isCorrect = optionIndex === currentQuestion?.correctIndex;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }

    setModuleResults(prev => ({
      ...prev,
      [moduleType]: {
        correct: prev[moduleType].correct + (isCorrect ? 1 : 0),
        total: prev[moduleType].total + 1,
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

    setModuleResults(prev => ({
      ...prev,
      dualTask: {
        correct: prev.dualTask.correct + (bothCorrect ? 1 : 0),
        total: prev.dualTask.total + 1,
        totalReactionTime: prev.dualTask.totalReactionTime + reactionTime,
      },
    }));

    setTimeout(() => {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      generateNextQuestion('dualTask', nextIndex);
    }, 500);
  }, [selectedOption, dualVisualAnswer, currentQuestion, questionStartTime, questionIndex, generateNextQuestion]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (phase === 'intro') {
    const focusName = diffConfig?.focusTraitName || 'Cognitive Training';
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <Animated.View style={[styles.introContent, { opacity: fadeAnim }]}>
          <Text style={styles.introLabel}>SESSION FOCUS</Text>
          <Text style={styles.introTitle}>{focusName}</Text>
          <Text style={styles.introSub}>Calibrating your adaptive difficulty...</Text>
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
    if (!currentQuestion) return null;

    if (moduleType === 'pattern') {
      const q = currentQuestion as PatternQuestion;
      return (
        <View style={styles.questionArea}>
          <Text style={styles.transformInfo}>{q.transformationCount} transformation{q.transformationCount > 1 ? 's' : ''} active</Text>
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
          <Text style={styles.questionPrompt}>What completes the pattern?</Text>
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
            <Text style={styles.memoryInstruction}>Remember this sequence</Text>
            <Text style={styles.memoryDisplayTime}>{(q.displayTimeMs / 1000).toFixed(1)}s display</Text>
            <View style={styles.memorySequence}>
              {q.sequence.map((s, i) => (
                <View key={i} style={[styles.memorySymbol, { borderColor: s.color }]}>
                  <Text style={[styles.memorySymbolText, { color: s.color }]}>{s.symbol}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      }

      return (
        <View style={styles.questionArea}>
          <Text style={styles.questionPrompt}>{q.taskDescription}</Text>
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
                <Text style={styles.memoryOptionText}>{opt.join('  ')}</Text>
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
                    <Ionicons name={(SHAPE_ICONS[s] || 'ellipse') as any} size={22} color={Colors.dark.tint} />
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
          <Text style={styles.questionPrompt}>Count flashes of this color:</Text>
          <View style={[styles.colorSwatch, { backgroundColor: q.countingTask.targetColor }]} />
          <View style={styles.countFlashRow}>
            {q.countingTask.flashes.map((color, i) => (
              <View key={i} style={[styles.flashDot, { backgroundColor: color }]} />
            ))}
          </View>
          <Text style={styles.countQuestion}>How many target-colored flashes?</Text>
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
                backgroundColor: timerPercent > 50 ? Colors.dark.tint : timerPercent > 25 ? Colors.dark.warning : Colors.dark.error,
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
    color: Colors.dark.tint,
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
    backgroundColor: Colors.dark.tint,
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
    backgroundColor: Colors.dark.tint,
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
  memoryInstruction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  memoryDisplayTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
  memorySequence: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  memorySymbol: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  memorySymbolText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
  },
  memoryOptions: {
    width: '100%',
    gap: 10,
  },
  memoryOptionBtn: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
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
    backgroundColor: Colors.dark.tintDim,
    borderColor: Colors.dark.tint,
  },
  confidenceText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  confidenceTextActive: {
    color: Colors.dark.tint,
  },
});
