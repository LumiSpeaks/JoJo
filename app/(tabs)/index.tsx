import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Modal, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

const { width } = Dimensions.get('window');

const LEVEL_LABELS: Record<string, string> = {
  '1': 'Foundation',
  '2': 'Foundation',
  '3': 'Foundation',
  '10': 'Foundation',
  '11': 'Expansion',
  '20': 'Expansion',
  '21': 'Acceleration',
  '30': 'Acceleration',
  '31': 'Integration',
  '40': 'Integration',
  '41': 'Elite',
  '50': 'Elite',
};

function getLevelLabel(level: number): string {
  if (level <= 10) return 'Foundation';
  if (level <= 20) return 'Expansion';
  if (level <= 30) return 'Acceleration';
  if (level <= 40) return 'Integration';
  return 'Elite';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, canStartSession } = useUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!profile) return null;

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const today = new Date().toDateString();
  const sessionsToday = profile.lastSessionDate === today ? profile.sessionsToday : 0;

  const handleStartSession = () => {
    if (!canStartSession) {
      setShowUpgradeModal(true);
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push('/session');
  };

  const traits = [
    { label: 'Pattern', value: profile.patternLevel, icon: 'grid' as const, color: '#00D4FF' },
    { label: 'Memory', value: profile.memorySpan, icon: 'layers' as const, color: '#7B61FF' },
    { label: 'Speed', value: profile.speedIndex, icon: 'trending-up' as const, color: '#00E676' },
    { label: 'Flex', value: profile.flexibilityScore, icon: 'shuffle' as const, color: '#FFB74D' },
    { label: 'Dual', value: profile.dualTaskCapacity, icon: 'git-merge' as const, color: '#FF6EC7' },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Cognitive Training</Text>
            <View style={styles.levelRow}>
              <Text style={styles.levelText}>Level {profile.level}</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{getLevelLabel(profile.level)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.sessionCounter}>
            <Text style={styles.sessionCountText}>{sessionsToday}/3</Text>
            <Text style={styles.sessionCountLabel}>today</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.startSessionButton,
            pressed && styles.startSessionButtonPressed,
            !canStartSession && styles.startSessionButtonDisabled,
          ]}
          onPress={handleStartSession}
        >
          <LinearGradient
            colors={canStartSession ? ['#00D4FF', '#0099CC'] : ['#2A2A35', '#1A1A25']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startSessionGradient}
          >
            <Ionicons
              name="flash"
              size={28}
              color={canStartSession ? '#0A0A0F' : Colors.dark.textTertiary}
            />
            <Text style={[
              styles.startSessionText,
              !canStartSession && styles.startSessionTextDisabled,
            ]}>
              {canStartSession ? 'Start Session' : 'Daily Limit Reached'}
            </Text>
            <Text style={[
              styles.startSessionSub,
              !canStartSession && styles.startSessionSubDisabled,
            ]}>
              {canStartSession ? '20 minutes of adaptive training' : 'Upgrade for unlimited sessions'}
            </Text>
          </LinearGradient>
        </Pressable>

        <Text style={styles.sectionTitle}>Cognitive Profile</Text>

        <View style={styles.traitsGrid}>
          {traits.map((trait, i) => (
            <View key={i} style={styles.traitCard}>
              <View style={[styles.traitIconContainer, { backgroundColor: trait.color + '18' }]}>
                <Ionicons name={trait.icon} size={20} color={trait.color} />
              </View>
              <Text style={styles.traitValue}>{trait.value}</Text>
              <Text style={styles.traitLabel}>{trait.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={18} color={Colors.dark.tint} />
            <Text style={styles.statValue}>{profile.totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={18} color={Colors.dark.warning} />
            <Text style={styles.statValue}>{profile.level}/50</Text>
            <Text style={styles.statLabel}>Level Progress</Text>
          </View>
        </View>

        {profile.subscriptionType === 'basic' && (
          <Pressable
            style={({ pressed }) => [styles.upgradeCard, pressed && { opacity: 0.85 }]}
            onPress={() => setShowUpgradeModal(true)}
          >
            <View style={styles.upgradeContent}>
              <Ionicons name="diamond" size={22} color={Colors.dark.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.upgradeTitle}>Unlock Premium</Text>
                <Text style={styles.upgradeSubtext}>Unlimited sessions, Levels 21-50, advanced analytics</Text>
              </View>
              <Text style={styles.upgradePrice}>$30/mo</Text>
            </View>
          </Pressable>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <Modal visible={showUpgradeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable style={styles.modalClose} onPress={() => setShowUpgradeModal(false)}>
              <Ionicons name="close" size={24} color={Colors.dark.textSecondary} />
            </Pressable>

            <View style={styles.modalIconContainer}>
              <Ionicons name="diamond" size={48} color={Colors.dark.accent} />
            </View>

            <Text style={styles.modalTitle}>
              {canStartSession ? 'Upgrade to Premium' : "You've reached today's training limit"}
            </Text>
            <Text style={styles.modalSubtext}>
              Upgrade to Premium for unlimited sessions and Elite Levels.
            </Text>

            <View style={styles.modalFeatures}>
              {[
                'Unlimited daily sessions',
                'Access to Levels 21-50',
                'Advanced analytics dashboard',
                'Faster adaptive scaling',
              ].map((f, i) => (
                <View key={i} style={styles.modalFeatureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.dark.success} />
                  <Text style={styles.modalFeatureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.upgradeButton, pressed && { opacity: 0.85 }]}
              onPress={() => setShowUpgradeModal(false)}
            >
              <Text style={styles.upgradeButtonText}>Upgrade - $30/month</Text>
            </Pressable>

            <Pressable onPress={() => setShowUpgradeModal(false)}>
              <Text style={styles.modalDismiss}>Maybe later</Text>
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
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
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
    backgroundColor: Colors.dark.tintDim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.tint,
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
  startSessionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
  },
  startSessionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  startSessionButtonDisabled: {
    opacity: 0.7,
  },
  startSessionGradient: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  startSessionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: '#0A0A0F',
  },
  startSessionTextDisabled: {
    color: Colors.dark.textSecondary,
  },
  startSessionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(10, 10, 15, 0.7)',
  },
  startSessionSubDisabled: {
    color: Colors.dark.textTertiary,
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
});
