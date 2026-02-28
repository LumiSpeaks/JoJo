/** Single theme shape for dark or light mode. */
export type ThemeColors = {
  background: string;
  surface: string;
  logoBackground: string;
  logoBorder: string;
  logoIcon: string;
  surfaceLight: string;
  surfaceBorder: string;
  surfaceHighest: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  brand: string;
  brandDim: string;
  brandGlow: string;
  tint: string;
  tintDim: string;
  tintGlow: string;
  outline: string;
  outlineDimmer: string;
  accent: string;
  accentDim: string;
  success: string;
  successDim: string;
  error: string;
  errorDim: string;
  warning: string;
  warningDim: string;
  tabIconDefault: string;
  tabIconSelected: string;
  progressBar: string;
  progressBackground: string;
  cardGradientStart: string;
  cardGradientEnd: string;
  overlay: string;
};

const Colors = {
  /** Dark mode: Jojo / Cyberpunk style. Deep blacks, neon accents, glassmorphism. */
  dark: {
    background: '#050B14', // Deeper, almost black blue
    surface: '#0F172A',    // Rich dark blue-grey
    logoBackground: '#0F172A',
    logoBorder: '#00F0FF', // Neon Cyan
    logoIcon: '#00F0FF',
    surfaceLight: '#1E293B',
    surfaceBorder: '#334155',
    surfaceHighest: '#475569',
    text: '#F8FAFC',       // Crisp white
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    brand: '#00F0FF',      // Neon Cyan
    brandDim: 'rgba(0, 240, 255, 0.1)',
    brandGlow: 'rgba(0, 240, 255, 0.4)', // Stronger glow
    tint: '#00F0FF',
    tintDim: 'rgba(0, 240, 255, 0.15)',
    tintGlow: 'rgba(0, 240, 255, 0.3)',
    outline: '#475569',
    outlineDimmer: '#334155',
    accent: '#8B5CF6',     // Electric Purple
    accentDim: 'rgba(139, 92, 246, 0.15)',
    success: '#10B981',    // Emerald
    successDim: 'rgba(16, 185, 129, 0.15)',
    error: '#EF4444',      // Red-500
    errorDim: 'rgba(239, 68, 68, 0.15)',
    warning: '#F59E0B',    // Amber
    warningDim: 'rgba(245, 158, 11, 0.15)',
    tabIconDefault: '#64748B',
    tabIconSelected: '#00F0FF',
    progressBar: '#00F0FF',
    progressBackground: '#1E293B',
    cardGradientStart: '#0F172A',
    cardGradientEnd: '#050B14',
    overlay: 'rgba(5, 11, 20, 0.95)',
  } as ThemeColors,
  /** Light mode: Clean Lab / Sci-Fi white. High contrast. */
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    logoBackground: '#F1F5F9',
    logoBorder: '#0284C7', // Sky-600
    logoIcon: '#0284C7',
    surfaceLight: '#F1F5F9',
    surfaceBorder: '#E2E8F0',
    surfaceHighest: '#CBD5E1',
    text: '#0F172A',       // Slate-900
    textSecondary: '#475569',
    textTertiary: '#64748B',
    brand: '#0284C7',      // Sky-600
    brandDim: 'rgba(2, 132, 199, 0.1)',
    brandGlow: 'rgba(2, 132, 199, 0.25)',
    tint: '#0284C7',
    tintDim: 'rgba(2, 132, 199, 0.15)',
    tintGlow: 'rgba(2, 132, 199, 0.3)',
    outline: '#94A3B8',
    outlineDimmer: '#CBD5E1',
    accent: '#7C3AED',     // Violet-600
    accentDim: 'rgba(124, 58, 237, 0.1)',
    success: '#059669',    // Emerald-600
    successDim: 'rgba(5, 150, 105, 0.1)',
    error: '#DC2626',      // Red-600
    errorDim: 'rgba(220, 38, 38, 0.1)',
    warning: '#D97706',    // Amber-600
    warningDim: 'rgba(217, 119, 6, 0.1)',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#0284C7',
    progressBar: '#0284C7',
    progressBackground: '#E2E8F0',
    cardGradientStart: '#FFFFFF',
    cardGradientEnd: '#F8FAFC',
    overlay: 'rgba(248, 250, 252, 0.95)',
  } as ThemeColors,
};

export default Colors;
