import { useColorScheme } from 'react-native';
import Colors, { ThemeColors } from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';

/**
 * Returns theme colors based on user preference ('system' | 'light' | 'dark').
 * Falls back to system scheme if preference is 'system'.
 */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  const { profile } = useUser();
  
  const preference = profile?.theme ?? 'system';
  
  if (preference === 'light') return Colors.light;
  if (preference === 'dark') return Colors.dark;
  
  // Default to system
  return scheme === 'light' ? Colors.light : Colors.dark;
}
