import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Modal, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useUser } from '@/contexts/UserContext';
import { analyzeWeaknesses, calculateSessionDifficulty, calculateLearningVelocity, calculateJojoIQ } from '@/lib/adaptive';

// ... (imports)

export default function HomeScreen() {
  // ... (hooks)

  // Calculate Jojo IQ
  const currentIQ = useMemo(() => {
    if (!profile) return 90;
    return calculateJojoIQ(profile.level);
  }, [profile]);

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>J.A.R.V.I.S. PROTOCOL</Text>
            {personalizedMessage ? (
              <Text style={[styles.personalizedSub, { color: theme.textSecondary }]} numberOfLines={2}>{personalizedMessage}</Text>
            ) : null}
            
            {/* JOJO IQ DISPLAY */}
            <View style={[styles.iqBadge, { backgroundColor: theme.brandDim, borderColor: theme.brandGlow }]}>
              <View style={styles.iqRow}>
                <Ionicons name="hardware-chip-outline" size={24} color={theme.brand} />
                <Text style={[styles.iqValue, { color: theme.brand }]}>{currentIQ}</Text>
              </View>
              <Text style={[styles.iqLabel, { color: theme.brand }]}>CURRENT IQ</Text>
            </View>

            <View style={[styles.levelRow, { marginTop: 8 }]}>
              <Text style={[styles.levelText, { color: theme.text, fontSize: 16 }]}>Level {profile.level}</Text>
              <View style={[styles.levelProgressBar, { backgroundColor: theme.surfaceBorder }]}>
                <View style={[styles.levelProgressFill, { width: `${(profile.level / 100) * 100}%`, backgroundColor: theme.accent }]} />
              </View>
            </View>
          </View>
          <View style={[styles.sessionCounter, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.sessionCountText, { color: theme.text }]}>{sessionsToday}/{maxDaily}</Text>
            <Text style={[styles.sessionCountLabel, { color: theme.textSecondary }]}>today</Text>
          </View>
        </View>

        {analysis && (
          <View style={[styles.aiInsight, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.aiInsightHeader}>
              <Ionicons name="pulse" size={16} color={theme.brand} />
              <Text style={[styles.aiInsightTitle, { color: theme.brand }]}>Adaptive Focus</Text>
            </View>
            <Text style={[styles.aiInsightText, { color: theme.textSecondary }]}>
              Next session targets <Text style={[styles.aiInsightHighlight, { color: theme.brand }]}>{analysis.focusTrait.name}</Text>
              {analysis.stagnantTraits.length > 0 && (
                <Text> with variant challenges for stagnant areas</Text>
              )}
            </Text>
            {diffConfig && profile?.subscriptionType === 'premium' && (
              <Text style={[styles.aiInsightMeta, { color: theme.textTertiary }]}>
                Timer: {Math.round(diffConfig.timerMultiplier * 100)}% | Bias: {Math.round((diffConfig.questionCountBias[analysis.focusTrait.module] || 0.2) * 100)}% focus
              </Text>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.startSessionButton,
            pressed && styles.startSessionButtonPressed,
            !canStartSession && styles.startSessionButtonDisabled,
          ]}
          onPress={handleStartSession}
        >
          <LinearGradient
            colors={canStartSession ? [theme.brand, '#D4B02E'] : [theme.surfaceLight, theme.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startSessionGradient}
          >
            <Ionicons
              name="flash"
              size={22}
              color={canStartSession ? '#0A0A0F' : theme.textTertiary}
            />
            <Text style={[
              styles.startSessionText,
              !canStartSession && { color: theme.textSecondary },
            ]}>
              {canStartSession ? 'Start Session' : 'Daily Limit Reached'}
            </Text>
            <Text style={[
              styles.startSessionSub,
              !canStartSession && { color: theme.textTertiary },
            ]}>
              {canStartSession ? 'Personalized adaptive training' : 'Upgrade for unlimited sessions'}
            </Text>
          </LinearGradient>
        </Pressable>

        {learningVelocity && learningVelocity.velocity !== 0 && (
          <View style={[styles.velocityCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.velocityHeader}>
              <Ionicons name="trending-up" size={20} color={learningVelocity.velocity > 0 ? theme.success : theme.warning} />
              <Text style={[styles.velocityTitle, { color: theme.text }]}>Learning Velocity</Text>
              <Text style={[
                styles.velocityValue,
                { color: learningVelocity.velocity > 0 ? theme.success : theme.warning }
              ]}>
                {learningVelocity.velocity > 0 ? '+' : ''}{learningVelocity.velocity.toFixed(1)}%
              </Text>
            </View>
            <Text style={[styles.velocityText, { color: theme.text }]}>{learningVelocity.interpretation}</Text>
            {learningVelocity.velocity > 0 && (
              <Text style={[styles.velocitySubtext, { color: theme.textSecondary }]}>
                At this rate, tasks that took 60 min will take ~{Math.round(60 * (1 - learningVelocity.velocity / 100))} min
              </Text>
            )}
          </View>
        )}

        {profile.currentStreak && profile.currentStreak > 0 && (
          <View style={[styles.streakCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.streakContent}>
              <Ionicons name="flame" size={24} color="#FF6B35" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.streakValue, { color: theme.text }]}>{profile.currentStreak} day{profile.currentStreak > 1 ? 's' : ''}</Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Current Streak</Text>
              </View>
              {profile.longestStreak && profile.longestStreak > profile.currentStreak && (
                <View style={[styles.streakRecord, { backgroundColor: theme.brandDim }]}>
                  <Text style={[styles.streakRecordLabel, { color: theme.brand }]}>Record</Text>
                  <Text style={[styles.streakRecordValue, { color: theme.brand }]}>{profile.longestStreak}</Text>
                </View>
              )}
            </View>
            {profile.subscriptionType === 'basic' && (
              <Text style={[styles.streakTip, { color: theme.textSecondary, borderTopColor: theme.surfaceBorder }]}>
                💡 Research shows: 2-3 sessions/day for 8 weeks = optimal results
              </Text>
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Cognitive Profile</Text>

        <View style={styles.traitsGrid}>
          {traits.map((trait, i) => (
            <View key={i} style={[
              styles.traitCard,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              isWeakest(trait.label) && { borderColor: theme.brandGlow, backgroundColor: theme.brandDim },
              isStagnant(trait.label) && { borderColor: theme.warningDim },
            ]}>
              <View style={[styles.traitIconContainer, { backgroundColor: trait.color + '18' }]}>
                <Ionicons name={trait.icon} size={20} color={trait.color} />
              </View>
              <Text style={[styles.traitValue, { color: theme.text }]}>{trait.value}</Text>
              <Text style={[styles.traitLabel, { color: theme.textSecondary }]}>{trait.label}</Text>
              {isWeakest(trait.label) && (
                <View style={[styles.focusBadge, { backgroundColor: theme.brandDim }]}>
                  <Text style={[styles.focusBadgeText, { color: theme.brand }]}>FOCUS</Text>
                </View>
              )}
              {isStagnant(trait.label) && !isWeakest(trait.label) && (
                <View style={[styles.stagnantBadge, { backgroundColor: theme.warningDim }]}>
                  <Text style={[styles.stagnantBadgeText, { color: theme.warning }]}>STAG</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="calendar" size={18} color={theme.brand} />
            <Text style={[styles.statValue, { color: theme.text }]}>{profile.totalSessions}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sessions</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="trophy" size={18} color={theme.warning} />
            <Text style={[styles.statValue, { color: theme.text }]}>
              {profile.level}/{profile.subscriptionType === 'premium' ? MAX_LEVEL : FREE_TIER_MAX_LEVEL}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Level Progress</Text>
          </View>
        </View>

        {profile.subscriptionType !== 'premium' && (
          <Pressable
            style={({ pressed }) => [styles.upgradeCard, { backgroundColor: theme.accentDim, borderColor: theme.accentDim }, pressed && { opacity: 0.85 }]}
            onPress={() => setShowUpgradeModal(true)}
          >
            <View style={styles.upgradeContent}>
              <Ionicons name="diamond" size={22} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.upgradeTitle, { color: theme.text }]}>Unlock Premium</Text>
                <Text style={[styles.upgradeSubtext, { color: theme.textSecondary }]}>Unlimited sessions, Level 100 mastery, advanced analytics</Text>
              </View>
              <Text style={[styles.upgradePrice, { color: theme.accent }]}>$30/mo</Text>
            </View>
          </Pressable>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={showUpgradeModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Pressable style={styles.modalClose} onPress={() => setShowUpgradeModal(false)}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>

            <View style={styles.modalIconContainer}>
              <Ionicons name="diamond" size={48} color={theme.accent} />
            </View>

            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {canStartSession ? 'Upgrade to Premium' : "You've used today's free sessions"}
            </Text>
            <Text style={[styles.modalSubtext, { color: theme.textSecondary }]}>
              {canStartSession
                ? 'Unlock unlimited sessions, Level 100 mastery, and advanced analytics.'
                : 'You get 3 free sessions per day. Upgrade for unlimited access and full mastery.'}
            </Text>

            <View style={styles.modalFeatures}>
              {[
                'Unlimited training sessions',
                'Advanced AI difficulty scaling',
                'Deep performance analytics',
                'Full mastery (Level 100)',
              ].map((f, i) => (
                <View key={i} style={styles.modalFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  <Text style={[styles.modalFeatureText, { color: theme.text }]}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.upgradeButton, { backgroundColor: theme.accent }, pressed && { opacity: 0.85 }]}
              onPress={() => setShowUpgradeModal(false)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade - $30/month</Text>
            </Pressable>

            <Pressable onPress={() => setShowUpgradeModal(false)}>
              <Text style={[styles.modalDismiss, { color: theme.textSecondary }]}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Background color set dynamically
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iqBadge: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  iqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iqValue: {
    fontFamily: 'Inter_900Black',
    fontSize: 28,
  },
  iqLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
  },
  levelProgressBar: {
    height: 4,
    width: 100,
    borderRadius: 2,
    marginLeft: 10,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  personalizedSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginBottom: 2,
    maxWidth: 260,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
  },
  levelBadge: {
    backgroundColor: Colors.dark.brandDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.brand,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sessionCounter: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  sessionCountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
  },
  sessionCountLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiInsight: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiInsightTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.dark.brand,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  aiInsightText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
  },
  aiInsightHighlight: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.dark.brand,
  },
  aiInsightMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 8,
  },
  startSessionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
  },
  startSessionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  startSessionButtonDisabled: {
    opacity: 0.7,
  },
  startSessionGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  startSessionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: '#0A0A0F',
  },
  startSessionTextDisabled: {
    color: Colors.dark.textSecondary,
  },
  startSessionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(10, 10, 15, 0.7)',
  },
  startSessionSubDisabled: {
    color: Colors.dark.textTertiary,
  },
  velocityCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  velocityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  velocityTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.text,
    flex: 1,
  },
  velocityValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
  },
  velocityText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  velocitySubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 16,
  },
  streakCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  streakValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
  },
  streakLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  streakRecord: {
    backgroundColor: Colors.dark.brandDim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  streakRecordLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.dark.brand,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  streakRecordValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.brand,
  },
  streakTip: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.surfaceBorder,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.textSecondary,
    marginBottom: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  traitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  traitCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    width: (width - 60) / 3,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  traitCardFocus: {
    borderColor: Colors.dark.brand + '60',
    backgroundColor: Colors.dark.brandDim,
  },
  traitCardStagnant: {
    borderColor: Colors.dark.warning + '40',
  },
  traitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  traitValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  traitLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  focusBadge: {
    backgroundColor: Colors.dark.brand + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  focusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    color: Colors.dark.brand,
    letterSpacing: 1,
  },
  stagnantBadge: {
    backgroundColor: Colors.dark.warningDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  stagnantBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    color: Colors.dark.warning,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  upgradeCard: {
    backgroundColor: Colors.dark.accentDim,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.accent + '40',
  },
  upgradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  upgradeTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  upgradeSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  upgradePrice: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.dark.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  modalClose: {
    position: 'absolute' as const,
    top: 16,
    right: 16,
    zIndex: 1,
  },
  modalIconContainer: {
    marginBottom: 20,
    marginTop: 8,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalFeatures: {
    width: '100%',
    gap: 12,
    marginBottom: 28,
  },
  modalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalFeatureText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
  },
  upgradeButton: {
    backgroundColor: Colors.dark.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  upgradeButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
  modalDismiss: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    paddingVertical: 8,
  },
  },
});
