import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTrades, Trade } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export default function TradesScreen() {
  const { currentLeague, currentTeam, isCommissioner } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const { data: trades, refetch } = useQuery({
    queryKey: ['trades', currentLeague?.id, filter],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getTrades(currentLeague.id, filter === 'all' ? undefined : filter);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
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
        {(['all', 'pending', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={filter === f ? styles.filterTabActive : styles.filterTab}
            onPress={() => setFilter(f)}
          >
            <Text style={filter === f ? styles.filterTextActive : styles.filterText}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {trades?.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No trades found</Text>
          </View>
        ) : (
          trades?.map((trade) => {
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
                      {trade.assets.slice(0, 3).map((asset, idx) => (
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
                        ` • Expires ${formatDate(trade.expires_at)}`
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
          })
        )}
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
});
