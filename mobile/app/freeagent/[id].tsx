import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors, getPositionColor } from '@/lib/theme';
import { getPlayer, getPlayerEstimate, createContract, getTeamCap } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE';

export default function FreeAgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentLeague, currentTeam } = useAppStore();

  const [showSignModal, setShowSignModal] = useState(false);
  const [salary, setSalary] = useState('');
  const [years, setYears] = useState(1);

  // Get player info
  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: async () => {
      const res = await getPlayer(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  // Get contract estimate with comparables
  const { data: estimateData, isLoading: estimateLoading } = useQuery({
    queryKey: ['playerEstimate', id, currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague?.id) return null;
      const res = await getPlayerEstimate(id, currentLeague.id);
      return res.data.data;
    },
    enabled: !!id && !!currentLeague?.id,
  });

  // Get team cap room
  const { data: capData } = useQuery({
    queryKey: ['teamCap', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam?.id) return null;
      const res = await getTeamCap(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam?.id,
  });

  // Sign player mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague?.id || !currentTeam?.id) {
        throw new Error('No league or team selected');
      }
      const salaryNum = parseFloat(salary);
      if (isNaN(salaryNum) || salaryNum < 1) {
        throw new Error('Invalid salary amount');
      }
      return createContract({
        league_id: currentLeague.id,
        team_id: currentTeam.id,
        player_id: id,
        salary: salaryNum,
        years_total: years,
        years_remaining: years,
        start_season: currentLeague.current_season,
        end_season: currentLeague.current_season + years - 1,
        contract_type: 'free_agent',
        status: 'active',
      });
    },
    onSuccess: () => {
      Alert.alert('Success', `${player?.full_name} has been signed!`);
      setShowSignModal(false);
      queryClient.invalidateQueries();
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to sign player');
    },
  });

  const handleOpenSignModal = () => {
    // Pre-fill with estimated salary
    if (estimateData?.estimate?.estimated_salary) {
      setSalary(estimateData.estimate.estimated_salary.toString());
    }
    setYears(1);
    setShowSignModal(true);
  };

  const handleSign = () => {
    const salaryNum = parseFloat(salary);
    if (isNaN(salaryNum) || salaryNum < 1) {
      Alert.alert('Error', 'Please enter a valid salary (minimum $1)');
      return;
    }

    // Check cap room (parse as number since PostgreSQL returns string)
    const capRoom = parseFloat(String(capData?.cap_room || 0));
    if (capData && salaryNum > capRoom) {
      Alert.alert(
        'Cap Warning',
        `This contract ($${salaryNum}) exceeds your available cap room ($${capRoom.toFixed(2)}). Proceed anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Anyway', style: 'destructive', onPress: () => signMutation.mutate() },
        ]
      );
      return;
    }

    signMutation.mutate();
  };

  const isLoading = playerLoading || estimateLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading player details...</Text>
      </View>
    );
  }

  if (!player) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Player not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const estimate = estimateData?.estimate;
  const comparables = estimate?.comparable_players || [];
  const previousSalary = estimateData?.previous_salary;
  const posColor = getPositionColor(player.position);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Free Agent</Text>
        </View>

        {/* Player Card */}
        <View style={styles.playerCard}>
          <View style={[styles.positionBadge, { backgroundColor: posColor }]}>
            <Text style={styles.positionText}>{player.position}</Text>
          </View>
          <Text style={styles.playerName}>{player.full_name}</Text>
          <Text style={styles.playerTeam}>
            {player.team || 'Free Agent'}
            {player.age ? ` • ${player.age} years old` : ''}
          </Text>
        </View>

        {/* Previous Contract */}
        {previousSalary && previousSalary > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Previous Contract</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Salary</Text>
                <Text style={styles.infoValue}>${previousSalary}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Contract Estimate */}
        {estimate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contract Estimate</Text>
            <View style={styles.estimateCard}>
              <View style={styles.estimateMain}>
                <Text style={styles.estimateLabel}>Suggested Salary</Text>
                <Text style={styles.estimateValue}>${estimate.estimated_salary}</Text>
              </View>

              <View style={styles.estimateRange}>
                <Text style={styles.rangeText}>
                  Range: ${estimate.salary_range.min} - ${estimate.salary_range.max}
                </Text>
                <View style={[
                  styles.confidenceBadge,
                  estimate.confidence === 'high' && styles.confidenceHigh,
                  estimate.confidence === 'medium' && styles.confidenceMedium,
                  estimate.confidence === 'low' && styles.confidenceLow,
                ]}>
                  <Text style={styles.confidenceText}>
                    {estimate.confidence.charAt(0).toUpperCase() + estimate.confidence.slice(1)} Confidence
                  </Text>
                </View>
              </View>

              {estimate.reasoning && (
                <View style={styles.reasoningBox}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.reasoningText}>{estimate.reasoning}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Comparable Players */}
        {comparables.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comparable Contracts</Text>
            <View style={styles.infoCard}>
              {comparables.map((comp: any, index: number) => (
                <View key={comp.player_id || index} style={styles.comparableRow}>
                  <View style={styles.comparableInfo}>
                    <Text style={styles.comparableName}>{comp.full_name}</Text>
                    <Text style={styles.comparableStats}>
                      {comp.ppg ? parseFloat(String(comp.ppg)).toFixed(1) : '?'} PPG • {comp.games_played || 0} games
                    </Text>
                  </View>
                  <View style={styles.comparableSalary}>
                    <Text style={styles.comparableSalaryValue}>${comp.salary}</Text>
                    <Text style={styles.comparableYears}>{comp.years_remaining}yr left</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Team Cap Info */}
        {capData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Cap Situation</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Available Cap Room</Text>
                <Text style={[
                  styles.infoValue,
                  { color: parseFloat(String(capData.cap_room)) > 0 ? colors.success : colors.error }
                ]}>
                  ${parseFloat(String(capData.cap_room)).toFixed(2)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Current Roster</Text>
                <Text style={styles.infoValue}>{capData.active_contracts} players</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sign Button */}
      {currentTeam && (
        <View style={styles.signButtonContainer}>
          <TouchableOpacity
            style={styles.signButton}
            onPress={handleOpenSignModal}
          >
            <Ionicons name="create-outline" size={20} color={colors.white} />
            <Text style={styles.signButtonText}>Sign {player.full_name}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sign Modal */}
      <Modal
        visible={showSignModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sign {player.full_name}</Text>
              <TouchableOpacity onPress={() => setShowSignModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Salary Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Annual Salary</Text>
              <View style={styles.salaryInputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.salaryInput}
                  value={salary}
                  onChangeText={setSalary}
                  keyboardType="numeric"
                  placeholder="Enter salary"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              {estimate && (
                <Text style={styles.inputHint}>
                  Suggested: ${estimate.estimated_salary} (${estimate.salary_range.min}-${estimate.salary_range.max})
                </Text>
              )}
            </View>

            {/* Years Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contract Length</Text>
              <View style={styles.yearsSelector}>
                {[1, 2, 3, 4, 5].map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[styles.yearOption, years === y && styles.yearOptionSelected]}
                    onPress={() => setYears(y)}
                  >
                    <Text style={[styles.yearText, years === y && styles.yearTextSelected]}>
                      {y} yr{y > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contract Summary */}
            <View style={styles.contractSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Value</Text>
                <Text style={styles.summaryValue}>
                  ${(parseFloat(salary) || 0) * years}
                </Text>
              </View>
              {capData && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cap After Signing</Text>
                  <Text style={[
                    styles.summaryValue,
                    { color: parseFloat(String(capData.cap_room)) - (parseFloat(salary) || 0) >= 0 ? colors.success : colors.error }
                  ]}>
                    ${(parseFloat(String(capData.cap_room)) - (parseFloat(salary) || 0)).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* Sign Button */}
            <TouchableOpacity
              style={signMutation.isPending ? styles.confirmButtonDisabled : styles.confirmButton}
              onPress={handleSign}
              disabled={signMutation.isPending}
            >
              {signMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              )}
              <Text style={styles.confirmButtonText}>
                {signMutation.isPending ? 'Signing...' : 'Confirm Signing'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
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
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.surface,
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
    paddingHorizontal: spacing.lg,
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
    textAlign: 'center',
  },
  playerTeam: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
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
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  estimateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  estimateMain: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  estimateLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  estimateValue: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: colors.success,
  },
  estimateRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rangeText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  confidenceHigh: {
    backgroundColor: colors.success + '30',
  },
  confidenceMedium: {
    backgroundColor: colors.warning + '30',
  },
  confidenceLow: {
    backgroundColor: colors.error + '30',
  },
  confidenceText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.text,
  },
  reasoningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  reasoningText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
    flex: 1,
  },
  comparableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  comparableInfo: {
    flex: 1,
  },
  comparableName: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  comparableStats: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  comparableSalary: {
    alignItems: 'flex-end',
  },
  comparableSalaryValue: {
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.primary,
  },
  comparableYears: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  signButtonContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  signButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  salaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dollarSign: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.textSecondary,
    paddingLeft: spacing.md,
  },
  salaryInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  inputHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  yearsSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  yearOption: {
    flex: 1,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yearText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yearTextSelected: {
    color: colors.white,
  },
  contractSummary: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.text,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  confirmButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    opacity: 0.6,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
