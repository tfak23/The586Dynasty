import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface TradeItem {
  type: 'player' | 'pick' | 'cap';
  name?: string;
  salary?: number;
  yearsLeft?: number;
  capAmount?: number;
  capYear?: number;
  pickYear?: number;
  pickRound?: number;
  originalOwner?: string;
}

interface TradeHistory {
  id: string;
  trade_number: string;
  trade_year: number;
  team1_name: string;
  team1_full_name?: string;
  team1_received: TradeItem[];
  team2_name: string;
  team2_full_name?: string;
  team2_received: TradeItem[];
}

export default function TradeHistoryScreen() {
  const { currentLeague, setCurrentLeague, setTeams } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string | 'all'>('all');

  // First, fetch the league if not available
  const { data: leagueData, isLoading: leagueLoading } = useQuery({
    queryKey: ['leagues-for-history'],
    queryFn: async () => {
      const res = await api.get('/api/leagues');
      return res.data.data;
    },
    staleTime: Infinity, // Don't refetch
  });

  // Set league in store when fetched
  useEffect(() => {
    if (leagueData && leagueData.length > 0 && !currentLeague) {
      setCurrentLeague(leagueData[0]);
    }
  }, [leagueData, currentLeague, setCurrentLeague]);

  // Use leagueId from store or from fetched data
  const leagueId = currentLeague?.id || (leagueData && leagueData.length > 0 ? leagueData[0].id : null);

  // Fetch trade history
  const { data: trades, refetch, isLoading: tradesLoading } = useQuery({
    queryKey: ['trade-history', leagueId, selectedYear, selectedTeam],
    queryFn: async () => {
      if (!leagueId) return [];
      const params = new URLSearchParams();
      if (selectedYear !== 'all') params.append('year', selectedYear.toString());
      if (selectedTeam !== 'all') params.append('teamName', selectedTeam);
      
      const res = await api.get(`/api/trade-history/league/${leagueId}?${params}`);
      return res.data.data as TradeHistory[];
    },
    enabled: !!leagueId,
  });

  // Fetch available years
  const { data: years } = useQuery({
    queryKey: ['trade-history-years', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      const res = await api.get(`/api/trade-history/league/${leagueId}/years`);
      return res.data.data as number[];
    },
    enabled: !!leagueId,
  });

  // Fetch all unique team names from trades (for filtering)
  const { data: teamNames } = useQuery({
    queryKey: ['trade-history-teams', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      const res = await api.get(`/api/trade-history/league/${leagueId}/teams`);
      return res.data.data as string[];
    },
    enabled: !!leagueId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatTradeItem = (item: TradeItem): string => {
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

  // Show loading while fetching league
  if (leagueLoading || (!leagueId && !leagueData)) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.emptyTitle}>Loading...</Text>
      </View>
    );
  }

  // Show error if no league found
  if (!leagueId) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No League Found</Text>
        <Text style={styles.emptySubtitle}>Go to Settings to connect a league</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trade History</Text>
        <Text style={styles.subtitle}>
          {tradesLoading ? 'Loading...' : `${trades?.length || 0} trades`}
        </Text>
      </View>

      {/* Year Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={selectedYear === 'all' ? styles.filterChipActive : styles.filterChip}
          onPress={() => setSelectedYear('all')}
        >
          <Text style={selectedYear === 'all' ? styles.filterChipTextActive : styles.filterChipText}>
            All Years
          </Text>
        </TouchableOpacity>
        {years?.map(year => (
          <TouchableOpacity
            key={year}
            style={selectedYear === year ? styles.filterChipActive : styles.filterChip}
            onPress={() => setSelectedYear(year)}
          >
            <Text style={selectedYear === year ? styles.filterChipTextActive : styles.filterChipText}>
              {year}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Team Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          style={selectedTeam === 'all' ? styles.filterChipActive : styles.filterChip}
          onPress={() => setSelectedTeam('all')}
        >
          <Text style={selectedTeam === 'all' ? styles.filterChipTextActive : styles.filterChipText}>
            All Teams
          </Text>
        </TouchableOpacity>
        {teamNames?.map(name => (
          <TouchableOpacity
            key={name}
            style={selectedTeam === name ? styles.filterChipActive : styles.filterChip}
            onPress={() => setSelectedTeam(name)}
          >
            <Text style={selectedTeam === name ? styles.filterChipTextActive : styles.filterChipText}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {!trades || trades.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="swap-horizontal-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyStateText}>No trades found</Text>
          </View>
        ) : (
          trades.map((trade) => (
            <View key={trade.id} style={styles.tradeCard}>
              <View style={styles.tradeHeader}>
                <Text style={styles.tradeNumber}>Trade #{trade.trade_number}</Text>
                <Text style={styles.tradeYear}>{trade.trade_year}</Text>
              </View>

              <View style={styles.tradeContent}>
                {/* Team 1 */}
                <View style={styles.teamSection}>
                  <Text style={styles.teamName}>{trade.team1_name}</Text>
                  <Text style={styles.receivedLabel}>Received:</Text>
                  {trade.team1_received?.map((item, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      • {formatTradeItem(item)}
                    </Text>
                  ))}
                  {(!trade.team1_received || trade.team1_received.length === 0) && (
                    <Text style={styles.itemText}>• Nothing</Text>
                  )}
                </View>

                {/* Swap Icon */}
                <View style={styles.swapIcon}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
                </View>

                {/* Team 2 */}
                <View style={styles.teamSection}>
                  <Text style={styles.teamName}>{trade.team2_name}</Text>
                  <Text style={styles.receivedLabel}>Received:</Text>
                  {trade.team2_received?.map((item, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      • {formatTradeItem(item)}
                    </Text>
                  ))}
                  {(!trade.team2_received || trade.team2_received.length === 0) && (
                    <Text style={styles.itemText}>• Nothing</Text>
                  )}
                </View>
              </View>
            </View>
          ))
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
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 56,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    padding: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  tradeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceHover,
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
  tradeContent: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  teamSection: {
    flex: 1,
  },
  teamName: {
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
