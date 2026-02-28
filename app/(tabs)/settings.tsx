import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useUser } from '@/contexts/UserContext';
import { calculateJojoIQ } from '@/lib/adaptive';
import { MAX_LEVEL, FREE_TIER_MAX_LEVEL, FREE_TIER_SESSIONS_PER_DAY } from '@/lib/constants';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ru', label: 'Русский' },
];

function SectionHeader({ title }: { title: string }) {
  const theme = useThemeColors();
  return (
    <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>{title}</Text>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }, style]}>
      {children}
    </View>
  );
}

function StatPill({
  icon, value, label, color,
}: { icon: string; value: string; label: string; color: string }) {
  const theme = useThemeColors();
  return (
    <View style={[styles.statPill, { backgroundColor: color + '12', borderColor: color + '30' }]}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={[styles.statPillLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const { profile, updateProfile, resetProfile } = useUser();
  const [resetConfirm, setResetConfirm] = useState(false);

  if (!profile) return null;

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const currentIQ = calculateJojoIQ(profile.level);
  const isPremium = profile.subscriptionType === 'premium';
  const levelCap = isPremium ? MAX_LEVEL : FREE_TIER_MAX_LEVEL;
  const today = new Date().toDateString();
  const sessionsToday = profile.lastSessionDate === today ? profile.sessionsToday : 0;

  const haptic = (style: 'light' | 'select' = 'light') => {
    if (Platform.OS === 'web') return;
    if (style === 'select') Haptics.selectionAsync();
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReset = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
    } else {
      resetProfile();
      setResetConfirm(false);
      router.replace('/onboarding');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={[styles.pageTitle, { color: theme.brand }]}>SETTINGS</Text>

        {/* ── Profile Card ────────────────────────────────────────────── */}
        <Card style={styles.profileCard}>
          <View style={[styles.profileIconBg, { backgroundColor: theme.brandDim, borderColor: theme.brand + '50' }]}>
            <Ionicons name="hardware-chip-outline" size={28} color={theme.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {isPremium ? 'Premium Operative' : 'Basic Operative'}
            </Text>
            <Text style={[styles.profileSub, { color: theme.textSecondary }]}>
              Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
          {isPremium && (
            <View style={[styles.premiumBadge, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '50' }]}>
              <Ionicons name="diamond" size={12} color={theme.accent} />
              <Text style={[styles.premiumBadgeText, { color: theme.accent }]}>PRO</Text>
            </View>
          )}
        </Card>

        {/* ── Stats Row ───────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatPill icon="hardware-chip-outline" value={`${currentIQ}`} label="Score" color={theme.brand} />
          <StatPill icon="trophy" value={`${profile.level}/${levelCap}`} label="Level" color={theme.accent} />
          <StatPill icon="flame" value={`${profile.currentStreak ?? 0}`} label="Streak" color="#FF6B35" />
          <StatPill icon="flash" value={`${sessionsToday}/${isPremium ? '∞' : FREE_TIER_SESSIONS_PER_DAY}`} label="Today" color={theme.success} />
        </View>

        {/* ── Subscription ────────────────────────────────────────────── */}
        <SectionHeader title="SUBSCRIPTION" />
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {isPremium ? 'Premium — Unlimited Access' : 'Basic — 3 Sessions/Day'}
              </Text>
              <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>
                {isPremium
                  ? `Level cap: ${MAX_LEVEL} · IQ target: 180 · Full analytics`
                  : `Level cap: ${FREE_TIER_MAX_LEVEL} · IQ target: 130 · Upgrade for mastery`}
              </Text>
            </View>
            {!isPremium && (
              <View style={[styles.upgradePill, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '40' }]}>
                <Text style={[styles.upgradePillText, { color: theme.accent }]}>$30/mo</Text>
              </View>
            )}
          </View>
          {!isPremium && (
            <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceBorder }]}>
              <View style={[styles.progressBarFill, { width: `${(profile.level / FREE_TIER_MAX_LEVEL) * 100}%`, backgroundColor: theme.brand }]} />
            </View>
          )}
        </Card>

        {/* ── Training Stats ───────────────────────────────────────────── */}
        <SectionHeader title="TRAINING RECORD" />
        <Card>
          {[
            { label: 'Total Sessions', value: `${profile.totalSessions}`, icon: 'calendar' },
            { label: 'Best Streak', value: `${profile.longestStreak ?? 0} days`, icon: 'trophy' },
            { label: 'N-Back Level', value: `${profile.nBackLevel ?? 2}-Back (best: ${profile.nBackBest ?? 2})`, icon: 'layers' },
          ].map((row, i) => (
            <View
              key={i}
              style={[
                styles.recordRow,
                i < 2 && { borderBottomColor: theme.surfaceBorder, borderBottomWidth: 1 },
              ]}
            >
              <Ionicons name={row.icon as any} size={16} color={theme.brand} />
              <Text style={[styles.recordLabel, { color: theme.textSecondary }]}>{row.label}</Text>
              <Text style={[styles.recordValue, { color: theme.text }]}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* ── Intelligence Indices ─────────────────────────────────────── */}
        <SectionHeader title="INTELLIGENCE MATRIX" />
        <Card>
          {[
            { label: 'Reasoning', value: profile.reasoningIndex ?? 0, color: '#F59E0B' },
            { label: 'Spatial', value: profile.spatialIndex ?? 0, color: theme.brand },
            { label: 'Fluid', value: profile.fluidIndex ?? 0, color: theme.accent },
            { label: 'Crystallized', value: profile.crystallizedIndex ?? 0, color: theme.success },
          ].map((idx, i) => (
            <View key={i} style={i < 3 && [styles.indexSep, { borderBottomColor: theme.surfaceBorder }]}>
              <View style={styles.indexRow}>
                <Text style={[styles.indexLabel, { color: theme.textSecondary }]}>{idx.label}</Text>
                <Text style={[styles.indexValue, { color: idx.color }]}>{Math.round(idx.value)}</Text>
              </View>
              <View style={[styles.indexBarBg, { backgroundColor: theme.surfaceBorder }]}>
                <View style={[styles.indexBarFill, { width: `${Math.min(100, idx.value)}%`, backgroundColor: idx.color }]} />
              </View>
            </View>
          ))}
        </Card>

        {/* ── Protocols ───────────────────────────────────────────────── */}
        <SectionHeader title="PROTOCOLS" />
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.rowLabelRow}>
                <Ionicons name="shield-checkmark" size={15} color={theme.error} />
                <Text style={[styles.rowTitle, { color: theme.error }]}>STRICT MODE</Text>
              </View>
              <Text style={[styles.rowDesc, { color: theme.textSecondary }]}>
                Fail session automatically if accuracy drops below 80%.
              </Text>
            </View>
            <Switch
              value={profile.strictMode ?? false}
              onValueChange={() => {
                haptic();
                updateProfile({ strictMode: !profile.strictMode });
              }}
              trackColor={{ false: theme.surfaceBorder, true: theme.error }}
              thumbColor={theme.text}
            />
          </View>
        </Card>

        {/* ── Interface ───────────────────────────────────────────────── */}
        <SectionHeader title="INTERFACE" />
        <Card>
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Theme</Text>
          <View style={[styles.segmentContainer, { backgroundColor: theme.background }]}>
            {(['system', 'light', 'dark'] as const).map(t => (
              <Pressable
                key={t}
                style={[
                  styles.segmentBtn,
                  profile.theme === t && { backgroundColor: theme.surfaceLight },
                ]}
                onPress={() => { haptic('select'); updateProfile({ theme: t }); }}
              >
                <Ionicons
                  name={t === 'system' ? 'contrast' : t === 'light' ? 'sunny' : 'moon'}
                  size={14}
                  color={profile.theme === t ? theme.brand : theme.textTertiary}
                />
                <Text style={[
                  styles.segmentText,
                  { color: profile.theme === t ? theme.text : theme.textTertiary },
                ]}>
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.separator, { backgroundColor: theme.surfaceBorder }]} />

          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map(lang => (
              <Pressable
                key={lang.code}
                style={[
                  styles.langBtn,
                  { borderColor: theme.surfaceBorder, backgroundColor: theme.background },
                  profile.language === lang.code && {
                    borderColor: theme.brand,
                    backgroundColor: theme.brandDim,
                  },
                ]}
                onPress={() => { haptic('select'); updateProfile({ language: lang.code as any }); }}
              >
                <Text style={[
                  styles.langText,
                  { color: profile.language === lang.code ? theme.brand : theme.textSecondary },
                  profile.language === lang.code && { fontFamily: 'Inter_700Bold' },
                ]}>
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* ── System ──────────────────────────────────────────────────── */}
        <SectionHeader title="SYSTEM" />
        <Pressable
          style={[
            styles.dangerBtn,
            { borderColor: theme.error + '50', backgroundColor: theme.error + '08' },
            resetConfirm && { backgroundColor: theme.error, borderColor: theme.error },
          ]}
          onPress={handleReset}
        >
          <Ionicons name="trash" size={17} color={resetConfirm ? '#fff' : theme.error} />
          <Text style={[styles.dangerText, { color: resetConfirm ? '#fff' : theme.error }]}>
            {resetConfirm ? 'CONFIRM — All data will be erased' : 'Factory Reset'}
          </Text>
        </Pressable>

        <Text style={[styles.version, { color: theme.textTertiary }]}>
          v2.5.0 · Jojo Core · Jojo Protocol
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  pageTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 28,
    letterSpacing: 2,
    marginBottom: 24,
  },
  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  profileIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginBottom: 3,
  },
  profileSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  premiumBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  statPillValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  statPillLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Section header
  sectionHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  // Card
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rowTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 3,
  },
  rowDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  // Subscription
  upgradePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  upgradePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Training record
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  recordLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    flex: 1,
  },
  recordValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  // Intelligence indices
  indexSep: {
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 14,
  },
  indexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  indexLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  indexValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  indexBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  indexBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Theme segment
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 10,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    marginBottom: 18,
  },
  // Language
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  langText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  // Danger zone
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  dangerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
