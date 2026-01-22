import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueHistory, getLeague } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type SortField = 'legacy_score' | 'titles' | 'net_winnings' | 'win_percentage' | 'total_wins';

export default function LeagueHistoryScreen() {
  const { leagueId: paramLeagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { currentLeagueId } = useAppStore();
  const leagueId = paramLeagueId || currentLeagueId;

  const [sortField, setSortField] = useState<SortField>('legacy_score');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const res = await getLeague(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const { data: history, isLoading } = useQuery({
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
        return b.titles - a.titles || b.legacy_score - a.legacy_score;
      case 'net_winnings':
        return b.net_winnings - a.net_winnings;
      case 'win_percentage':
        return b.win_percentage - a.win_percentage;
      case 'total_wins':
        return b.total_wins - a.total_wins;
      default:
        return b.legacy_score - a.legacy_score;
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading history...</Text>
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
                {(owner.win_percentage * 100).toFixed(0)}%
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
              <Text style={styles.legacyText}>{owner.legacy_score.toFixed(0)}</Text>
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
                  <Text style={styles.statValue}>{owner.total_points.toFixed(0)}</Text>
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
                      <Text style={styles.seasonPoints}>{season.points?.toFixed(0) || '-'} pts</Text>
                      <View style={styles.seasonBadges}>
                        {season.title && <Ionicons name="trophy" size={14} color={colors.warning} />}
                        {season.division && <Ionicons name="ribbon" size={14} color={colors.primary} />}
                        {season.playoffs && !season.title && <Text style={styles.playoffBadge}>P</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      ))}

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
});
