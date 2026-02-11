import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTrades, Trade, getTradeHistory, getTradeHistoryYears, getTradeHistoryTeams, TradeHistory, TradeHistoryItem } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export default function TradesScreen() {
  const { currentLeague, currentTeam, isCommissioner } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'past'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string | 'all'>('all');

  // Fetch active trades (for all/pending/past filters)
  const { data: trades, refetch: refetchTrades } = useQuery({
    queryKey: ['trades', currentLeague?.id, filter, currentTeam?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      // Pass team_id for visibility filtering
      const res = await getTrades(
        currentLeague.id,
        filter === 'all' ? undefined : filter
      );
      return res.data.data;
    },
    enabled: !!currentLeague && filter !== 'completed',
  });

  // Fetch trade history (for completed filter)
  const { data: tradeHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['trade-history', currentLeague?.id, selectedYear, selectedTeam],
    queryFn: async () => {
      if (!currentLeague) return [];
      const params: { year?: number; teamName?: string } = {};
      if (selectedYear !== 'all') params.year = selectedYear;
      if (selectedTeam !== 'all') params.teamName = selectedTeam;
      const res = await getTradeHistory(currentLeague.id, params);
      return res.data.data;
    },
    enabled: !!currentLeague && filter === 'completed',
  });

  // Fetch available years for filtering (only when completed is selected)
  const { data: years } = useQuery({
    queryKey: ['trade-history-years', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getTradeHistoryYears(currentLeague.id);
      return res.data.data;
    },
    enabled: !!currentLeague && filter === 'completed',
  });

  // Fetch team names for filtering (only when completed is selected)
  const { data: teamNames } = useQuery({
    queryKey: ['trade-history-teams', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getTradeHistoryTeams(currentLeague.id);
      return res.data.data;
    },
    enabled: !!currentLeague && filter === 'completed',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    if (filter === 'completed') {
      await refetchHistory();
    } else {
      await refetchTrades();
    }
    setRefreshing(false);
  };

  if (!currentLeague) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="swap-horizontal-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No League Connected</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'accepted': return colors.info;
      case 'completed': return colors.success;
      case 'rejected':
      case 'expired':
      case 'cancelled': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'accepted': return 'checkmark-circle-outline';
      case 'completed': return 'checkmark-done-outline';
      case 'rejected': return 'close-circle-outline';
      case 'expired': return 'hourglass-outline';
      case 'cancelled': return 'ban-outline';
      default: return 'help-outline';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTradeItem = (item: TradeHistoryItem): string => {
    if (item.type === 'player') {
      let str = item.name || 'Unknown';
      if (item.salary) str += ` ($${item.salary}`;
      if (item.yearsLeft) str += `, ${item.yearsLeft}yr`;
      if (item.salary) str += ')';
      return str;
    }
    if (item.type === 'pick') {
      return item.name || `${item.pickYear} Round ${item.pickRound}`;
    }
    if (item.type === 'cap') {
      return `$${item.capAmount} cap hit (${item.capYear})`;
    }
    return 'Unknown';
  };

  // Render trade history card (completed trades)
  const renderHistoryCard = (trade: TradeHistory) => (
    <View key={trade.id} style={styles.tradeCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.tradeNumber}>Trade #{trade.trade_number}</Text>
        <Text style={styles.tradeYear}>{trade.trade_year}</Text>
      </View>

      <View style={styles.historyContent}>
        {/* Team 1 */}
        <View style={styles.historyTeamSection}>
          <Text style={styles.historyTeamName}>{trade.team1_name}</Text>
          <Text style={styles.receivedLabel}>Received:</Text>
          {trade.team1_received?.map((item, idx) => (
            <Text key={idx} style={styles.itemText}>
              {formatTradeItem(item)}
            </Text>
          ))}
          {(!trade.team1_received || trade.team1_received.length === 0) && (
            <Text style={styles.itemText}>Nothing</Text>
          )}
        </View>

        {/* Swap Icon */}
        <View style={styles.swapIcon}>
          <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
        </View>

        {/* Team 2 */}
        <View style={styles.historyTeamSection}>
          <Text style={styles.historyTeamName}>{trade.team2_name}</Text>
          <Text style={styles.receivedLabel}>Received:</Text>
          {trade.team2_received?.map((item, idx) => (
            <Text key={idx} style={styles.itemText}>
              {formatTradeItem(item)}
            </Text>
          ))}
          {(!trade.team2_received || trade.team2_received.length === 0) && (
            <Text style={styles.itemText}>Nothing</Text>
          )}
        </View>
      </View>
    </View>
  );

  // Render active trade card (pending/all)
  const renderTradeCard = (trade: Trade) => {
    const isInvolved = trade.teams?.some(t => t.team_id === currentTeam?.id);
    const needsAction = trade.status === 'pending' && isInvolved;
    const needsCommissionerApproval = trade.status === 'accepted' &&
      trade.approval_mode === 'commissioner' && isCommissioner;

    return (
      <Link key={trade.id} href={`/trade/${trade.id}`} asChild>
        <TouchableOpacity style={needsAction ? styles.tradeCardNeedsAction : styles.tradeCard}>
          {/* Status Badge */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            alignSelf: 'flex-start',
            marginBottom: 8,
            backgroundColor: getStatusColor(trade.status)
          }}>
            <Ionicons
              name={getStatusIcon(trade.status) as any}
              size={14}
              color={colors.white}
            />
            <Text style={styles.statusText}>{trade.status}</Text>
          </View>

          {/* Teams involved */}
          <View style={styles.teamsRow}>
            {trade.teams?.map((team, idx) => (
              <View key={team.team_id} style={styles.teamChip}>
                <Text style={styles.teamChipText}>{team.team_name}</Text>
                {team.team_id === currentTeam?.id && (
                  <Ionicons name="person" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                )}
              </View>
            ))}
          </View>

          {/* Assets Preview */}
          {trade.assets && trade.assets.length > 0 && (
            <View style={styles.assetsPreview}>
              {trade.assets.slice(0, 3).map((asset: any, idx: number) => (
                <Text key={idx} style={styles.assetText}>
                  {asset.asset_type === 'contract'
                    ? `${asset.player_name} ($${asset.salary})`
                    : asset.asset_type === 'draft_pick'
                    ? 'Draft Pick'
                    : `$${asset.cap_amount} cap`}
                </Text>
              ))}
              {trade.assets.length > 3 && (
                <Text style={styles.moreAssets}>+{trade.assets.length - 3} more</Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.tradeFooter}>
            <Text style={styles.tradeDate}>
              {formatDate(trade.created_at)}
              {trade.expires_at && trade.status === 'pending' && (
                ` Expires ${formatDate(trade.expires_at)}`
              )}
            </Text>

            {needsAction && (
              <View style={styles.actionBadge}>
                <Text style={styles.actionText}>Action Needed</Text>
              </View>
            )}

            {needsCommissionerApproval && (
              <View style={styles.actionBadgeInfo}>
                <Text style={styles.actionText}>Awaiting Approval</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Link>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with New Trade button */}
      <View style={styles.header}>
        <Text style={styles.title}>Trades</Text>
        <Link href="/trade/new" asChild>
          <TouchableOpacity style={styles.newButton}>
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.newButtonText}>New Trade</Text>
          </TouchableOpacity>
        </Link>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed', 'past'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={filter === f ? styles.filterTabActive : styles.filterTab}
            onPress={() => {
              setFilter(f);
              // Reset history filters when switching to completed
              if (f === 'completed') {
                setSelectedYear('all');
                setSelectedTeam('all');
              }
            }}
          >
            <Text style={filter === f ? styles.filterTextActive : styles.filterText}>
              {f === 'past' ? 'Past' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Year Filter - only show when completed filter is selected */}
      {filter === 'completed' && years && years.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyFilterRow}>
          <TouchableOpacity
            style={selectedYear === 'all' ? styles.historyFilterChipActive : styles.historyFilterChip}
            onPress={() => setSelectedYear('all')}
          >
            <Text style={selectedYear === 'all' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
              All Years
            </Text>
          </TouchableOpacity>
          {years.map(year => (
            <TouchableOpacity
              key={year}
              style={selectedYear === year ? styles.historyFilterChipActive : styles.historyFilterChip}
              onPress={() => setSelectedYear(year)}
            >
              <Text style={selectedYear === year ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Team Filter - only show when completed filter is selected */}
      {filter === 'completed' && teamNames && teamNames.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyFilterRow}>
          <TouchableOpacity
            style={selectedTeam === 'all' ? styles.historyFilterChipActive : styles.historyFilterChip}
            onPress={() => setSelectedTeam('all')}
          >
            <Text style={selectedTeam === 'all' ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
              All Teams
            </Text>
          </TouchableOpacity>
          {teamNames.map(name => (
            <TouchableOpacity
              key={name}
              style={selectedTeam === name ? styles.historyFilterChipActive : styles.historyFilterChip}
              onPress={() => setSelectedTeam(name)}
            >
              <Text style={selectedTeam === name ? styles.historyFilterChipTextActive : styles.historyFilterChipText}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filter === 'completed' ? (
          // Render trade history
          !tradeHistory || tradeHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="swap-horizontal-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No completed trades found</Text>
            </View>
          ) : (
            tradeHistory.map(renderHistoryCard)
          )
        ) : filter === 'past' ? (
          // Render past trades (rejected/cancelled/vetoed)
          !trades || trades.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="close-circle-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No rejected or cancelled trades this season</Text>
            </View>
          ) : (
            trades.map(renderTradeCard)
          )
        ) : (
          // Render active trades
          !trades || trades.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No trades found</Text>
            </View>
          ) : (
            trades.map(renderTradeCard)
          )
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
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
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  newButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  filterTabActive: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: colors.white,
    fontWeight: '500',
  },
  // History filter styles
  historyFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 50,
  },
  historyFilterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    marginRight: spacing.sm,
  },
  historyFilterChipActive: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.secondary,
    marginRight: spacing.sm,
  },
  historyFilterChipText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  historyFilterChipTextActive: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  tradeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeCardNeedsAction: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  statusText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  teamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  teamChipText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  assetsPreview: {
    marginBottom: spacing.sm,
  },
  assetText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  moreAssets: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tradeDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  actionBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  actionBadgeInfo: {
    backgroundColor: colors.info,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  actionText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.white,
  },
  // Trade history styles
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeNumber: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  tradeYear: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  historyContent: {
    flexDirection: 'row',
  },
  historyTeamSection: {
    flex: 1,
  },
  historyTeamName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  receivedLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemText: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  swapIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
