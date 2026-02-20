import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import Colors from '@/constants/colors';

export default function IndexScreen() {
  const { profile, isLoading } = useUser();

  useEffect(() => {
    if (isLoading) return;

    if (!profile) {
      router.replace('/onboarding');
    } else if (!profile.baselineCompleted) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [profile, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.dark.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
