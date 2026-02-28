import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useUser } from '@/contexts/UserContext';
import { generateLearningApplications, generateImmediateAction } from '@/lib/learning-applications';

// ─── Static module data ────────────────────────────────────────────────────────

const MODULES = [
  {
    key: 'pattern',
    label: 'Pattern Recognition',
    icon: 'grid' as const,
    color: '#00F0FF',
    trait: 'Reasoning · Spatial',
    what: 'Spot rules hidden in grids of shapes and colors. Grids scale from 3×3 to 4×4 with up to 8 named rule schemes.',
    why: 'Strengthens the brain\'s ability to extract structure from noise — the core of mathematical and scientific thinking.',
    realWorld: ['Spotting trends in data', 'Reading charts quickly', 'Debugging code logic'],
  },
  {
    key: 'memory',
    label: 'Working Memory',
    icon: 'layers' as const,
    color: '#8B5CF6',
    trait: 'Fluid Intelligence',
    what: 'Memorize a sequence of symbols, then recall it in a transformed order (reversed, sorted, filtered, etc.).',
    why: 'Working memory is the mental workspace where thinking happens. More capacity = faster learning.',
    realWorld: ['Following multi-step instructions', 'Mental math', 'Reading comprehension'],
  },
  {
    key: 'ruleMutation',
    label: 'Processing Speed',
    icon: 'flash' as const,
    color: '#10B981',
    trait: 'Fluid · Crystallized',
    what: 'Apply a transformation rule to a number. The rule changes mid-session — detect the switch and adapt.',
    why: 'Trains the ability to update mental models quickly, reducing cognitive lag when context changes.',
    realWorld: ['Rapid decision-making', 'Reading speed', 'Switching between tasks'],
  },
  {
    key: 'dualTask',
    label: 'Cognitive Flexibility',
    icon: 'shuffle' as const,
    color: '#F59E0B',
    trait: 'Fluid Intelligence',
    what: 'Track a visual shape sequence AND count color flashes simultaneously — two cognitive streams at once.',
    why: 'Builds divided-attention capacity and the ability to hold multiple rules active at the same time.',
    realWorld: ['Multitasking under pressure', 'Listening while taking notes', 'Driving in complex conditions'],
  },
  {
    key: 'rapidLogic',
    label: 'Dual-Task Processing',
    icon: 'git-merge' as const,
    color: '#EF4444',
    trait: 'Reasoning · Crystallized',
    what: 'Timed syllogisms, verbal analogies, and number series. Question type and difficulty escalate with your level.',
    why: 'Forces rapid logical evaluation under time pressure — exactly how the brain must operate in real conversations and tests.',
    realWorld: ['Verbal reasoning', 'Standardized tests', 'Debating and persuasion'],
  },
];

const INTELLIGENCE_TYPES = [
  {
    key: 'reasoning',
    label: 'Reasoning',
    icon: 'bulb' as const,
    color: '#F59E0B',
    description: 'Your ability to solve problems step-by-step using logic. Combines Pattern + Speed + Rapid Logic performance.',
    boostTip: 'Focus sessions with high accuracy in Pattern Recognition push this index up fastest.',
  },
  {
    key: 'spatial',
    label: 'Spatial',
    icon: 'cube' as const,
    color: '#00F0FF',
    description: 'Visual-spatial reasoning — how well you mentally manipulate shapes, grids, and structures.',
    boostTip: 'Pattern Recognition (55%) and Dual-Task (45%) drive this index.',
  },
  {
    key: 'fluid',
    label: 'Fluid',
    icon: 'water' as const,
    color: '#8B5CF6',
    description: 'Raw problem-solving capacity in novel situations — intelligence independent of prior knowledge.',
    boostTip: 'All four modules contribute equally. Balanced training is key.',
  },
  {
    key: 'crystallized',
    label: 'Crystallized',
    icon: 'diamond' as const,
    color: '#10B981',
    description: 'Knowledge-based intelligence: the depth and speed of applying what you know.',
    boostTip: 'Rapid Logic (80%) drives this the most. Consistent reasoning sessions compound quickly.',
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useThemeColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

function ModuleCard({ mod }: { mod: typeof MODULES[0] }) {
  const theme = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={[styles.moduleCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}
      onPress={() => setExpanded(e => !e)}
    >
      <View style={styles.moduleCardHeader}>
        <View style={[styles.moduleIcon, { backgroundColor: mod.color + '18' }]}>
          <Ionicons name={mod.icon} size={20} color={mod.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.moduleLabel, { color: theme.text }]}>{mod.label}</Text>
          <Text style={[styles.moduleTrait, { color: mod.color }]}>{mod.trait}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textTertiary}
        />
      </View>

      {expanded && (
        <View style={[styles.moduleExpanded, { borderTopColor: theme.surfaceBorder }]}>
          <Text style={[styles.expandedLabel, { color: theme.textTertiary }]}>WHAT YOU DO</Text>
          <Text style={[styles.expandedText, { color: theme.textSecondary }]}>{mod.what}</Text>

          <Text style={[styles.expandedLabel, { color: theme.textTertiary, marginTop: 12 }]}>WHY IT WORKS</Text>
          <Text style={[styles.expandedText, { color: theme.textSecondary }]}>{mod.why}</Text>

          <Text style={[styles.expandedLabel, { color: theme.textTertiary, marginTop: 12 }]}>REAL-WORLD GAINS</Text>
          {mod.realWorld.map((r, i) => (
            <View key={i} style={styles.realWorldRow}>
              <View style={[styles.realWorldDot, { backgroundColor: mod.color }]} />
              <Text style={[styles.expandedText, { color: theme.textSecondary }]}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function IQTypeCard({ item }: { item: typeof INTELLIGENCE_TYPES[0] }) {
  const theme = useThemeColors();
  return (
    <View style={[styles.iqTypeCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
      <View style={[styles.iqTypeIcon, { backgroundColor: item.color + '18' }]}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <Text style={[styles.iqTypeLabel, { color: item.color }]}>{item.label}</Text>
      <Text style={[styles.iqTypeDesc, { color: theme.textSecondary }]}>{item.description}</Text>
      <View style={[styles.iqTypeTipBox, { backgroundColor: item.color + '10', borderColor: item.color + '30' }]}>
        <Ionicons name="flash" size={12} color={item.color} />
        <Text style={[styles.iqTypeTip, { color: item.color }]}>{item.boostTip}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const { profile, sessionLogs } = useUser();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const learningApps = useMemo(() => {
    if (!profile) return [];
    const indices = {
      reasoning: profile.reasoningIndex ?? 0,
      spatial: profile.spatialIndex ?? 0,
      fluid: profile.fluidIndex ?? 0,
      crystallized: profile.crystallizedIndex ?? 0,
    };
    if (indices.reasoning + indices.spatial + indices.fluid + indices.crystallized === 0) return [];
    return generateLearningApplications(indices, profile.level);
  }, [profile]);

  const immediateAction = useMemo(() => {
    if (!profile) return null;
    const indices = {
      reasoning: profile.reasoningIndex ?? 0,
      spatial: profile.spatialIndex ?? 0,
      fluid: profile.fluidIndex ?? 0,
      crystallized: profile.crystallizedIndex ?? 0,
    };
    return generateImmediateAction(indices, profile.level);
  }, [profile]);

  return (
    <View style={[styles.container, { paddingTop: topPadding, backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={[styles.pageTitle, { color: theme.brand }]}>LIBRARY</Text>
        <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
          The science behind your training
        </Text>

        {/* ── Immediate Action (personalised) ─────────────────────────── */}
        {immediateAction && (
          <>
            <SectionHeader title="TRY THIS NOW" />
            <View style={[styles.actionCard, { backgroundColor: theme.brandDim, borderColor: theme.brand + '40' }]}>
              <View style={styles.actionHeader}>
                <Ionicons name={immediateAction.icon as any} size={20} color={theme.brand} />
                <Text style={[styles.actionTitle, { color: theme.brand }]}>{immediateAction.title}</Text>
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>{immediateAction.action}</Text>
            </View>
          </>
        )}

        {/* ── Learning Applications (personalised) ────────────────────── */}
        {learningApps.length > 0 && (
          <>
            <SectionHeader
              title="YOUR LEARNING STRATEGY"
              subtitle="Tailored to your Intelligence Matrix"
            />
            {learningApps.map((app, i) => (
              <View key={i} style={[styles.stratCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <View style={styles.stratHeader}>
                  <View style={[styles.stratIcon, { backgroundColor: app.color + '18' }]}>
                    <Ionicons name={app.icon as any} size={18} color={app.color} />
                  </View>
                  <Text style={[styles.stratTitle, { color: theme.text }]}>{app.title}</Text>
                </View>
                <Text style={[styles.stratExplanation, { color: theme.textSecondary }]}>{app.explanation}</Text>
                {app.tips.map((tip, j) => (
                  <View key={j} style={styles.tipRow}>
                    <View style={[styles.tipDot, { backgroundColor: app.color }]} />
                    <Text style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ── Training Modules ─────────────────────────────────────────── */}
        <SectionHeader
          title="TRAINING MODULES"
          subtitle="Tap any module to learn what it trains and why"
        />
        {MODULES.map(mod => <ModuleCard key={mod.key} mod={mod} />)}

        {/* ── Intelligence Indices ─────────────────────────────────────── */}
        <SectionHeader
          title="INTELLIGENCE INDICES"
          subtitle="How your Jojo IQ score is calculated"
        />
        <View style={styles.iqGrid}>
          {INTELLIGENCE_TYPES.map(item => <IQTypeCard key={item.key} item={item} />)}
        </View>

        {/* ── IQ Scale ─────────────────────────────────────────────────── */}
        <SectionHeader title="JOJO IQ SCALE" />
        <View style={[styles.iqScaleCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          {[
            { range: 'Level 1', iq: '~90', label: 'Baseline', color: theme.textTertiary },
            { range: 'Level 20', iq: '107', label: 'Above Average', color: theme.textSecondary },
            { range: 'Level 50', iq: '130', label: 'Gifted', color: theme.brand },
            { range: 'Level 75', iq: '155', label: 'Exceptional', color: theme.accent },
            { range: 'Level 100', iq: '180', label: 'Mastery', color: '#F59E0B' },
          ].map((row, i) => (
            <View
              key={i}
              style={[
                styles.iqScaleRow,
                i < 4 && { borderBottomColor: theme.surfaceBorder, borderBottomWidth: 1 },
              ]}
            >
              <Text style={[styles.iqScaleLevel, { color: theme.textTertiary }]}>{row.range}</Text>
              <Text style={[styles.iqScaleIQ, { color: row.color }]}>IQ {row.iq}</Text>
              <Text style={[styles.iqScaleLabel, { color: row.color }]}>{row.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Science note ─────────────────────────────────────────────── */}
        <View style={[styles.scienceNote, { backgroundColor: theme.surfaceLight, borderColor: theme.surfaceBorder }]}>
          <Ionicons name="flask" size={16} color={theme.textTertiary} />
          <Text style={[styles.scienceText, { color: theme.textTertiary }]}>
            Jojo is built on dual n-back research, fluid intelligence training, and spaced repetition principles. Consistent daily practice is the only predictor of long-term cognitive gain.
          </Text>
        </View>

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
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 32,
  },
  sectionHeader: { marginBottom: 14 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  // Action card
  actionCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  actionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  actionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  // Strategy cards
  stratCard: {
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  stratHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  stratIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stratTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    flex: 1,
  },
  stratExplanation: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tipText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  // Module cards
  moduleCard: {
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  moduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  moduleTrait: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  moduleExpanded: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  expandedLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  expandedText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  realWorldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  realWorldDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  // IQ type grid
  iqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  iqTypeCard: {
    width: '47.5%',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  iqTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iqTypeLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 6,
  },
  iqTypeDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  iqTypeTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
  },
  iqTypeTip: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  // IQ scale
  iqScaleCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 28,
  },
  iqScaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  iqScaleLevel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    width: 80,
  },
  iqScaleIQ: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    flex: 1,
  },
  iqScaleLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  // Science note
  scienceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  scienceText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
