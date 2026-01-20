import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors } from '@/lib/theme';
import { getContract, releasePlayer, applyFranchiseTag } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentTeam } = useAppStore();

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const res = await getContract(id);
      return res.data.data;
    },
    enabled: !!id,
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
      `Are you sure you want to release ${contract?.player_name}?\n\nDead cap hit: $${deadCap.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Release', style: 'destructive', onPress: () => releaseMutation.mutate() },
      ]
    );
  };

  const handleFranchiseTag = () => {
    Alert.alert(
      'Apply Franchise Tag',
      `Are you sure you want to franchise tag ${contract?.player_name}?\n\nThis will cost ${contract?.franchise_tag_salary || '?'}/year and counts as your 1 tag for this season.`,
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
  const currentYear = 2025;
  const contractSalary = Number(contract.salary) || 0;
  const salarySchedule = [];
  for (let i = 0; i < contract.years_remaining; i++) {
    salarySchedule.push({
      year: currentYear + i,
      salary: contractSalary, // Simplified - in real app might differ per year
    });
  }

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
        <Text style={styles.playerName}>{contract.player_name}</Text>
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Original Length</Text>
            <Text style={styles.detailValue}>{contract.original_years} years</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: contract.is_active ? colors.success : colors.error }}>
              {contract.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Dead Cap Hit</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.error }}>
              ${(Number(contract.dead_cap_if_released) || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cap Savings</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: colors.success }}>
              ${(contractSalary - (Number(contract.dead_cap_if_released) || 0)).toFixed(2)}
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
});
