import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, Platform } from 'react-native';
import { useState, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueBuyIns, getBuyInSeasons, getLeague, updateBuyIn, initializeBuyIns } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function BuyInsScreen() {
  const { leagueId: paramLeagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { currentLeague } = useAppStore();
  const leagueId = paramLeagueId || currentLeague?.id;
  const queryClient = useQueryClient();

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBuyIn, setEditingBuyIn] = useState<any | null>(null);
  const [editAmountDue, setEditAmountDue] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const { currentTeam } = useAppStore();

  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const res = await getLeague(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const { data: seasons } = useQuery({
    queryKey: ['buyInSeasons', leagueId],
    queryFn: async () => {
      const res = await getBuyInSeasons(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const effectiveSeason = selectedSeason || league?.current_season || 2026;

  const { data: buyInsData, isLoading } = useQuery({
    queryKey: ['buyIns', leagueId, effectiveSeason],
    queryFn: async () => {
      const res = await getLeagueBuyIns(leagueId!, effectiveSeason);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['buyIns', leagueId] });
    setRefreshing(false);
  }, [queryClient, leagueId]);

  // Check if current user is commissioner (using settings.commissionerTeamIds)
  const { settings } = useAppStore();
  const isCommissioner = currentTeam && settings.commissionerTeamIds?.includes(currentTeam.id);

  const initializeMutation = useMutation({
    mutationFn: async () => {
      return initializeBuyIns(leagueId!, effectiveSeason, 100); // Default $100 buy-in
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyIns', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['buyInSeasons', leagueId] });
      if (Platform.OS === 'web') {
        (globalThis as any).alert('Buy-ins initialized for ' + effectiveSeason + ' season');
      } else {
        Alert.alert('Success', 'Buy-ins initialized for ' + effectiveSeason + ' season');
      }
    },
    onError: (error: any) => {
      if (Platform.OS === 'web') {
        (globalThis as any).alert(error.message || 'Failed to initialize buy-ins');
      } else {
        Alert.alert('Error', error.message || 'Failed to initialize buy-ins');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ buyInId, data }: { buyInId: string; data: any }) => {
      return updateBuyIn(leagueId!, buyInId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyIns', leagueId] });
      setEditingBuyIn(null);
      if (Platform.OS === 'web') {
        (globalThis as any).alert('Buy-in updated successfully');
      } else {
        Alert.alert('Success', 'Buy-in updated successfully');
      }
    },
    onError: (error: any) => {
      if (Platform.OS === 'web') {
        (globalThis as any).alert(error.message || 'Failed to update buy-in');
      } else {
        Alert.alert('Error', error.message || 'Failed to update buy-in');
      }
    },
  });

  const handleEditBuyIn = (buyIn: any) => {
    setEditingBuyIn(buyIn);
    setEditAmountDue(String(buyIn.amount_due));
    setEditAmountPaid(String(buyIn.amount_paid));
  };

  const handleSaveBuyIn = () => {
    if (!editingBuyIn) return;

    const amountDue = parseFloat(editAmountDue) || 0;
    const amountPaid = parseFloat(editAmountPaid) || 0;

    // Determine status based on amounts
    let status = 'unpaid';
    if (amountPaid >= amountDue) {
      status = 'paid';
    } else if (amountPaid > 0) {
      status = 'partial';
    }

    updateMutation.mutate({
      buyInId: editingBuyIn.id,
      data: {
        amount_due: amountDue,
        amount_paid: amountPaid,
        status,
        paid_date: amountPaid > 0 ? new Date().toISOString() : null,
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return colors.success;
      case 'partial':
        return colors.warning;
      case 'unpaid':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'paid':
        return 'checkmark-circle';
      case 'partial':
        return 'time';
      case 'unpaid':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading buy-ins...</Text>
      </View>
    );
  }

  const totals = buyInsData?.totals;
  const buyIns = buyInsData?.buy_ins || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Buy-In Tracker</Text>
          <Text style={styles.subtitle}>{league?.name || 'The 586 Dynasty'}</Text>
        </View>
      </View>

      {/* Season Selector */}
      {seasons && seasons.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.seasonSelector}
          contentContainerStyle={styles.seasonSelectorContent}
        >
          {seasons.map((season) => (
            <TouchableOpacity
              key={season}
              style={[
                styles.seasonChip,
                effectiveSeason === season && styles.seasonChipActive,
              ]}
              onPress={() => setSelectedSeason(season)}
            >
              <Text
                style={[
                  styles.seasonChipText,
                  effectiveSeason === season && styles.seasonChipTextActive,
                ]}
              >
                {season}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary Card */}
      {totals && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Due</Text>
              <Text style={styles.summaryValue}>${totals.total_due}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Collected</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                ${totals.total_paid}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                ${totals.total_due - totals.total_paid}
              </Text>
            </View>
          </View>

          {/* Status counts */}
          <View style={styles.statusCounts}>
            <View style={styles.statusCount}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.statusCountText}>{totals.paid_count} Paid</Text>
            </View>
            <View style={styles.statusCount}>
              <Ionicons name="time" size={16} color={colors.warning} />
              <Text style={styles.statusCountText}>{totals.partial_count} Partial</Text>
            </View>
            <View style={styles.statusCount}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <Text style={styles.statusCountText}>{totals.unpaid_count} Unpaid</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(totals.total_paid / totals.total_due) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {((totals.total_paid / totals.total_due) * 100).toFixed(0)}% Collected
            </Text>
          </View>
        </View>
      )}

      {/* Buy-in List */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Payment Status</Text>

        {buyIns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No buy-in records for this season</Text>
            <Text style={styles.emptySubtext}>
              Commissioner can initialize buy-ins for this season
            </Text>
            {isCommissioner && (
              <TouchableOpacity
                style={styles.initializeButton}
                onPress={() => initializeMutation.mutate()}
                disabled={initializeMutation.isPending}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                <Text style={styles.initializeButtonText}>
                  {initializeMutation.isPending ? 'Initializing...' : `Initialize ${effectiveSeason} Buy-Ins`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          buyIns.map((buyIn) => {
            const progressPercent = buyIn.amount_due > 0
              ? Math.min((buyIn.amount_paid / buyIn.amount_due) * 100, 100)
              : 0;

            return (
              <View key={buyIn.id} style={styles.buyInCard}>
                <View style={styles.buyInHeader}>
                  <View style={styles.buyInInfo}>
                    <Text style={styles.ownerName}>{buyIn.owner_name}</Text>
                    {buyIn.team_name && (
                      <Text style={styles.teamName}>{buyIn.team_name}</Text>
                    )}
                  </View>
                  <View style={styles.headerActions}>
                    {isCommissioner && (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditBuyIn(buyIn)}
                      >
                        <Ionicons name="pencil" size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(buyIn.status) + '20' }]}>
                      <Ionicons name={getStatusIcon(buyIn.status)} size={14} color={getStatusColor(buyIn.status)} />
                      <Text style={[styles.statusText, { color: getStatusColor(buyIn.status) }]}>
                        {buyIn.status.charAt(0).toUpperCase() + buyIn.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Individual Progress Bar */}
                <View style={styles.individualProgress}>
                  <View style={styles.individualProgressBar}>
                    <View
                      style={[
                        styles.individualProgressFill,
                        {
                          width: `${progressPercent}%`,
                          backgroundColor: getStatusColor(buyIn.status),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.individualProgressText}>
                    {progressPercent.toFixed(0)}%
                  </Text>
                </View>

                <View style={styles.buyInDetails}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Due</Text>
                    <Text style={styles.amountValue}>${buyIn.amount_due}</Text>
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Paid</Text>
                    <Text style={[styles.amountValue, buyIn.amount_paid > 0 && { color: colors.success }]}>
                      ${buyIn.amount_paid}
                    </Text>
                  </View>
                  {buyIn.amount_due - buyIn.amount_paid > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Remaining</Text>
                      <Text style={[styles.amountValue, { color: colors.error }]}>
                        ${buyIn.amount_due - buyIn.amount_paid}
                      </Text>
                    </View>
                  )}
                </View>

                {buyIn.paid_date && (
                  <Text style={styles.paidDate}>
                    Paid on {new Date(buyIn.paid_date).toLocaleDateString()}
                    {buyIn.payment_method && ` via ${buyIn.payment_method}`}
                  </Text>
                )}

                {buyIn.notes && (
                  <Text style={styles.notes}>{buyIn.notes}</Text>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 50 }} />

      {/* Edit Buy-In Modal */}
      <Modal
        visible={!!editingBuyIn}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingBuyIn(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditingBuyIn(null)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Buy-In</Text>
              <TouchableOpacity onPress={() => setEditingBuyIn(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {editingBuyIn && (
              <>
                <Text style={styles.modalSubtitle}>{editingBuyIn.owner_name}</Text>
                {editingBuyIn.team_name && (
                  <Text style={styles.modalTeamName}>{editingBuyIn.team_name}</Text>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount Due ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editAmountDue}
                    onChangeText={setEditAmountDue}
                    keyboardType="numeric"
                    placeholder="Enter amount due"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount Paid ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={editAmountPaid}
                    onChangeText={setEditAmountPaid}
                    keyboardType="numeric"
                    placeholder="Enter amount paid"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setEditingBuyIn(null)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveBuyIn}
                    disabled={updateMutation.isPending}
                  >
                    <Text style={styles.saveButtonText}>
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  seasonSelector: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  seasonSelectorContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  seasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  seasonChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  seasonChipText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  seasonChipTextActive: {
    color: colors.white,
  },
  summaryCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
  },
  statusCounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  statusCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusCountText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  progressContainer: {
    gap: spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  listSection: {
    padding: spacing.md,
  },
  listTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  initializeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  initializeButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  buyInCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  buyInHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  buyInInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  teamName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  buyInDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  amountRow: {
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  amountValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  paidDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  notes: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editButton: {
    padding: spacing.xs,
  },
  individualProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  individualProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  individualProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  individualProgressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    width: 35,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalTeamName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
});
