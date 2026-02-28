import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Animated } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { ModuleScore, SessionLog } from '@/lib/storage';
import { processSessionResults, calculateOverallAccuracy, calculateIntelligenceIndices, updateStreak, calculateJojoIQ } from '@/lib/adaptive';
import { generateLearningApplications, generateImmediateAction } from '@/lib/learning-applications';
import { analyzePerformance } from '@/lib/gemini'; // Jojo Protocol

export default function SessionCompleteScreen() {
  const [jarvisInsight, setJarvisInsight] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();
  // ... (rest of hooks)

  useEffect(() => {
    // ... (existing useEffect for results processing)
    if (!processedRef.current && profile) {
      // Trigger Jojo analysis
      const data = {
        accuracy: overallAccuracy,
        weakestTrait: analysis.weakestTrait.name
      };
      
      analyzePerformance(profile, data).then(insight => {
        if (insight) setJarvisInsight(insight);
      });
    }
  }, [profile]); // ...

  // RENDER (inside return):
  // {jarvisInsight && (
  //   <View style={styles.jarvisCard}>
  //     <View style={styles.jarvisHeader}>
  //       <Ionicons name="hardware-chip" size={24} color={Colors.dark.brand} />
  //       <Text style={styles.jarvisTitle}>Jojo INSIGHT</Text>
  //     </View>
  //     <Text style={styles.jarvisText}>{jarvisInsight}</Text>
  //   </View>
  // )}
  const { scores: scoresParam, nBackN, nBackAccuracy, memTier } = useLocalSearchParams();
  const { profile, updateProfile, addSessionLog, sessionLogs } = useUser();
  const processedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [adjustments, setAdjustments] = React.useState<{ trait: string; change: number; reason: string }[]>([]);
  const [leveledUp, setLeveledUp] = React.useState(false);
  const [iqGain, setIqGain] = React.useState(0);

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
  const intelligenceIndices = calculateIntelligenceIndices(moduleScores, profile?.level || 1);

  const learningApps = useMemo(() => {
    if (!profile) return [];
    return generateLearningApplications(intelligenceIndices, profile.level);
  }, [intelligenceIndices, profile?.level]);

  const immediateAction = useMemo(() => {
    if (!profile) return null;
    return generateImmediateAction(intelligenceIndices, profile.level);
  }, [intelligenceIndices, profile?.level]);

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
      
      const oldIQ = calculateJojoIQ(profile.level);
      const newIQ = calculateJojoIQ(result.updatedProfile.level);
      const iqDiff = newIQ - oldIQ;
      setIqGain(iqDiff);

      // Recalculate intelligence indices with the UPDATED level (in case they leveled up)
      const finalIndices = calculateIntelligenceIndices(moduleScores, result.updatedProfile.level);

      // Update streak
      const streakUpdate = updateStreak(profile);

      // N-Back level progression: advance if accuracy >= 80%, regress if < 50%
      const nBackNVal = nBackN ? parseInt(nBackN as string, 10) : 0;
      const nBackAccVal = nBackAccuracy ? parseFloat(nBackAccuracy as string) : 0;
      const memTierVal = memTier ? parseInt(memTier as string, 10) : 1;
      let newNBackLevel = result.updatedProfile.nBackLevel ?? 2;
      let newNBackBest = result.updatedProfile.nBackBest ?? 2;
      if (nBackNVal > 0 && memTierVal >= 2) { // Accelerated: Match unlock tier
        if (nBackAccVal >= 80 && nBackNVal >= newNBackLevel) {
          newNBackLevel = Math.min(newNBackLevel + 1, 6);
        } else if (nBackAccVal < 50 && newNBackLevel > 2) {
          newNBackLevel = Math.max(newNBackLevel - 1, 2);
        }
        newNBackBest = Math.max(newNBackBest, newNBackLevel);
      }

      const profileWithIndices = {
        ...result.updatedProfile,
        reasoningIndex: finalIndices.reasoning,
        spatialIndex: finalIndices.spatial,
        fluidIndex: finalIndices.fluid,
        crystallizedIndex: finalIndices.crystallized,
        currentStreak: streakUpdate.currentStreak,
        longestStreak: streakUpdate.longestStreak,
        lastStreakDate: new Date().toDateString(),
        nBackLevel: newNBackLevel,
        nBackBest: newNBackBest,
      };

      await updateProfile(profileWithIndices);

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
        intelligenceIndices: finalIndices,
      };

      await addSessionLog(sessionLog);
    };

    processResults();
  }, [profile]);

  const moduleDisplay = [
    { key: 'pattern', name: 'Pattern Density', icon: 'grid', color: Colors.dark.brand },
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
              <Ionicons name="arrow-up-circle" size={20} color={Colors.dark.brand} />
              <Text style={styles.levelUpText}>Level Up!</Text>
            </View>
          )}

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{calculateJojoIQ(profile?.level || 1)}</Text>
            <Text style={styles.scoreLabel}>JOJO IQ</Text>
            {leveledUp && (
              <View style={styles.iqGainBadge}>
                <Text style={styles.iqGainText}>+1</Text>
              </View>
            )}
          </View>

          {/* Use growth-oriented framing for early users (level < 20); IQ framing for advanced */}
          {(profile?.level ?? 1) < 20 ? (
            <View style={styles.growthSectionHeader}>
              <Ionicons name="trending-up" size={16} color={Colors.dark.success} />
              <Text style={[styles.sectionTitle, { marginBottom: 0, alignSelf: 'center' }]}>Your Cognitive Growth</Text>
            </View>
          ) : (
            <Text style={styles.sectionTitle}>Intelligence Matrix</Text>
          )}

          {(profile?.level ?? 1) < 20 && (
            <Text style={styles.growthSubtitle}>
              These scores grow every session. You're building real cognitive strength.
            </Text>
          )}

          <View style={styles.intelGrid}>
            <View style={styles.intelItem}>
              <View style={styles.intelHeader}>
                <Ionicons name="bulb" size={16} color="#FFB74D" />
                <Text style={styles.intelLabel}>Reasoning</Text>
              </View>
              <Text style={styles.intelValue}>{Math.round(intelligenceIndices.reasoning)}</Text>
              <Text style={styles.intelDesc}>
                {(profile?.level ?? 1) < 20 ? 'Logic & problem-solving' : 'Problem solving & logic'}
              </Text>
            </View>
            <View style={styles.intelItem}>
              <View style={styles.intelHeader}>
                <Ionicons name="cube" size={16} color="#00D4FF" />
                <Text style={styles.intelLabel}>Spatial</Text>
              </View>
              <Text style={styles.intelValue}>{Math.round(intelligenceIndices.spatial)}</Text>
              <Text style={styles.intelDesc}>
                {(profile?.level ?? 1) < 20 ? 'Seeing patterns & shapes' : 'Visual-spatial reasoning'}
              </Text>
            </View>
            <View style={styles.intelItem}>
              <View style={styles.intelHeader}>
                <Ionicons name="water" size={16} color="#7B61FF" />
                <Text style={styles.intelLabel}>Fluid</Text>
              </View>
              <Text style={styles.intelValue}>{Math.round(intelligenceIndices.fluid)}</Text>
              <Text style={styles.intelDesc}>
                {(profile?.level ?? 1) < 20 ? 'Handling new challenges' : 'Novel problem solving'}
              </Text>
            </View>
            <View style={styles.intelItem}>
              <View style={styles.intelHeader}>
                <Ionicons name="library" size={16} color="#00E676" />
                <Text style={styles.intelLabel}>Crystallized</Text>
              </View>
              <Text style={styles.intelValue}>{Math.round(intelligenceIndices.crystallized)}</Text>
              <Text style={styles.intelDesc}>
                {(profile?.level ?? 1) < 20 ? 'Applying what you know' : 'Knowledge application'}</Text>
            </View>
          </View>

          {nBackN && parseInt(nBackN as string) > 0 && (
            <View style={styles.nBackResultCard}>
              <View style={styles.nBackResultHeader}>
                <Ionicons name="layers" size={18} color="#7B61FF" />
                <Text style={styles.nBackResultTitle}>Dual N-Back Result</Text>
                <View style={styles.nBackBadge}>
                  <Text style={styles.nBackBadgeText}>{nBackN}-Back</Text>
                </View>
              </View>
              <View style={styles.nBackResultRow}>
                <Text style={styles.nBackResultLabel}>Accuracy</Text>
                <Text style={[
                  styles.nBackResultValue,
                  {
                    color: parseFloat(nBackAccuracy as string) >= 80
                      ? Colors.dark.success
                      : parseFloat(nBackAccuracy as string) >= 50
                        ? Colors.dark.warning
                        : Colors.dark.error,
                  },
                ]}>
                  {nBackAccuracy}%
                </Text>
              </View>
              <Text style={styles.nBackResultHint}>
                {parseFloat(nBackAccuracy as string) >= 80
                  ? 'Outstanding! N-Back level will advance next session.'
                  : parseFloat(nBackAccuracy as string) >= 50
                    ? 'Good effort. Keep practicing to advance.'
                    : 'Level will adjust down to optimise your training.'}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Module Performance</Text>
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

          {adjustments.length > 0 && profile?.subscriptionType === 'premium' && (
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

          {profile?.subscriptionType !== 'premium' && (
            <View style={styles.freeTierMessage}>
              <Ionicons name="time-outline" size={18} color={Colors.dark.textSecondary} />
              <Text style={styles.freeTierMessageText}>
                Your next session unlocks in 24 hours. Upgrade for unlimited access.
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="timer" size={18} color={Colors.dark.brand} />
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

          {immediateAction && (
            <View style={styles.immediateActionCard}>
              <View style={styles.immediateActionHeader}>
                <Ionicons name={immediateAction.icon as any} size={20} color={Colors.dark.brand} />
                <Text style={styles.immediateActionTitle}>{immediateAction.title}</Text>
              </View>
              <Text style={styles.immediateActionText}>{immediateAction.action}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Apply Your Enhanced Cognition</Text>
          {learningApps.map((app, index) => (
            <View key={index} style={styles.learningAppCard}>
              <View style={styles.learningAppHeader}>
                <View style={[styles.learningAppIconBg, { backgroundColor: app.color + '18' }]}>
                  <Ionicons name={app.icon as any} size={20} color={app.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.learningAppTitle}>{app.title}</Text>
                  <Text style={styles.learningAppExplanation}>{app.explanation}</Text>
                </View>
              </View>
              <View style={styles.learningAppTips}>
                {app.tips.map((tip, i) => (
                  <View key={i} style={styles.learningAppTipRow}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.dark.success} />
                    <Text style={styles.learningAppTip}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

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
    backgroundColor: Colors.dark.brandDim,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.brand,
    marginBottom: 16,
  },
  levelUpText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.brand,
  },
  scoreCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.dark.brand,
    marginBottom: 28,
  },
  scoreValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: Colors.dark.brand,
  },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iqGainBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: Colors.dark.success,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  iqGainText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#0A0A0F',
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  intelGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 10,
  },
  intelItem: {
    width: '48%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  intelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  intelLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  intelValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  intelDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textTertiary,
    lineHeight: 14,
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
  freeTierMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  freeTierMessageText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
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
    backgroundColor: Colors.dark.brand,
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
  immediateActionCard: {
    width: '100%',
    backgroundColor: Colors.dark.brandDim,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.brand,
    marginBottom: 28,
  },
  immediateActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  immediateActionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.brand,
    flex: 1,
  },
  immediateActionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
  },
  learningAppCard: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    marginBottom: 14,
  },
  learningAppHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  learningAppIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  learningAppTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  learningAppExplanation: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  learningAppTips: {
    gap: 10,
  },
  learningAppTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  learningAppTip: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
    flex: 1,
  },
  nBackResultCard: {
    backgroundColor: '#7B61FF18',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#7B61FF40',
    marginBottom: 4,
  },
  nBackResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nBackResultTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
  },
  nBackBadge: {
    backgroundColor: '#7B61FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nBackBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#fff',
  },
  nBackResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nBackResultLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  nBackResultValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
  },
  nBackResultHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textTertiary,
    lineHeight: 18,
  },
  growthSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: -4,
  },
  growthSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  jarvisCard: {
    backgroundColor: '#0F172A',
    borderColor: '#00F0FF',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  jarvisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jarvisTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#00F0FF',
    letterSpacing: 1.5,
  },
  jarvisText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 22,
  },
});
