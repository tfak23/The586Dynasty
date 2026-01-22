import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useAppStore } from '@/lib/store';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
}

const commissionerTools: ToolItem[] = [
  {
    id: 'roster',
    title: 'Manage Rosters',
    description: 'Add or drop players from any team',
    icon: 'people-outline',
    route: '/commissioner/roster',
    color: colors.primary,
  },
  {
    id: 'cap',
    title: 'Cap Adjustments',
    description: 'Adjust cap space for any team',
    icon: 'calculator-outline',
    route: '/commissioner/cap',
    color: colors.success,
  },
  {
    id: 'trade',
    title: 'Force Trade',
    description: 'Create trades between any teams',
    icon: 'swap-horizontal-outline',
    route: '/commissioner/trade',
    color: colors.warning,
  },
  {
    id: 'teams',
    title: 'Manage Teams',
    description: 'Edit team names and owners',
    icon: 'business-outline',
    route: '/commissioner/teams',
    color: colors.secondary,
  },
  {
    id: 'history',
    title: 'Trade History',
    description: 'Edit or add trade history entries',
    icon: 'time-outline',
    route: '/commissioner/history',
    color: '#8B5CF6',
  },
  {
    id: 'rules',
    title: 'Edit Rules',
    description: 'Update league rules and settings',
    icon: 'document-text-outline',
    route: '/commissioner/rules',
    color: colors.error,
  },
];

export default function CommissionerScreen() {
  const { currentLeague, currentTeam, settings } = useAppStore();

  // Check if current team is commissioner
  const isCommissioner = currentTeam && settings.commissionerTeamIds?.includes(currentTeam.id);

  if (!isCommissioner) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="shield-outline" size={64} color={colors.textMuted} />
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorText}>
          You must be a commissioner to access these tools.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Commissioner Tools</Text>
          <Text style={styles.subtitle}>{currentLeague?.name}</Text>
        </View>
        <Ionicons name="shield-checkmark" size={28} color={colors.warning} />
      </View>

      {/* Warning Banner */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning-outline" size={20} color={colors.warning} />
        <Text style={styles.warningText}>
          Changes made here affect the entire league and cannot be easily undone.
        </Text>
      </View>

      {/* Tools Grid */}
      <View style={styles.toolsGrid}>
        {commissionerTools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={styles.toolCard}
            onPress={() => router.push(tool.route as any)}
          >
            <View style={[styles.toolIconContainer, { backgroundColor: tool.color + '20' }]}>
              <Ionicons name={tool.icon} size={28} color={tool.color} />
            </View>
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.toolDescription}>{tool.description}</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
              style={styles.toolArrow}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  backButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.warning,
  },
  toolsGrid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  toolCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    position: 'relative',
  },
  toolIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toolTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  toolDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingRight: spacing.xl,
  },
  toolArrow: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
  },
});
