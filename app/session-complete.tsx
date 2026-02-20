import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { ModuleScore, SessionLog } from '@/lib/storage';
import { processSessionResults, calculateOverallAccuracy } from '@/lib/adaptive';

export default function SessionCompleteScreen() {
  const insets = useSafeAreaInsets();
  const { scores: scoresParam } = useLocalSearchParams();
  const { profile, updateProfile, addSessionLog, sessionLogs } = useUser();
  const processedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [adjustments, setAdjustments] = React.useState<{ trait: string; change: number; reason: string }[]>([]);
  const [leveledUp, setLeveledUp] = React.useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const scores: Record<string, ModuleScore> = scoresParam
    ? JSON.parse(scoresParam as string)
    : {};

  const defaultScore: ModuleScore = { accuracy: 0, reactionTime: 0, difficultyTier: 1, questionsAnswered: 0, correctAnswers: 0 };
  const moduleScores = {
    pattern: scores.pattern || defaultScore,
    memory: scores.memory || defaultScore,
    ruleMutation: scores.ruleMutation || defaultScore,
    dualTask: scores.dualTask || defaultScore,
    rapidLogic: scores.rapidLogic || defaultScore,
  };

  const overallAccuracy = calculateOverallAccuracy(moduleScores);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  useEffect(() => {
    if (!profile || processedRef.current) return;
    processedRef.current = true;

    const processResults = async () => {
      const result = processSessionResults(profile, moduleScores, sessionLogs);

      setAdjustments(result.adjustments);
      setLeveledUp(result.leveledUp);

      await updateProfile(result.updatedProfile);

      const avgReactionTime = Object.values(moduleScores)
        .filter(m => m.questionsAnswered > 0)
        .reduce((s, m) => s + m.reactionTime, 0) /
        Math.max(1, Object.values(moduleScores).filter(m => m.questionsAnswered > 0).length);

      const sessionLog: SessionLog = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        moduleScores,
        averageAccuracy: overallAccuracy,
        averageReactionTime: avgReactionTime,
        traitAdjustments: result.adjustments,
        levelBefore: profile.level,
        levelAfter: result.updatedProfile.level,
      };

      await addSessionLog(sessionLog);
    };

    processResults();
  }, [profile]);

  const moduleDisplay = [
    { key: 'pattern', name: 'Pattern Density', icon: 'grid', color: '#00D4FF' },
    { key: 'memory', name: 'Memory Stretch', icon: 'layers', color: '#7B61FF' },
    { key: 'ruleMutation', name: 'Rule Mutation', icon: 'shuffle', color: '#00E676' },
    { key: 'dualTask', name: 'Dual-Task', icon: 'git-merge', color: '#FFB74D' },
    { key: 'rapidLogic', name: 'Rapid Logic', icon: 'flash', color: '#FF6EC7' },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.dark.success} />
          </View>

          <Text style={styles.title}>Session Complete</Text>

          {leveledUp && (
            <View style={styles.levelUpBanner}>
              <Ionicons name="arrow-up-circle" size={20} color={Colors.dark.tint} />
              <Text style={styles.levelUpText}>Level Up!</Text>
            </View>
          )}

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{Math.round(overallAccuracy)}%</Text>
            <Text style={styles.scoreLabel}>Overall</Text>
          </View>

          <View style={styles.moduleResults}>
            {moduleDisplay.map(mod => {
              const s = moduleScores[mod.key as keyof typeof moduleScores];
              return (
                <View key={mod.key} style={styles.moduleResultRow}>
                  <View style={[styles.moduleResultIcon, { backgroundColor: mod.color + '18' }]}>
                    <Ionicons name={mod.icon as any} size={18} color={mod.color} />
                  </View>
                  <View style={styles.moduleResultInfo}>
                    <Text style={styles.moduleResultName}>{mod.name}</Text>
                    <View style={styles.moduleResultBarBg}>
                      <View
                        style={[
                          styles.moduleResultBarFill,
                          {
                            width: `${Math.min(100, s.accuracy)}%`,
                            backgroundColor:
                              s.accuracy >= 80 ? Colors.dark.success : s.accuracy >= 60 ? Colors.dark.warning : Colors.dark.error,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.moduleResultPercent}>{Math.round(s.accuracy)}%</Text>
                </View>
              );
            })}
          </View>

          {adjustments.length > 0 && (
            <>
              <Text style={styles.adjustTitle}>Adaptive Adjustments</Text>
              <View style={styles.adjustmentsList}>
                {adjustments.map((adj, i) => (
                  <View key={i} style={styles.adjustmentRow}>
                    <Ionicons
                      name={adj.change > 0 ? 'arrow-up' : adj.change < 0 ? 'arrow-down' : 'remove'}
                      size={16}
                      color={adj.change > 0 ? Colors.dark.success : adj.change < 0 ? Colors.dark.error : Colors.dark.textTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adjustTrait}>{adj.trait}</Text>
                      <Text style={styles.adjustReason}>{adj.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="timer" size={18} color={Colors.dark.tint} />
              <Text style={styles.statItemValue}>
                {(
                  Object.values(moduleScores)
                    .filter(m => m.questionsAnswered > 0)
                    .reduce((s, m) => s + m.reactionTime, 0) /
                  Math.max(1, Object.values(moduleScores).filter(m => m.questionsAnswered > 0).length) /
                  1000
                ).toFixed(1)}s
              </Text>
              <Text style={styles.statItemLabel}>Avg Speed</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="help-circle" size={18} color={Colors.dark.accent} />
              <Text style={styles.statItemValue}>
                {Object.values(moduleScores).reduce((s, m) => s + m.questionsAnswered, 0)}
              </Text>
              <Text style={styles.statItemLabel}>Questions</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="checkmark" size={18} color={Colors.dark.success} />
              <Text style={styles.statItemValue}>
                {Object.values(moduleScores).reduce((s, m) => s + m.correctAnswers, 0)}
              </Text>
              <Text style={styles.statItemLabel}>Correct</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && { opacity: 0.85 }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.doneButtonText}>Continue</Text>
          </Pressable>

          <View style={{ height: Platform.OS === 'web' ? 34 : 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    paddingTop: 32,
  },
  completeBadge: {
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  levelUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.tintDim,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.tintGlow,
    marginBottom: 16,
  },
  levelUpText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.tint,
  },
  scoreCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.tint,
    marginBottom: 28,
  },
  scoreValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: Colors.dark.tint,
  },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  moduleResults: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  moduleResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  moduleResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleResultInfo: {
    flex: 1,
    gap: 6,
  },
  moduleResultName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
  },
  moduleResultBarBg: {
    height: 5,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  moduleResultBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  moduleResultPercent: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.text,
    width: 48,
    textAlign: 'right',
  },
  adjustTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  adjustmentsList: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  adjustTrait: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.text,
  },
  adjustReason: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 28,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  statItemValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.text,
  },
  statItemLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  doneButton: {
    backgroundColor: Colors.dark.tint,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#0A0A0F',
  },
});
