import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useUser } from '@/contexts/UserContext';
import { generateBaselineQuestions, BaselineQuestion } from '@/lib/questions';
import { calculateBaselineLevel } from '@/lib/adaptive';
import { createDefaultProfile, saveUserProfile, OnboardingAnswers } from '@/lib/storage';
import { ONBOARDING_QUESTIONS, getTotalQuestionnaireSteps } from '@/lib/onboarding-questions';

type Phase = 'landing' | 'questionnaire' | 'questionnaire-done' | 'welcome' | 'assessment' | 'result';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const { updateProfile, profile } = useUser();
  const [phase, setPhase] = useState<Phase>('landing');
  const [questionnaireStep, setQuestionnaireStep] = useState(0);

  useEffect(() => {
    if (profile?.questionnaireCompleted && (phase === 'landing' || phase === 'questionnaire')) {
      setPhase('welcome');
    }
  }, [profile?.questionnaireCompleted, phase]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string | string[]>>({});
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ category: string; correct: boolean; reactionTimeMs: number }[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [assignedLevel, setAssignedLevel] = useState(1);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const totalQuestionnaireSteps = getTotalQuestionnaireSteps();
  const currentQ = ONBOARDING_QUESTIONS[questionnaireStep];
  const isLastQuestionnaireStep = questionnaireStep === totalQuestionnaireSteps - 1;

  useEffect(() => {
    if (phase === 'questionnaire') {
      Animated.timing(progressAnim, {
        toValue: (questionnaireStep + 1) / totalQuestionnaireSteps,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [questionnaireStep, phase]);

  useEffect(() => {
    if (phase === 'assessment') {
      Animated.timing(progressAnim, {
        toValue: (currentIndex + 1) / questions.length,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, phase, questions.length]);

  useEffect(() => {
    if (phase === 'landing' || phase === 'welcome' || phase === 'questionnaire-done') {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [phase]);

  const handleQuestionnaireOption = (opt: { value: string }, index: number) => {
    if (!currentQ) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentQ.multiSelect) {
      const current = (questionnaireAnswers[currentQ.id] as string[] | undefined) ?? [];
      const next = current.includes(opt.value)
        ? current.filter((v) => v !== opt.value)
        : [...current, opt.value];
      setQuestionnaireAnswers((prev) => ({ ...prev, [currentQ.id]: next }));
    } else {
      setQuestionnaireAnswers((prev) => ({ ...prev, [currentQ.id]: opt.value }));
    }
  };

  const canProceedQuestionnaire = () => {
    if (!currentQ) return false;
    const val = questionnaireAnswers[currentQ.id];
    if (currentQ.multiSelect) return Array.isArray(val) && val.length > 0;
    return typeof val === 'string' && val.length > 0;
  };

  const goNextQuestionnaire = () => {
    if (!canProceedQuestionnaire()) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isLastQuestionnaireStep) {
      finishQuestionnaire();
    } else {
      setQuestionnaireStep((s) => s + 1);
    }
  };

  const goBackQuestionnaire = () => {
    if (questionnaireStep > 0) {
      setQuestionnaireStep((s) => s - 1);
    } else {
      setPhase('landing');
    }
  };

  const finishQuestionnaire = async () => {
    const answers: OnboardingAnswers = {
      learningSituation: questionnaireAnswers['learning-situation'] as string | undefined,
      learningChallenges: questionnaireAnswers['learning-challenges'] as string[] | undefined,
      learningArea: questionnaireAnswers['learning-area'] as string | undefined,
      learningGoal: questionnaireAnswers['learning-goal'] as string | undefined,
      futureIfNoChange: questionnaireAnswers['future-if-no-change'] as string | undefined,
      studyFrequency: questionnaireAnswers['study-frequency'] as string | undefined,
      whatWouldHelp: Array.isArray(questionnaireAnswers['what-would-help'])
        ? (questionnaireAnswers['what-would-help'] as string[])
        : questionnaireAnswers['what-would-help']
          ? [questionnaireAnswers['what-would-help'] as string]
          : undefined,
    };
    let p = profile ?? createDefaultProfile();
    const updated = {
      ...p,
      questionnaireCompleted: true,
      onboardingAnswers: answers,
    };
    await saveUserProfile(updated);
    await updateProfile(updated);
    if (updated.baselineCompleted) {
      router.replace('/(tabs)');
      return;
    }
    setPhase('questionnaire-done');
  };

  const startAssessment = () => {
    const qs = generateBaselineQuestions();
    setQuestions(qs);
    setCurrentIndex(0);
    setResults([]);
    setQuestionStartTime(Date.now());
    setPhase('assessment');
  };

  const handleAnswer = async (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
    const q = questions[currentIndex];
    const reactionTimeMs = Date.now() - questionStartTime;
    const correct = optionIndex === q.correctIndex;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }
    const newResults = [...results, { category: q.category, correct, reactionTimeMs }];
    setResults(newResults);
    setTimeout(() => {
      setSelectedOption(null);
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setQuestionStartTime(Date.now());
      } else {
        finishAssessment(newResults);
      }
    }, 600);
  };

  const finishAssessment = async (finalResults: typeof results) => {
    const baseline = calculateBaselineLevel(finalResults);
    setAssignedLevel(baseline.level);
    let p = profile ?? createDefaultProfile();
    const updated = {
      ...p,
      level: baseline.level,
      patternLevel: baseline.patternLevel,
      memorySpan: baseline.memorySpan,
      speedIndex: baseline.speedIndex,
      flexibilityScore: baseline.flexibilityScore,
      dualTaskCapacity: baseline.dualTaskCapacity,
      baselineCompleted: true,
    };
    await saveUserProfile(updated);
    await updateProfile(updated);
    setPhase('result');
  };

  const goToHome = () => {
    router.replace('/(tabs)');
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  // ——— Landing page (first-time: clean, minimal logo screen) ———
  if (phase === 'landing') {
    return (
      <View style={[styles.container, styles.landingMinimal, { paddingTop: topPadding, backgroundColor: theme.background }]}>
        <Animated.View style={[styles.landingContent, styles.landingCentered, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, styles.logoCircleLarge, { borderColor: theme.logoBorder, backgroundColor: theme.logoBackground }]}>
              <Ionicons name="flash" size={56} color={theme.logoIcon} />
            </View>
          </View>
          <Text style={[styles.landingTitle, { color: theme.text }]}>Jojo</Text>
          <Text style={[styles.landingTagline, { color: theme.textSecondary }]}>Cognitive training that adapts to you</Text>
          <View style={styles.landingSpacer} />
          <Pressable
            style={({ pressed }) => [styles.landingCtaButton, pressed && styles.startButtonPressed]}
            onPress={() => setPhase('questionnaire')}
          >
            <Text style={styles.startButtonText}>Get started</Text>
            <Ionicons name="arrow-forward" size={18} color="#0A0A0F" />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ——— Questionnaire ———
  if (phase === 'questionnaire' && currentQ) {
    return (
      <View style={[styles.container, { paddingTop: topPadding + 16, backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBackQuestionnaire}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
            <Text style={styles.backButtonLabel}>Back</Text>
          </Pressable>
          <Text style={styles.stepIndicator}>
            {questionnaireStep + 1} of {totalQuestionnaireSteps}
          </Text>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.questionnaireScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.questionTitle}>{currentQ.question}</Text>
          {currentQ.subtitle ? (
            <Text style={styles.questionSubtitle}>{currentQ.subtitle}</Text>
          ) : null}

          <View style={styles.optionsContainer}>
            {currentQ.options.map((opt, idx) => {
              const currentVal = questionnaireAnswers[currentQ.id];
              const isSelected = currentQ.multiSelect
                ? Array.isArray(currentVal) && currentVal.includes(opt.value)
                : currentVal === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isSelected && styles.optionButtonSelected,
                    pressed && !isSelected && styles.optionButtonPressed,
                  ]}
                  onPress={() => handleQuestionnaireOption(opt, idx)}
                >
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {idx + 1}. {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.questionnaireNavRow}>
          <Pressable
            style={({ pressed }) => [styles.backButtonSecondary, pressed && styles.backButtonPressed]}
            onPress={goBackQuestionnaire}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.dark.brand} />
            <Text style={styles.backButtonSecondaryLabel}>Back</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              styles.nextButtonInRow,
              !canProceedQuestionnaire() && styles.nextButtonDisabled,
              pressed && canProceedQuestionnaire() && styles.nextButtonPressed,
            ]}
            onPress={goNextQuestionnaire}
            disabled={!canProceedQuestionnaire()}
          >
            <Text style={styles.nextButtonText}>{isLastQuestionnaireStep ? 'Done' : 'Next'}</Text>
            <Ionicons name="chevron-forward" size={20} color="#0A0A0F" />
          </Pressable>
        </View>
      </View>
    );
  }

  // ——— Questionnaire complete: "Well done" ———
  if (phase === 'questionnaire-done') {
    const goBackToQuiz = () => {
      setQuestionnaireStep(totalQuestionnaireSteps - 1);
      setPhase('questionnaire');
    };
    return (
      <View style={[styles.container, { paddingTop: topPadding + 40, justifyContent: 'center', backgroundColor: theme.background }]}>
        <Animated.View style={[styles.doneContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.doneTitle}>Well done!</Text>
          <Text style={styles.doneSubtitle}>Your training plan will be tailored to how you learn.</Text>
          <View style={styles.doneCard}>
            <View style={styles.doneCardRow}>
              <View style={styles.donePill}>
                <Ionicons name="bulb" size={18} color={Colors.dark.brand} />
                <Text style={styles.donePillText}>Planning</Text>
              </View>
              <View style={styles.donePillInactive}>
                <Text style={styles.donePillTextInactive}>Action</Text>
              </View>
              <View style={styles.donePillInactive}>
                <Text style={styles.donePillTextInactive}>Discipline</Text>
              </View>
            </View>
          </View>
          <View style={styles.doneActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.backButtonSecondary, styles.backButtonSecondaryFull, pressed && styles.backButtonPressed]}
              onPress={goBackToQuiz}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.dark.brand} />
              <Text style={styles.backButtonSecondaryLabel}>Change my answers</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.nextButton, styles.nextButtonInRow, pressed && styles.nextButtonPressed]}
              onPress={() => setPhase('welcome')}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#0A0A0F" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ——— Welcome (short) then baseline ———
  if (phase === 'welcome') {
    return (
      <View style={[styles.container, { paddingTop: topPadding + 16, backgroundColor: theme.background }]}>
        <Pressable
          style={({ pressed }) => [styles.backButton, styles.backButtonAbsolute, { top: topPadding + 16 }, pressed && styles.backButtonPressed]}
          onPress={() => setPhase('questionnaire-done')}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
        <Animated.View style={[styles.welcomeContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <View style={[styles.logoCircle, { borderColor: theme.logoBorder, backgroundColor: theme.logoBackground }]}>
              <Ionicons name="flash" size={48} color={theme.logoIcon} />
            </View>
          </View>
          <Text style={styles.appTitle}>Jojo</Text>
          <Text style={styles.appSubtitle}>A quick baseline will personalize your training.</Text>
          <Pressable
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
            onPress={startAssessment}
          >
            <Text style={styles.startButtonText}>Begin Assessment</Text>
            <Ionicons name="arrow-forward" size={20} color="#0A0A0F" />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ——— Result ———
  if (phase === 'result') {
    return (
      <View style={[styles.container, { paddingTop: topPadding + 40, justifyContent: 'center', backgroundColor: theme.background }]}>
        <View style={styles.resultContent}>
          <View style={styles.resultIconContainer}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.dark.success} />
          </View>
          <Text style={styles.resultTitle}>Assessment Complete</Text>
          <Text style={styles.resultLevel}>Level {assignedLevel}</Text>
          <Text style={styles.resultSubtext}>
            Your personalized training program is ready.{'\n'}20 minutes a day to sharpen your mind.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed, { marginTop: 32 }]}
            onPress={goToHome}
          >
            <Text style={styles.startButtonText}>Start Training</Text>
            <Ionicons name="arrow-forward" size={20} color="#0A0A0F" />
          </Pressable>
        </View>
      </View>
    );
  }

  // ——— Baseline assessment ———
  const q = questions[currentIndex];
  return (
    <View style={[styles.container, { paddingTop: topPadding + 16, backgroundColor: theme.background }]}>
      <View style={styles.assessmentHeader}>
        <Text style={styles.questionCounter}>
          {currentIndex + 1} / {questions.length}
        </Text>
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.categoryBadge}>{q.category.toUpperCase()}</Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{q.question}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {q.options.map((option, idx) => {
          const isCorrect = idx === q.correctIndex;
          let optionStyle = styles.optionButton;
          let textStyle = styles.optionText;
          if (selectedOption !== null) {
            if (isCorrect) {
              optionStyle = { ...styles.optionButton, ...styles.optionCorrect };
              textStyle = { ...styles.optionText, ...styles.optionTextCorrect };
            } else if (selectedOption === idx) {
              optionStyle = { ...styles.optionButton, ...styles.optionWrong };
              textStyle = { ...styles.optionText, ...styles.optionTextWrong };
            }
          }
          return (
            <Pressable
              key={idx}
              style={({ pressed }) => [optionStyle, pressed && selectedOption === null && styles.optionPressed]}
              onPress={() => handleAnswer(idx)}
              disabled={selectedOption !== null}
            >
              <View style={styles.optionIndex}>
                <Text style={styles.optionIndexText}>{String.fromCharCode(65 + idx)}</Text>
              </View>
              <Text style={textStyle}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  backButtonAbsolute: {
    position: 'absolute',
    left: 24,
    zIndex: 10,
  },
  backButtonLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  stepIndicator: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginRight: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.dark.brand,
    borderRadius: 2,
  },
  questionnaireScroll: {
    paddingBottom: 24,
  },
  questionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  questionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    paddingBottom: Platform.OS === 'web' ? 34 : 40,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.dark.surfaceBorder,
  },
  optionButtonSelected: {
    backgroundColor: Colors.dark.brand,
    borderColor: Colors.dark.brand,
  },
  optionButtonPressed: {
    backgroundColor: Colors.dark.surfaceLight,
    borderColor: Colors.dark.brand,
  },
  optionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
    flex: 1,
  },
  optionLabelSelected: {
    color: '#0A0A0F',
    fontFamily: 'Inter_600SemiBold',
  },
  nextButtonWrap: {
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
  },
  questionnaireNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
  },
  backButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButtonSecondaryFull: {
    flex: 1,
  },
  backButtonSecondaryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.dark.brand,
  },
  doneActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 28,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.brand,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  nextButtonFull: {
    marginTop: 24,
  },
  nextButtonInRow: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#0A0A0F',
  },
  landingContent: {
    flex: 1,
    alignItems: 'center',
  },
  landingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  landingTagline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.dark.brand,
    marginBottom: 32,
    textAlign: 'center',
  },
  landingBullets: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  landingBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  landingBulletText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
  },
  landingCtaCopy: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  landingCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.brand,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  doneContent: {
    alignItems: 'center',
  },
  doneTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  doneSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  doneCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    width: '100%',
  },
  doneCardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.brandDim,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.brand,
  },
  donePillInactive: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  donePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.brand,
  },
  donePillTextInactive: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
  },
  landingMinimal: {
    flex: 1,
    justifyContent: 'center',
  },
  landingCentered: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  landingSpacer: {
    flex: 1,
    minHeight: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  logoCircleLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  appTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  appSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.brand,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  startButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  startButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#0A0A0F',
  },
  assessmentHeader: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  questionCounter: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    letterSpacing: 1,
  },
  categoryBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.brand,
    letterSpacing: 2,
    backgroundColor: Colors.dark.brandDim,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  questionContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  questionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 32,
  },
  optionPressed: {
    backgroundColor: Colors.dark.surfaceLight,
    borderColor: Colors.dark.brand,
  },
  optionCorrect: {
    backgroundColor: Colors.dark.successDim,
    borderColor: Colors.dark.success,
  },
  optionWrong: {
    backgroundColor: Colors.dark.errorDim,
    borderColor: Colors.dark.error,
  },
  optionIndex: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndexText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  optionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
    flex: 1,
  },
  optionTextCorrect: {
    color: Colors.dark.success,
  },
  optionTextWrong: {
    color: Colors.dark.error,
  },
  resultContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  resultIconContainer: {
    marginBottom: 24,
  },
  resultTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
  },
  resultLevel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 56,
    color: Colors.dark.brand,
    marginBottom: 16,
  },
  resultSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
