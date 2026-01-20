export const colors = {
  // Primary brand colors
  primary: '#4F46E5', // Indigo
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',

  // Background colors
  background: '#0F172A', // Dark blue
  backgroundSecondary: '#1E293B',
  surface: '#334155',
  surfaceLight: '#475569',

  // Text colors
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Status colors
  success: '#10B981',
  successDark: '#059669',
  warning: '#F59E0B',
  warningDark: '#D97706',
  error: '#EF4444',
  errorDark: '#DC2626',
  info: '#3B82F6',

  // Position colors
  qb: '#EF4444', // Red
  rb: '#10B981', // Green
  wr: '#3B82F6', // Blue
  te: '#F59E0B', // Amber

  // Cap status colors
  capHealthy: '#10B981',
  capWarning: '#F59E0B',
  capCritical: '#EF4444',

  // Border
  border: '#334155',
  borderLight: '#475569',

  // White/Black
  white: '#FFFFFF',
  black: '#000000',
  
  // Additional
  secondary: '#6366F1', // Indigo secondary
};

// Position colors map for easy access
export const positionColors: Record<string, string> = {
  QB: colors.qb,
  RB: colors.rb,
  WR: colors.wr,
  TE: colors.te,
  K: colors.textSecondary,
  DEF: colors.textSecondary,
};

export const getPositionColor = (position: string): string => {
  switch (position?.toUpperCase()) {
    case 'QB': return colors.qb;
    case 'RB': return colors.rb;
    case 'WR': return colors.wr;
    case 'TE': return colors.te;
    default: return colors.textSecondary;
  }
};

export const getCapStatusColor = (capRoom: number, salaryCap: number): string => {
  const percentage = (capRoom / salaryCap) * 100;
  if (percentage > 15) return colors.capHealthy;
  if (percentage > 5) return colors.capWarning;
  return colors.capCritical;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
