import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

const { width } = Dimensions.get('window');

function RadarChart({ values, labels, colors }: { values: number[]; labels: string[]; colors: string[] }) {
  const size = width - 80;
  const center = size / 2;
  const maxRadius = center - 40;
  const sides = values.length;

  const getPoint = (index: number, value: number, max: number) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2;
    const radius = (value / max) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  const maxVal = 20;

  return (
    <View style={[styles.radarContainer, { width: size, height: size }]}>
      {[0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <View
          key={i}
          style={[
            styles.radarRing,
            {
              width: maxRadius * 2 * ratio,
              height: maxRadius * 2 * ratio,
              borderRadius: maxRadius * ratio,
              left: center - maxRadius * ratio,
              top: center - maxRadius * ratio,
            },
          ]}
        />
      ))}

      {values.map((val, i) => {
        const point = getPoint(i, val, maxVal);
        const labelPoint = getPoint(i, maxVal + 4, maxVal);
        return (
          <React.Fragment key={i}>
            <View
              style={[
                styles.radarDot,
                {
                  left: point.x - 5,
                  top: point.y - 5,
                  backgroundColor: colors[i],
                },
              ]}
            />
            <Text
              style={[
                styles.radarLabel,
                {
                  left: labelPoint.x - 25,
                  top: labelPoint.y - 8,
                  color: colors[i],
                },
              ]}
            >
              {labels[i]}
            </Text>
            <Text
              style={[
                styles.radarValue,
                {
                  left: point.x - 10,
                  top: point.y + 8,
                },
              ]}
            >
              {val}
            </Text>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function WeeklyChart({ logs }: { logs: { averageAccuracy: number; date: string }[] }) {
  const last7 = logs.slice(-7);
  if (last7.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons name="analytics" size={32} color={Colors.dark.textTertiary} />
        <Text style={styles.emptyChartText}>Complete sessions to see your weekly performance</Text>
      </View>
    );
  }

  const maxAcc = 100;
  const barWidth = (width - 80) / 7 - 8;

  return (
    <View style={styles.weeklyChartContainer}>
      <View style={styles.chartBars}>
        {last7.map((log, i) => {
          const height = Math.max(4, (log.averageAccuracy / maxAcc) * 100);
          const dayLabel = new Date(log.date).toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
          return (
            <View key={i} style={styles.chartBarColumn}>
              <Text style={styles.chartBarValue}>{Math.round(log.averageAccuracy)}%</Text>
              <View style={[styles.chartBar, { height, width: barWidth }]}>
                <View
                  style={[
                    styles.chartBarFill,
                    {
                      height: '100%',
                      backgroundColor:
                        log.averageAccuracy >= 80
                          ? Colors.dark.success
                          : log.averageAccuracy >= 60
                          ? Colors.dark.warning
                          : Colors.dark.error,
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartBarLabel}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { profile, sessionLogs } = useUser();

  if (!profile) return null;

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const radarValues = [
    profile.patternLevel,
    profile.memorySpan,
    profile.speedIndex,
    profile.flexibilityScore,
    profile.dualTaskCapacity,
  ];
  const radarLabels = ['Pattern', 'Memory', 'Speed', 'Flex', 'Dual'];
  const radarColors = ['#00D4FF', '#7B61FF', '#00E676', '#FFB74D', '#FF6EC7'];

  const recentLogs = sessionLogs.map(l => ({
    averageAccuracy: l.averageAccuracy,
    date: l.date,
  }));

  const avgAccuracy = sessionLogs.length > 0
    ? sessionLogs.reduce((s, l) => s + l.averageAccuracy, 0) / sessionLogs.length
    : 0;

  const avgReactionTime = sessionLogs.length > 0
    ? sessionLogs.reduce((s, l) => s + l.averageReactionTime, 0) / sessionLogs.length
    : 0;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.screenTitle}>Progress</Text>

        <View style={styles.levelCard}>
          <View style={styles.levelCardHeader}>
            <View>
              <Text style={styles.levelCardLabel}>CURRENT LEVEL</Text>
              <Text style={styles.levelCardValue}>{profile.level}</Text>
            </View>
            <View style={styles.levelProgressContainer}>
              <View style={styles.levelProgressBar}>
                <View
                  style={[
                    styles.levelProgressFill,
                    { width: `${Math.min(100, (profile.level / 50) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.levelProgressText}>{profile.level} / 50</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cognitive Radar</Text>
        <View style={styles.radarSection}>
          <RadarChart values={radarValues} labels={radarLabels} colors={radarColors} />
        </View>

        <Text style={styles.sectionTitle}>Weekly Performance</Text>
        <View style={styles.card}>
          <WeeklyChart logs={recentLogs} />
        </View>

        <Text style={styles.sectionTitle}>Overall Stats</Text>
        <View style={styles.overallStatsGrid}>
          <View style={styles.overallStatCard}>
            <Ionicons name="flame" size={20} color={Colors.dark.tint} />
            <Text style={styles.overallStatValue}>{profile.totalSessions}</Text>
            <Text style={styles.overallStatLabel}>Sessions</Text>
          </View>
          <View style={styles.overallStatCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.dark.success} />
            <Text style={styles.overallStatValue}>{avgAccuracy > 0 ? `${Math.round(avgAccuracy)}%` : '--'}</Text>
            <Text style={styles.overallStatLabel}>Avg Accuracy</Text>
          </View>
          <View style={styles.overallStatCard}>
            <Ionicons name="timer" size={20} color={Colors.dark.warning} />
            <Text style={styles.overallStatValue}>{avgReactionTime > 0 ? `${(avgReactionTime / 1000).toFixed(1)}s` : '--'}</Text>
            <Text style={styles.overallStatLabel}>Avg Speed</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Trait Details</Text>
        {radarLabels.map((label, i) => (
          <View key={i} style={styles.traitDetailRow}>
            <View style={[styles.traitDetailDot, { backgroundColor: radarColors[i] }]} />
            <Text style={styles.traitDetailLabel}>{label}</Text>
            <View style={styles.traitDetailBarBg}>
              <View
                style={[
                  styles.traitDetailBarFill,
                  {
                    width: `${Math.min(100, (radarValues[i] / 20) * 100)}%`,
                    backgroundColor: radarColors[i],
                  },
                ]}
              />
            </View>
            <Text style={styles.traitDetailValue}>{radarValues[i]}</Text>
          </View>
        ))}

        <View style={{ height: 120 }} />
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  screenTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
    marginBottom: 20,
  },
  levelCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  levelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelCardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  levelCardValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 42,
    color: Colors.dark.tint,
  },
  levelProgressContainer: {
    flex: 1,
    marginLeft: 20,
    gap: 6,
  },
  levelProgressBar: {
    height: 8,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: Colors.dark.tint,
    borderRadius: 4,
  },
  levelProgressText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'right',
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  radarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  radarContainer: {
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  radarDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radarLabel: {
    position: 'absolute',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    width: 50,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  radarValue: {
    position: 'absolute',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.dark.text,
    width: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyChartText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
  weeklyChartContainer: {
    paddingVertical: 8,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 130,
  },
  chartBarColumn: {
    alignItems: 'center',
    gap: 4,
  },
  chartBarValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
  chartBar: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.dark.progressBackground,
  },
  chartBarFill: {
    borderRadius: 4,
  },
  chartBarLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  overallStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  overallStatCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  overallStatValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.dark.text,
  },
  overallStatLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  traitDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  traitDetailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  traitDetailLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.dark.text,
    width: 60,
  },
  traitDetailBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.dark.progressBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  traitDetailBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  traitDetailValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.dark.text,
    width: 24,
    textAlign: 'right',
  },
});
