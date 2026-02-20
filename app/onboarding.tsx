import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { generateBaselineQuestions, BaselineQuestion } from '@/lib/questions';
import { calculateBaselineLevel } from '@/lib/adaptive';
import { createDefaultProfile, saveUserProfile } from '@/lib/storage';

const { width } = Dimensions.get('window');

type Phase = 'welcome' | 'assessment' | 'result';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile, profile } = useUser();
  const [phase, setPhase] = useState<Phase>('welcome');
  const [questions, setQuestions] = useState<BaselineQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ category: string; correct: boolean; reactionTimeMs: number }[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [assignedLevel, setAssignedLevel] = useState(1);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (phase === 'assessment') {
      Animated.timing(progressAnim, {
        toValue: (currentIndex + 1) / questions.length,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [currentIndex, phase]);

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

    let p = profile;
    if (!p) {
      p = createDefaultProfile();
    }

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

  if (phase === 'welcome') {
    return (
      <View style={[styles.container, { paddingTop: topPadding + 40 }]}>
        <Animated.View style={[styles.welcomeContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="flash" size={48} color={Colors.dark.tint} />
            </View>
          </View>
          <Text style={styles.appTitle}>AceStudy</Text>
          <Text style={styles.appSubtitle}>Adaptive Cognitive Training</Text>

          <View style={styles.featureList}>
            {[
              { icon: 'trending-up' as const, text: 'Processing Speed' },
              { icon: 'grid' as const, text: 'Pattern Recognition' },
              { icon: 'layers' as const, text: 'Working Memory' },
              { icon: 'shuffle' as const, text: 'Cognitive Flexibility' },
              { icon: 'git-merge' as const, text: 'Dual-Task Processing' },
            ].map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Ionicons name={f.icon} size={20} color={Colors.dark.tint} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.assessmentNote}>
            Start with a quick baseline assessment{'\n'}to personalize your training.
          </Text>

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

  if (phase === 'result') {
    return (
      <View style={[styles.container, { paddingTop: topPadding + 40, justifyContent: 'center' }]}>
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

  const q = questions[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: topPadding + 16 }]}>
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
          const isSelected = selectedOption === idx;
          const isCorrect = idx === q.correctIndex;
          let optionStyle = styles.optionButton;
          let textStyle = styles.optionText;

          if (selectedOption !== null) {
            if (isCorrect) {
              optionStyle = { ...styles.optionButton, ...styles.optionCorrect };
              textStyle = { ...styles.optionText, ...styles.optionTextCorrect };
            } else if (isSelected && !isCorrect) {
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
  welcomeContent: {
    flex: 1,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.tintDim,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.tintGlow,
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
  },
  featureList: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  featureText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.dark.text,
  },
  assessmentNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.tint,
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
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.dark.tint,
    borderRadius: 2,
  },
  categoryBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.tint,
    letterSpacing: 2,
    backgroundColor: Colors.dark.tintDim,
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
  optionPressed: {
    backgroundColor: Colors.dark.surfaceLight,
    borderColor: Colors.dark.tint,
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
    color: Colors.dark.tint,
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
