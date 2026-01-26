import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, Platform, Pressable } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueBuyIns, getBuyInSeasons, updateBuyIn, initializeBuyIns } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerBuyInsScreen() {
  const { currentLeague } = useAppStore();
  const leagueId = currentLeague?.id;
  const queryClient = useQueryClient();

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBuyIn, setEditingBuyIn] = useState<any | null>(null);
  const [editAmountDue, setEditAmountDue] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [showInitModal, setShowInitModal] = useState(false);
  const [initAmountDue, setInitAmountDue] = useState('100');

  const { data: seasons, refetch: refetchSeasons } = useQuery({
    queryKey: ['buyInSeasons', leagueId],
    queryFn: async () => {
      const res = await getBuyInSeasons(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const effectiveSeason = selectedSeason || currentLeague?.current_season || 2025;

  const { data: buyInsData, isLoading, refetch: refetchBuyIns } = useQuery({
    queryKey: ['buyIns', leagueId, effectiveSeason],
    queryFn: async () => {
      const res = await getLeagueBuyIns(leagueId!, effectiveSeason);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBuyIns(), refetchSeasons()]);
    setRefreshing(false);
  }, [refetchBuyIns, refetchSeasons]);

  const initializeMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(initAmountDue) || 100;
      return initializeBuyIns(leagueId!, effectiveSeason, amount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyIns', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['buyInSeasons', leagueId] });
      setShowInitModal(false);
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

    let status = 'unpaid';
    if (amountPaid >= amountDue && amountDue > 0) {
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

  const handleMarkAllPaid = () => {
    const unpaidBuyIns = buyIns.filter(b => b.status !== 'paid');
    if (unpaidBuyIns.length === 0) {
      if (Platform.OS === 'web') {
        (globalThis as any).alert('All buy-ins are already paid!');
      } else {
        Alert.alert('Info', 'All buy-ins are already paid!');
      }
      return;
    }

    const confirmAction = () => {
      unpaidBuyIns.forEach(buyIn => {
        updateMutation.mutate({
          buyInId: buyIn.id,
          data: {
            amount_paid: buyIn.amount_due,
            status: 'paid',
            paid_date: new Date().toISOString(),
          },
        });
      });
    };

    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm(`Mark ${unpaidBuyIns.length} buy-ins as fully paid?`)) {
        confirmAction();
      }
    } else {
      Alert.alert(
        'Confirm',
        `Mark ${unpaidBuyIns.length} buy-ins as fully paid?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark All Paid', onPress: confirmAction },
        ]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'partial': return colors.warning;
      case 'unpaid': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'partial': return 'time';
      case 'unpaid': return 'close-circle';
      default: return 'help-circle';
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
          <Text style={styles.title}>Manage Buy-Ins</Text>
          <Text style={styles.subtitle}>{currentLeague?.name}</Text>
        </View>
        <Ionicons name="cash" size={28} color="#10B981" />
      </View>

      {/* Season Selector */}
      <View style={styles.seasonSection}>
        <Text style={styles.sectionLabel}>Season</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seasonSelectorContent}
        >
          {(seasons && seasons.length > 0 ? seasons : [effectiveSeason]).map((season) => (
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
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowInitModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.actionButtonText}>Initialize Season</Text>
        </TouchableOpacity>

        {buyIns.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSuccess]}
            onPress={handleMarkAllPaid}
          >
            <Ionicons name="checkmark-done-outline" size={20} color={colors.success} />
            <Text style={[styles.actionButtonText, { color: colors.success }]}>Mark All Paid</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Card */}
      {totals && buyIns.length > 0 && (
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

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totals.total_due > 0 ? (totals.total_paid / totals.total_due) * 100 : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {totals.total_due > 0 ? ((totals.total_paid / totals.total_due) * 100).toFixed(0) : 0}% Collected
            </Text>
          </View>
        </View>
      )}

      {/* Buy-in List */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Team Buy-Ins</Text>

        {buyIns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No buy-in records for {effectiveSeason}</Text>
            <Text style={styles.emptySubtext}>
              Click "Initialize Season" to create buy-in records for all teams
            </Text>
          </View>
        ) : (
          buyIns.map((buyIn) => {
            const progressPercent = buyIn.amount_due > 0
              ? Math.min((buyIn.amount_paid / buyIn.amount_due) * 100, 100)
              : 0;

            return (
              <TouchableOpacity
                key={buyIn.id}
                style={styles.buyInCard}
                onPress={() => handleEditBuyIn(buyIn)}
              >
                <View style={styles.buyInHeader}>
                  <View style={styles.buyInInfo}>
                    <Text style={styles.ownerName}>{buyIn.owner_name}</Text>
                    {buyIn.team_name && (
                      <Text style={styles.teamName}>{buyIn.team_name}</Text>
                    )}
                  </View>
                  <View style={styles.headerActions}>
                    <TouchableOpacity
                      style={styles.editIcon}
                      onPress={() => handleEditBuyIn(buyIn)}
                    >
                      <Ionicons name="pencil" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(buyIn.status) + '20' }]}>
                      <Ionicons name={getStatusIcon(buyIn.status)} size={14} color={getStatusColor(buyIn.status)} />
                      <Text style={[styles.statusText, { color: getStatusColor(buyIn.status) }]}>
                        {buyIn.status.charAt(0).toUpperCase() + buyIn.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress Bar */}
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

                <Text style={styles.tapHint}>Tap to edit</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 50 }} />

      {/* Initialize Modal */}
      <Modal
        visible={showInitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInitModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowInitModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Initialize Buy-Ins</Text>
              <TouchableOpacity onPress={() => setShowInitModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              This will create buy-in records for all teams in the {effectiveSeason} season.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Default Amount Due ($)</Text>
              <TextInput
                style={styles.input}
                value={initAmountDue}
                onChangeText={setInitAmountDue}
                keyboardType="numeric"
                placeholder="Enter default buy-in amount"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.inputHint}>
                You can adjust individual amounts after initialization
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowInitModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => initializeMutation.mutate()}
                disabled={initializeMutation.isPending}
              >
                <Text style={styles.saveButtonText}>
                  {initializeMutation.isPending ? 'Creating...' : 'Create Buy-Ins'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={!!editingBuyIn}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingBuyIn(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditingBuyIn(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
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

                {/* Quick actions */}
                <View style={styles.quickActions}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => setEditAmountPaid(editAmountDue)}
                  >
                    <Text style={styles.quickActionText}>Mark Fully Paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => setEditAmountPaid('0')}
                  >
                    <Text style={styles.quickActionText}>Mark Unpaid</Text>
                  </TouchableOpacity>
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
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
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
  seasonSection: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  seasonSelectorContent: {
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
  actionsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  actionButtonSuccess: {
    borderColor: colors.success,
  },
  actionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  summaryCard: {
    margin: spacing.md,
    marginTop: 0,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editIcon: {
    padding: spacing.xs,
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
  tapHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
  modalDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
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
