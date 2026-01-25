import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueHistory, getLeague, api, updateLeagueHistory, syncLeagueHistorySeason, LeagueHistoryRecord } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type SortField = 'legacy_score' | 'titles' | 'net_winnings' | 'win_percentage' | 'total_wins';

// Edit Modal Component
function EditOwnerModal({
  owner,
  onClose,
  onSave,
  isLoading,
}: {
  owner: LeagueHistoryRecord | null;
  onClose: () => void;
  onSave: (updates: Partial<LeagueHistoryRecord>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<LeagueHistoryRecord>>({});

  useEffect(() => {
    if (owner) {
      setFormData({
        titles: owner.titles,
        sb_appearances: owner.sb_appearances,
        division_titles: owner.division_titles,
        playoff_appearances: owner.playoff_appearances,
        total_winnings: owner.total_winnings,
        total_buy_ins: owner.total_buy_ins,
        is_active: owner.is_active,
      });
    }
  }, [owner]);

  if (!owner) return null;

  const handleChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <Modal visible={!!owner} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Edit {owner.owner_name}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.form}>
            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>Titles</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.titles || 0)}
                onChangeText={(v) => handleChange('titles', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>SB Appearances</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.sb_appearances || 0)}
                onChangeText={(v) => handleChange('sb_appearances', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>Division Titles</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.division_titles || 0)}
                onChangeText={(v) => handleChange('division_titles', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>Playoff Appearances</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.playoff_appearances || 0)}
                onChangeText={(v) => handleChange('playoff_appearances', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>Total Winnings ($)</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.total_winnings || 0)}
                onChangeText={(v) => handleChange('total_winnings', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={modalStyles.row}>
              <Text style={modalStyles.label}>Total Buy-Ins ($)</Text>
              <TextInput
                style={modalStyles.input}
                value={String(formData.total_buy_ins || 0)}
                onChangeText={(v) => handleChange('total_buy_ins', v)}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <TouchableOpacity
              style={modalStyles.toggleRow}
              onPress={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
            >
              <Text style={modalStyles.label}>Active Owner</Text>
              <View style={[modalStyles.toggle, formData.is_active && modalStyles.toggleActive]}>
                {formData.is_active && <Ionicons name="checkmark" size={16} color={colors.text} />}
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelButton} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.saveButton, isLoading && modalStyles.saveButtonDisabled]}
              onPress={() => onSave(formData)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={modalStyles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function LeagueHistoryScreen() {
  const { leagueId: paramLeagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { currentLeague, setCurrentLeague, isCommissioner } = useAppStore();
  const queryClient = useQueryClient();
  
  // Fetch leagues if we don't have one
  const { data: leagueData } = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const res = await api.get('/api/leagues');
      return res.data.data;
    },
    enabled: !currentLeague,
  });

  // Set league in store when fetched
  useEffect(() => {
    if (leagueData && leagueData.length > 0 && !currentLeague) {
      setCurrentLeague(leagueData[0]);
    }
  }, [leagueData, currentLeague, setCurrentLeague]);

  const leagueId = paramLeagueId || currentLeague?.id;

  const [sortField, setSortField] = useState<SortField>('legacy_score');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<LeagueHistoryRecord | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const res = await getLeague(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const { data: history, isLoading, refetch } = useQuery({
    queryKey: ['leagueHistory', leagueId, showActiveOnly],
    queryFn: async () => {
      const res = await getLeagueHistory(leagueId!, showActiveOnly);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const sortedHistory = [...(history || [])].sort((a, b) => {
    switch (sortField) {
      case 'titles':
        return Number(b.titles) - Number(a.titles) || Number(b.legacy_score) - Number(a.legacy_score);
      case 'net_winnings':
        return Number(b.net_winnings) - Number(a.net_winnings);
      case 'win_percentage':
        return Number(b.win_percentage) - Number(a.win_percentage);
      case 'total_wins':
        return Number(b.total_wins) - Number(a.total_wins);
      default:
        return Number(b.legacy_score) - Number(a.legacy_score);
    }
  });

  const formatRecord = (wins: number, losses: number, ties: number) => {
    if (ties > 0) {
      return `${wins}-${losses}-${ties}`;
    }
    return `${wins}-${losses}`;
  };

  const formatMoney = (amount: number) => {
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toFixed(0)}`;
  };

  // Sync from Sleeper API
  const handleSyncFromSleeper = async () => {
    if (!leagueId) return;
    setIsSyncing(true);
    try {
      const res = await syncLeagueHistorySeason(leagueId);
      Alert.alert('Sync Complete', `Updated ${res.data.data.updated.length} owners for season ${res.data.data.season}`);
      refetch();
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Failed to sync from Sleeper');
    } finally {
      setIsSyncing(false);
    }
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { historyId: string; updates: Partial<LeagueHistoryRecord> }) => {
      const res = await updateLeagueHistory(leagueId!, data.historyId, data.updates);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagueHistory'] });
      setEditingOwner(null);
      Alert.alert('Success', 'Owner history updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update');
    },
  });

  // Show loading if we're still getting league data or history
  if (isLoading || (!leagueId && !leagueData)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  // Show error if no league found
  if (!leagueId) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={styles.loadingText}>No league found</Text>
        <Text style={[styles.loadingText, { fontSize: 14, color: colors.textMuted }]}>
          Go to Settings to connect a league
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>League History</Text>
          <Text style={styles.subtitle}>{league?.name || 'The 586 Dynasty'}</Text>
        </View>
        {/* Sync Button - Commissioner only */}
        {isCommissioner && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncFromSleeper}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Ionicons name="sync" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Filter & Sort */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.filterButton, showActiveOnly && styles.filterButtonActive]}
          onPress={() => setShowActiveOnly(!showActiveOnly)}
        >
          <Text style={[styles.filterButtonText, showActiveOnly && styles.filterButtonTextActive]}>
            {showActiveOnly ? 'Active Only' : 'All Owners'}
          </Text>
        </TouchableOpacity>
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'legacy_score', label: 'Legacy' },
              { key: 'titles', label: 'Titles' },
              { key: 'net_winnings', label: 'Net $' },
              { key: 'win_percentage', label: 'Win %' },
              { key: 'total_wins', label: 'Wins' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[styles.sortOption, sortField === option.key && styles.sortOptionActive]}
                onPress={() => setSortField(option.key as SortField)}
              >
                <Text style={[styles.sortOptionText, sortField === option.key && styles.sortOptionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Stats Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Owner</Text>
        <Text style={styles.tableHeaderCell}>Titles</Text>
        <Text style={styles.tableHeaderCell}>Record</Text>
        <Text style={styles.tableHeaderCell}>Net</Text>
        <Text style={styles.tableHeaderCell}>Legacy</Text>
      </View>

      {/* Owner Rows */}
      {sortedHistory.map((owner, index) => (
        <View key={owner.id}>
          <TouchableOpacity
            style={[
              styles.ownerRow,
              !owner.is_active && styles.ownerRowInactive,
            ]}
            onPress={() => setExpandedOwner(expandedOwner === owner.id ? null : owner.id)}
          >
            <View style={[styles.ownerCell, { flex: 2 }]}>
              <Text style={styles.rankBadge}>#{index + 1}</Text>
              <View>
                <Text style={[styles.ownerName, !owner.is_active && styles.ownerNameInactive]}>
                  {owner.owner_name}
                </Text>
                {owner.current_team_name && (
                  <Text style={styles.teamName}>{owner.current_team_name}</Text>
                )}
              </View>
            </View>
            <View style={styles.ownerCell}>
              {owner.titles > 0 ? (
                <View style={styles.titlesContainer}>
                  <Text style={styles.titlesText}>{owner.titles}</Text>
                  <Ionicons name="trophy" size={12} color={colors.warning} />
                </View>
              ) : (
                <Text style={styles.zeroText}>0</Text>
              )}
            </View>
            <View style={styles.ownerCell}>
              <Text style={styles.recordText}>
                {formatRecord(owner.total_wins, owner.total_losses, owner.total_ties)}
              </Text>
              <Text style={styles.winPctText}>
                {(Number(owner.win_percentage) * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.ownerCell}>
              <Text style={[
                styles.netText,
                owner.net_winnings > 0 && styles.netPositive,
                owner.net_winnings < 0 && styles.netNegative,
              ]}>
                {formatMoney(owner.net_winnings)}
              </Text>
            </View>
            <View style={styles.ownerCell}>
              <Text style={styles.legacyText}>{Number(owner.legacy_score).toFixed(0)}</Text>
            </View>
          </TouchableOpacity>

          {/* Expanded Details */}
          {expandedOwner === owner.id && (
            <View style={styles.expandedContent}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>SB Appearances</Text>
                  <Text style={styles.statValue}>{owner.sb_appearances}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Division Titles</Text>
                  <Text style={styles.statValue}>{owner.division_titles}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Playoffs</Text>
                  <Text style={styles.statValue}>{owner.playoff_appearances}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Points</Text>
                  <Text style={styles.statValue}>{Number(owner.total_points).toFixed(0)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Winnings</Text>
                  <Text style={[styles.statValue, styles.netPositive]}>${owner.total_winnings}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Buy-Ins</Text>
                  <Text style={styles.statValue}>${owner.total_buy_ins}</Text>
                </View>
              </View>

              {/* Season-by-Season (if available) */}
              {owner.season_records && owner.season_records.length > 0 && (
                <View style={styles.seasonSection}>
                  <Text style={styles.seasonSectionTitle}>Season History</Text>
                  {owner.season_records.map((season: any, idx: number) => (
                    <View key={idx} style={styles.seasonRow}>
                      <Text style={styles.seasonYear}>{season.season}</Text>
                      <Text style={styles.seasonRecord}>
                        {formatRecord(season.wins, season.losses, season.ties || 0)}
                      </Text>
                      <Text style={styles.seasonPoints}>{season.points ? Number(season.points).toFixed(0) : '-'} pts</Text>
                      <View style={styles.seasonBadges}>
                        {season.title && <Ionicons name="trophy" size={14} color={colors.warning} />}
                        {season.division && <Ionicons name="ribbon" size={14} color={colors.primary} />}
                        {season.playoffs && !season.title && <Text style={styles.playoffBadge}>P</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Commissioner Edit Button */}
              {isCommissioner && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setEditingOwner(owner)}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={styles.editButtonText}>Edit History</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      {/* Edit Modal */}
      <EditOwnerModal
        owner={editingOwner}
        onClose={() => setEditingOwner(null)}
        onSave={(updates) => {
          if (editingOwner) {
            updateMutation.mutate({ historyId: editingOwner.id, updates });
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legacy Score Calculation</Text>
        <Text style={styles.legendText}>
          Titles (100pts) + SB Apps (50pts) + Div Titles (25pts) + Playoffs (10pts) + Win% bonus
        </Text>
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
  controls: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  sortOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  sortOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ownerRowInactive: {
    opacity: 0.6,
  },
  ownerCell: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  rankBadge: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginRight: spacing.sm,
    width: 24,
  },
  ownerName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  ownerNameInactive: {
    color: colors.textMuted,
  },
  teamName: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  titlesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  titlesText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.warning,
  },
  zeroText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  recordText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },
  winPctText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  netText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
  },
  netPositive: {
    color: colors.success,
  },
  netNegative: {
    color: colors.error,
  },
  legacyText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  expandedContent: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  seasonSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  seasonSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  seasonYear: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    width: 50,
  },
  seasonRecord: {
    fontSize: fontSize.sm,
    color: colors.text,
    width: 50,
  },
  seasonPoints: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    flex: 1,
  },
  seasonBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  playoffBadge: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  legend: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  legendTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 18,
  },
  syncButton: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  editButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  form: {
    padding: spacing.md,
  },
  row: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
  },
});
