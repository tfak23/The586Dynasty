import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors } from '@/lib/theme';
import { getContract, releasePlayer, applyFranchiseTag, getContractEvaluation, ContractRating } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

// Rating badge colors
const RATING_COLORS: Record<ContractRating, { bg: string; text: string }> = {
  LEGENDARY: { bg: '#FFD700', text: '#1a1a2e' },  // Gold
  CORNERSTONE: { bg: '#06B6D4', text: '#ffffff' }, // Cyan/Teal
  STEAL: { bg: '#22C55E', text: '#ffffff' },      // Green
  GOOD: { bg: '#3B82F6', text: '#ffffff' },       // Blue
  BUST: { bg: '#EF4444', text: '#ffffff' },       // Red
  ROOKIE: { bg: '#8B5CF6', text: '#ffffff' },     // Purple
};

const RATING_ICONS: Record<ContractRating, string> = {
  LEGENDARY: 'trophy',
  CORNERSTONE: 'diamond',
  STEAL: 'trending-up',
  GOOD: 'checkmark-circle',
  BUST: 'trending-down',
  ROOKIE: 'star-outline',
};

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentTeam, currentLeague } = useAppStore();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const res = await getContract(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  // Fetch contract evaluation
  const { data: evaluation, isLoading: evaluationLoading } = useQuery({
    queryKey: ['contractEvaluation', id, currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague?.id) return null;
      const res = await getContractEvaluation(id, currentLeague.id);
      return res.data.data;
    },
    enabled: !!id && !!currentLeague?.id,
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      return releasePlayer(id);
    },
    onSuccess: () => {
      Alert.alert('Released', 'Player has been released.');
      queryClient.invalidateQueries();
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to release player');
    },
  });

  const franchiseTagMutation = useMutation({
    mutationFn: async () => {
      return applyFranchiseTag(id);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Franchise tag applied!');
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to apply franchise tag');
    },
  });

  const handleRelease = () => {
    const deadCap = Number(contract?.dead_cap_if_released) || 0;
    Alert.alert(
      'Release Player',
      `Are you sure you want to release ${contract?.full_name}?\n\nDead cap hit: $${deadCap.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release', style: 'destructive', onPress: () => releaseMutation.mutate() },
      ]
    );
  };

  const handleFranchiseTag = () => {
    Alert.alert(
      'Apply Franchise Tag',
      `Are you sure you want to franchise tag ${contract?.full_name}?\n\nThis will cost ${contract?.franchise_tag_salary || '?'}/year and counts as your 1 tag for this season.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply Tag', onPress: () => franchiseTagMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading contract...</Text>
      </View>
    );
  }

  if (!contract) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Contract not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMyPlayer = currentTeam?.id === contract.team_id;
  const position = contract.position as Position;
  const posColor = positionColors[position] || colors.textMuted;

  // Build salary schedule
  const currentYear = 2026;
  const contractSalary = Number(contract.salary) || 0;
  const salarySchedule = [];
  for (let i = 0; i < contract.years_remaining; i++) {
    salarySchedule.push({
      year: currentYear + i,
      salary: contractSalary,
    });
  }

  // Dead cap percentages based on years remaining
  // The percentages apply to EACH remaining year of the contract
  const DEAD_CAP_BY_YEARS_REMAINING: Record<number, number[]> = {
    5: [0.75, 0.50, 0.25, 0.10, 0.10],  // Year 1, Year 2, Year 3, Year 4, Year 5
    4: [0.75, 0.50, 0.25, 0.10],
    3: [0.50, 0.25, 0.10],
    2: [0.50, 0.25],
    1: [0.50],
  };

  // Calculate dead cap schedule for each remaining year
  const yearsRemaining = contract.years_remaining || 1;
  const deadCapSchedule: { year: number; percentage: number; amount: number }[] = [];
  let totalDeadCap = 0;

  if (contractSalary <= 1) {
    // $1 contracts retain full cap hit each year
    for (let i = 0; i < yearsRemaining; i++) {
      deadCapSchedule.push({
        year: currentYear + i,
        percentage: 100,
        amount: contractSalary,
      });
      totalDeadCap += contractSalary;
    }
  } else {
    const percentages = DEAD_CAP_BY_YEARS_REMAINING[yearsRemaining] || [0.50];
    for (let i = 0; i < yearsRemaining; i++) {
      const percentage = percentages[i] || 0;
      const deadCapAmount = Math.ceil(contractSalary * percentage);
      deadCapSchedule.push({
        year: currentYear + i,
        percentage: percentage * 100,
        amount: deadCapAmount,
      });
      totalDeadCap += deadCapAmount;
    }
  }

  const totalContractValue = contractSalary * yearsRemaining;
  const totalCapSavings = totalContractValue - totalDeadCap;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contract Details</Text>
      </View>

      {/* Player Info */}
      <View style={styles.playerCard}>
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, marginBottom: spacing.sm, backgroundColor: posColor }}>
          <Text style={styles.positionText}>{contract.position}</Text>
        </View>
        <Text style={styles.playerName}>{contract.full_name}</Text>
        <Text style={styles.teamName}>{contract.team_name}</Text>

        {contract.is_franchise_tagged && (
          <View style={styles.tagBadge}>
            <Ionicons name="pricetag" size={14} color={colors.white} />
            <Text style={styles.tagText}>Franchise Tagged</Text>
          </View>
        )}
      </View>

      {/* Contract Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contract Terms</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Annual Salary</Text>
            <Text style={styles.detailValue}>${contractSalary.toFixed(2)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Years Remaining</Text>
            <Text style={styles.detailValue}>{contract.years_remaining}</Text>
          </View>
        </View>
      </View>

      {/* Contract Evaluation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contract Evaluation</Text>
        {evaluationLoading ? (
          <View style={styles.evaluationLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.evaluationLoadingText}>Analyzing contract...</Text>
          </View>
        ) : evaluation ? (
          <View style={styles.evaluationCard}>
            {/* Rating Badge */}
            <View style={[
              styles.ratingBadge,
              { backgroundColor: RATING_COLORS[evaluation.rating].bg }
            ]}>
              <Ionicons
                name={RATING_ICONS[evaluation.rating] as any}
                size={24}
                color={RATING_COLORS[evaluation.rating].text}
              />
              <Text style={[
                styles.ratingText,
                { color: RATING_COLORS[evaluation.rating].text }
              ]}>
                {evaluation.rating}
              </Text>
              {evaluation.rating === 'LEGENDARY' && evaluation.league_rank && (
                <Text style={[
                  styles.ratingRank,
                  { color: RATING_COLORS[evaluation.rating].text }
                ]}>
                  #{evaluation.league_rank} Best Contract
                </Text>
              )}
            </View>

            {/* Value Comparison */}
            <View style={styles.valueComparison}>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Market Value</Text>
                <Text style={styles.marketValue}>${evaluation.estimated_salary}</Text>
              </View>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Your Salary</Text>
                <Text style={styles.yourSalary}>${evaluation.actual_salary}</Text>
              </View>
              <View style={styles.valueDiffRow}>
                {Math.abs(evaluation.value_score) < 5 ? (
                  <>
                    <Text style={styles.valueLabel}>Contract Value</Text>
                    <Text style={[styles.valueDiff, { color: colors.primary }]}>
                      Fair Market Value
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.valueLabel}>
                      {evaluation.salary_difference >= 0 ? 'You\'re Saving' : 'Overpaying By'}
                    </Text>
                    <Text style={[
                      styles.valueDiff,
                      { color: evaluation.salary_difference >= 0 ? colors.success : colors.error }
                    ]}>
                      ${Math.abs(evaluation.salary_difference).toFixed(0)}/year
                      ({Math.abs(evaluation.value_score)}%)
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Player Stats */}
            {evaluation.player_stats && (
              <View style={styles.statsRow}>
                <Ionicons name="stats-chart" size={14} color={colors.primary} />
                <Text style={styles.statsText}>
                  {evaluation.player_stats.ppg.toFixed(1)} PPG in {evaluation.player_stats.games_played} games
                </Text>
              </View>
            )}

            {/* Reasoning */}
            <View style={styles.reasoningBox}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.reasoningText}>{evaluation.reasoning}</Text>
            </View>

            {/* Comparable Contracts */}
            {evaluation.comparable_contracts && evaluation.comparable_contracts.length > 0 && (
              <View style={styles.comparablesSection}>
                <Text style={styles.comparablesTitle}>Similar Contracts</Text>
                {evaluation.comparable_contracts.slice(0, 3).map((comp: any, index: number) => (
                  <View key={comp.player_id || index} style={styles.comparableRow}>
                    <View style={styles.comparableInfo}>
                      <Text style={styles.comparableName}>{comp.full_name}</Text>
                      <Text style={styles.comparableStats}>
                        {comp.ppg ? parseFloat(String(comp.ppg)).toFixed(1) : '?'} PPG
                      </Text>
                    </View>
                    <Text style={styles.comparableSalary}>${comp.salary}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.evaluationCard}>
            <Text style={styles.noEvaluationText}>
              Unable to evaluate contract. Stats may not be synced yet.
            </Text>
          </View>
        )}
      </View>

      {/* Salary Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salary Schedule</Text>
        <View style={styles.detailCard}>
          {salarySchedule.map((item, index) => (
            <View 
              key={item.year} 
              style={index === 0 ? styles.scheduleRowCurrent : styles.scheduleRow}
            >
              <Text style={styles.scheduleYear}>{item.year}</Text>
              <Text style={styles.scheduleSalary}>${item.salary.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Dead Cap Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>If Released</Text>
        <View style={styles.detailCard}>
          <Text style={styles.deadCapHeader}>Dead Cap Schedule</Text>

          {deadCapSchedule.map((item) => (
            <View key={item.year} style={styles.deadCapRow}>
              <Text style={styles.deadCapYear}>{item.year}</Text>
              <Text style={styles.deadCapPercent}>{item.percentage}%</Text>
              <Text style={styles.deadCapAmount}>${item.amount}</Text>
            </View>
          ))}

          <View style={styles.deadCapTotalRow}>
            <Text style={styles.deadCapTotalLabel}>Total Dead Cap</Text>
            <Text style={styles.deadCapTotalValue}>${totalDeadCap}</Text>
          </View>

          {contractSalary <= 1 && (
            <View style={styles.deadCapExplanation}>
              <Text style={styles.explanationText}>
                $1 contracts retain full cap hit each year
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cap Savings</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.success }}>
              ${totalCapSavings}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {isMyPlayer && (
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {!contract.is_franchise_tagged && contract.can_franchise_tag && (
            <TouchableOpacity 
              style={styles.tagButton}
              onPress={handleFranchiseTag}
              disabled={franchiseTagMutation.isPending}
            >
              <Ionicons name="pricetag" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>
                {franchiseTagMutation.isPending ? 'Applying...' : 'Apply Franchise Tag'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.releaseButton}
            onPress={handleRelease}
            disabled={releaseMutation.isPending}
          >
            <Ionicons name="close-circle" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>
              {releaseMutation.isPending ? 'Releasing...' : 'Release Player'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backBtnText: {
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
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  playerCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
  },
  positionBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  positionText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  playerName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  teamName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  tagText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  deadCapHeader: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  deadCapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  deadCapYear: {
    fontSize: fontSize.base,
    color: colors.text,
    flex: 1,
  },
  deadCapPercent: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
  deadCapAmount: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.error,
    flex: 1,
    textAlign: 'right',
  },
  deadCapTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deadCapTotalLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  deadCapTotalValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.error,
  },
  deadCapExplanation: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.sm,
  },
  explanationText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleRowCurrent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primary + '20',
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  scheduleYear: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: '600',
  },
  scheduleSalary: {
    fontSize: fontSize.base,
    color: colors.primary,
    fontWeight: 'bold',
  },
  actionsSection: {
    padding: spacing.md,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.warning,
  },
  releaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  // Evaluation styles
  evaluationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  evaluationLoadingText: {
    marginLeft: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  evaluationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  ratingText: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  ratingRank: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  valueComparison: {
    marginBottom: spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  valueLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  marketValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  yourSalary: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.primary,
  },
  valueDiffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  valueDiff: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statsText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  reasoningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  reasoningText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  comparablesSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  comparablesTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  comparableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  comparableInfo: {
    flex: 1,
  },
  comparableName: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  comparableStats: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  comparableSalary: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  noEvaluationText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    textAlign: 'center',
    padding: spacing.md,
  },
});
