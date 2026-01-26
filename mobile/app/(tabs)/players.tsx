import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getFreeAgents, getSignedPlayers, ContractRating, SignedPlayerContract } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useDebouncedValue } from '@/lib/hooks';

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE'] as const;
type Position = typeof POSITIONS[number];

type PlayerMode = 'signed' | 'freeagents';
type RatingFilter = 'ALL' | 'LEGENDARY' | 'CORNERSTONE' | 'STEAL' | 'GOOD' | 'BUST' | 'ROOKIE';
type SortBy = 'salary' | 'value';

// Rating badge colors
const RATING_COLORS: Record<ContractRating, { bg: string; text: string }> = {
  LEGENDARY: { bg: '#FFD700', text: '#1a1a2e' },
  CORNERSTONE: { bg: '#06B6D4', text: '#ffffff' },
  STEAL: { bg: '#22C55E', text: '#ffffff' },
  GOOD: { bg: '#3B82F6', text: '#ffffff' },
  BUST: { bg: '#EF4444', text: '#ffffff' },
  ROOKIE: { bg: '#8B5CF6', text: '#ffffff' },
};

const RATING_ICONS: Record<ContractRating, keyof typeof Ionicons.glyphMap> = {
  LEGENDARY: 'trophy',
  CORNERSTONE: 'diamond',
  STEAL: 'trending-up',
  GOOD: 'checkmark-circle',
  BUST: 'trending-down',
  ROOKIE: 'star-outline',
};

interface FreeAgent {
  id: string;
  full_name: string;
  position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;
  previous_salary: number | null;
  previous_owner: string | null;
  stats?: {
    games_played: number;
    total_points: number;
    ppg: number;
  };
  estimated_salary?: number;
}

export default function PlayersScreen() {
  const router = useRouter();
  const { currentLeague } = useAppStore();
  const [playerMode, setPlayerMode] = useState<PlayerMode>('signed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<Position>('All');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('salary');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Fetch free agents
  const { data: freeAgents, isLoading: freeAgentsLoading, refetch: refetchFreeAgents, isRefetching: isRefetchingFreeAgents } = useQuery({
    queryKey: ['freeAgents', currentLeague?.id, selectedPosition, debouncedSearch],
    queryFn: async () => {
      if (!currentLeague?.id) return [];
      const params: { position?: string; search?: string; season?: number } = {
        season: 2025,
      };
      if (selectedPosition !== 'All') {
        params.position = selectedPosition;
      }
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      const res = await getFreeAgents(currentLeague.id, params);
      return res.data.data as FreeAgent[];
    },
    enabled: !!currentLeague?.id && playerMode === 'freeagents',
  });

  // Fetch signed players with evaluations
  const { data: signedPlayers, isLoading: signedPlayersLoading, refetch: refetchSignedPlayers, isRefetching: isRefetchingSignedPlayers } = useQuery({
    queryKey: ['signedPlayers', currentLeague?.id, selectedPosition],
    queryFn: async () => {
      if (!currentLeague?.id) return [];
      const params: { position?: string } = {};
      if (selectedPosition !== 'All') {
        params.position = selectedPosition;
      }
      const res = await getSignedPlayers(currentLeague.id, params);
      return res.data.data;
    },
    enabled: !!currentLeague?.id && playerMode === 'signed',
  });

  const handleRefresh = useCallback(() => {
    if (playerMode === 'signed') {
      refetchSignedPlayers();
    } else {
      refetchFreeAgents();
    }
  }, [playerMode, refetchSignedPlayers, refetchFreeAgents]);

  const handlePlayerPress = (player: FreeAgent | SignedPlayerContract) => {
    if (playerMode === 'freeagents') {
      router.push(`/freeagent/${player.id}`);
    } else {
      router.push(`/contract/${(player as SignedPlayerContract).id}`);
    }
  };

  const getPositionColor = (position: string | undefined) => {
    switch (position) {
      case 'QB': return colors.positionQB;
      case 'RB': return colors.positionRB;
      case 'WR': return colors.positionWR;
      case 'TE': return colors.positionTE;
      default: return colors.textMuted;
    }
  };

  // Filter and sort signed players
  const filteredSignedPlayers = useMemo(() => {
    let result = signedPlayers || [];

    // Filter by rating
    if (ratingFilter !== 'ALL') {
      result = result.filter(p => p.evaluation?.rating === ratingFilter);
    }

    // Filter by search
    if (debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(p => p.full_name?.toLowerCase().includes(searchLower));
    }

    // Sort
    if (sortBy === 'value') {
      result = [...result].sort((a, b) => {
        const aValue = a.evaluation?.value_score ?? -999;
        const bValue = b.evaluation?.value_score ?? -999;
        return bValue - aValue; // Higher value score first
      });
    } else {
      result = [...result].sort((a, b) => {
        const aSalary = parseFloat(String(a.salary)) || 0;
        const bSalary = parseFloat(String(b.salary)) || 0;
        return bSalary - aSalary; // Higher salary first
      });
    }

    return result;
  }, [signedPlayers, ratingFilter, debouncedSearch, sortBy]);

  const filteredFreeAgents = useMemo(() => {
    return freeAgents || [];
  }, [freeAgents]);

  const isLoading = playerMode === 'signed' ? signedPlayersLoading : freeAgentsLoading;
  const isRefetching = playerMode === 'signed' ? isRefetchingSignedPlayers : isRefetchingFreeAgents;
  const players = playerMode === 'signed' ? filteredSignedPlayers : filteredFreeAgents;

  if (!currentLeague) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>No league connected</Text>
        <Text style={styles.emptySubtext}>Go to Settings to connect your Sleeper league</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Players</Text>
        {players.length > 0 && (
          <Text style={styles.playerCount}>{players.length} players</Text>
        )}
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggleContainer}>
        <TouchableOpacity
          style={[styles.modeButton, playerMode === 'signed' && styles.modeButtonActive]}
          onPress={() => setPlayerMode('signed')}
        >
          <Ionicons
            name="document-text"
            size={16}
            color={playerMode === 'signed' ? colors.white : colors.textSecondary}
          />
          <Text style={[styles.modeButtonText, playerMode === 'signed' && styles.modeButtonTextActive]}>
            Signed Players
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, playerMode === 'freeagents' && styles.modeButtonActive]}
          onPress={() => setPlayerMode('freeagents')}
        >
          <Ionicons
            name="person-add"
            size={16}
            color={playerMode === 'freeagents' ? colors.white : colors.textSecondary}
          />
          <Text style={[styles.modeButtonText, playerMode === 'freeagents' && styles.modeButtonTextActive]}>
            Free Agents
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Position Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {POSITIONS.map((position) => (
            <TouchableOpacity
              key={position}
              style={[
                styles.filterChip,
                selectedPosition === position && styles.filterChipActive,
              ]}
              onPress={() => setSelectedPosition(position)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedPosition === position && styles.filterChipTextActive,
                ]}
              >
                {position}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Rating Filter & Sort Options (Signed Players only) */}
      {playerMode === 'signed' && (
        <>
          {/* Sort Options */}
          <View style={styles.sortContainer}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'salary' && styles.sortButtonActive]}
              onPress={() => setSortBy('salary')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'salary' && styles.sortButtonTextActive]}>
                Salary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'value' && styles.sortButtonActive]}
              onPress={() => setSortBy('value')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'value' && styles.sortButtonTextActive]}>
                Value
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rating Filter */}
          <View style={styles.ratingFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.ratingChip, ratingFilter === 'ALL' && styles.ratingChipActive]}
                onPress={() => setRatingFilter('ALL')}
              >
                <Text style={[styles.ratingChipText, ratingFilter === 'ALL' && styles.ratingChipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {(['LEGENDARY', 'CORNERSTONE', 'STEAL', 'GOOD', 'BUST', 'ROOKIE'] as const).map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={[
                    styles.ratingChip,
                    ratingFilter === rating && { backgroundColor: RATING_COLORS[rating].bg },
                  ]}
                  onPress={() => setRatingFilter(rating)}
                >
                  <Ionicons
                    name={RATING_ICONS[rating]}
                    size={14}
                    color={ratingFilter === rating ? RATING_COLORS[rating].text : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.ratingChipText,
                      ratingFilter === rating && { color: RATING_COLORS[rating].text },
                    ]}
                  >
                    {rating}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      {/* Player List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            Loading {playerMode === 'signed' ? 'signed players' : 'free agents'}...
          </Text>
        </View>
      ) : players.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No players found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? 'Try a different search term' :
             playerMode === 'signed' ? 'No contracts match the selected filters' : 'All players are under contract'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {playerMode === 'signed' ? (
            // Signed Players Cards
            (players as SignedPlayerContract[]).map((player) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerCard}
                onPress={() => handlePlayerPress(player)}
              >
                <View style={styles.playerHeader}>
                  <View style={[styles.positionBadge, { backgroundColor: getPositionColor(player.position) }]}>
                    <Text style={styles.positionText}>{player.position}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.full_name}</Text>
                    <Text style={styles.playerTeam}>
                      {player.team_name} • {player.nfl_team || 'FA'}
                    </Text>
                  </View>
                  {player.evaluation && (
                    <View style={[styles.ratingBadge, { backgroundColor: RATING_COLORS[player.evaluation.rating as ContractRating].bg }]}>
                      <Ionicons
                        name={RATING_ICONS[player.evaluation.rating as ContractRating]}
                        size={12}
                        color={RATING_COLORS[player.evaluation.rating as ContractRating].text}
                      />
                      <Text style={[styles.ratingBadgeText, { color: RATING_COLORS[player.evaluation.rating as ContractRating].text }]}>
                        {player.evaluation.rating}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.playerDetails}>
                  <View style={styles.detailItem}>
                    <Text style={styles.salaryAmount}>${parseFloat(String(player.salary)).toFixed(0)}/yr</Text>
                    <Text style={styles.contractYears}>{player.years_remaining}yr left</Text>
                  </View>
                  {player.evaluation && player.evaluation.value_score !== null && player.evaluation.value_score !== undefined && (
                    <View style={styles.detailItem}>
                      {Math.abs(player.evaluation.value_score) < 5 ? (
                        <>
                          <Text style={[styles.valueScore, { color: colors.primary }]}>Fair</Text>
                          <Text style={styles.valueLabel}>value</Text>
                        </>
                      ) : (
                        <>
                          <Text style={[
                            styles.valueScore,
                            { color: player.evaluation.value_score >= 0 ? colors.success : colors.error }
                          ]}>
                            {player.evaluation.value_score > 0 ? '+' : ''}{player.evaluation.value_score}%
                          </Text>
                          <Text style={styles.valueLabel}>value</Text>
                        </>
                      )}
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            // Free Agents Cards
            (players as FreeAgent[]).map((player) => (
              <TouchableOpacity
                key={player.id}
                style={styles.playerCard}
                onPress={() => handlePlayerPress(player)}
              >
                <View style={styles.playerHeader}>
                  <View style={[styles.positionBadge, { backgroundColor: getPositionColor(player.position) }]}>
                    <Text style={styles.positionText}>{player.position}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.full_name}</Text>
                    <Text style={styles.playerTeam}>
                      {player.team || 'Free Agent'} {player.age ? `• ${player.age} yo` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>

                <View style={styles.freeAgentDetails}>
                  {player.previous_salary && player.previous_salary > 0 ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        Prev: ${player.previous_salary}
                        {player.previous_owner ? ` (${player.previous_owner})` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {player.estimated_salary && player.estimated_salary > 0 ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="calculator-outline" size={14} color={colors.success} />
                      <Text style={[styles.detailText, styles.estimateText]}>
                        Est. Value: ${player.estimated_salary}
                      </Text>
                    </View>
                  ) : null}

                  {player.stats && player.stats.games_played > 0 ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="stats-chart" size={14} color={colors.primary} />
                      <Text style={styles.detailText}>
                        2025: {player.stats.total_points.toFixed(1)} pts ({player.stats.ppg.toFixed(1)} PPG in {player.stats.games_played} games)
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.detailRow}>
                      <Ionicons name="stats-chart" size={14} color={colors.textMuted} />
                      <Text style={[styles.detailText, styles.noStatsText]}>No 2025 stats</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  playerCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sortLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  sortButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortButtonTextActive: {
    color: colors.white,
  },
  ratingFilterContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  ratingChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ratingChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  ratingChipTextActive: {
    color: colors.white,
  },
  listContainer: {
    flex: 1,
    padding: spacing.md,
  },
  playerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionBadge: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  positionText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.white,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  playerTeam: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  ratingBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  playerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailItem: {
    marginRight: spacing.lg,
  },
  salaryAmount: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  contractYears: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  valueScore: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  valueLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  freeAgentDetails: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  detailText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  estimateText: {
    color: colors.success,
    fontWeight: '600',
  },
  noStatsText: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtext: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
