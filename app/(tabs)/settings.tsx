import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, resetProfile } = useUser();
  const [resetConfirm, setResetConfirm] = useState(false);

  if (!profile) return null;

  const toggleSwitch = (key: 'strictMode') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateProfile({ [key]: !profile[key] });
  };

  const setLanguage = (lang: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateProfile({ language: lang as any });
  };

  const setTheme = (theme: 'system' | 'light' | 'dark') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateProfile({ theme });
  };

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
    { code: 'ru', label: 'Русский' },
  ];

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>J.A.R.V.I.S. CONFIG</Text>

        {/* PROTOCOLS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PROTOCOLS</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <View style={styles.rowLabelContainer}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.dark.error} />
                  <Text style={[styles.rowLabel, { color: Colors.dark.error }]}>STRICT MODE</Text>
                </View>
                <Text style={styles.rowDesc}>Fail session if accuracy &lt; 80%.</Text>
              </View>
              <Switch
                value={profile.strictMode ?? false}
                onValueChange={() => toggleSwitch('strictMode')}
                trackColor={{ false: Colors.dark.surfaceBorder, true: Colors.dark.error }}
                thumbColor={Colors.dark.text}
              />
            </View>
          </View>
        </View>

        {/* INTERFACE SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INTERFACE</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Theme</Text>
            <View style={styles.segmentContainer}>
              {['system', 'light', 'dark'].map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.segmentBtn,
                    profile.theme === t && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTheme(t as any)}
                >
                  <Text style={[
                    styles.segmentText,
                    profile.theme === t && styles.segmentTextActive
                  ]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.separator} />

            <Text style={styles.cardLabel}>Language</Text>
            <View style={styles.langGrid}>
              {languages.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[
                    styles.langBtn,
                    profile.language === lang.code && styles.langBtnActive,
                  ]}
                  onPress={() => setLanguage(lang.code)}
                >
                  <Text style={[
                    styles.langText,
                    profile.language === lang.code && styles.langTextActive
                  ]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* SYSTEM SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SYSTEM</Text>
          <Pressable
            style={[styles.dangerBtn, resetConfirm && styles.dangerBtnActive]}
            onPress={handleReset}
          >
            <Ionicons name="trash" size={18} color={resetConfirm ? '#FFF' : Colors.dark.error} />
            <Text style={[styles.dangerText, resetConfirm && { color: '#FFF' }]}>
              {resetConfirm ? 'CONFIRM FACTORY RESET?' : 'Factory Reset'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.version}>v2.4.0 • J.A.R.V.I.S. Core</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 24,
  },
  headerTitle: {
    fontFamily: 'Inter_900Black',
    fontSize: 24,
    color: Colors.dark.brand,
    marginBottom: 32,
    letterSpacing: 2,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    paddingRight: 16,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rowLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.text,
  },
  rowDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: Colors.dark.surfaceLight,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  segmentTextActive: {
    color: Colors.dark.text,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.dark.surfaceBorder,
    marginBottom: 20,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    backgroundColor: Colors.dark.background,
  },
  langBtnActive: {
    borderColor: Colors.dark.brand,
    backgroundColor: Colors.dark.brandDim,
  },
  langText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  langTextActive: {
    color: Colors.dark.brand,
    fontFamily: 'Inter_700Bold',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  dangerBtnActive: {
    backgroundColor: Colors.dark.error,
    borderColor: Colors.dark.error,
  },
  dangerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.dark.error,
  },
  version: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 20,
  },
});
