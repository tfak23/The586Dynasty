import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, getPositionColor, getCapStatusColor } from '@/lib/theme';
import { getTeamRoster, getTeamCap, getTeamDraftPicks, Contract, TeamCapSummary } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

// Format pick display (e.g., "2026 1.02" or "2026 Rd 1")
const formatPickDisplay = (pick: any) => {
  if (pick.pick_number) {
    const round = pick.round;
    const pickInRound = ((pick.pick_number - 1) % 12) + 1;
    return `${pick.season} ${round}.${pickInRound.toString().padStart(2, '0')}`;
  }
  return `${pick.season} Rd ${pick.round}`;
};

// Get rookie contract years display
const getRookieYearsDisplay = (round: number) => {
  return round <= 2 ? '4yr + opt' : '2yr';
};

export default function MyTeamScreen() {
  const { currentTeam, currentLeague, settings } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  // Get pick value from settings
  const getPickValue = (pick: any) => {
    if (pick.pick_number) {
      return settings.rookiePickValues[pick.pick_number] || 1;
    }
    // Estimate based on round if no pick number
    const estimatedPick = (pick.round - 1) * 12 + 6;
    return settings.rookiePickValues[estimatedPick] || 1;
  };

  const { data: capData, refetch: refetchCap } = useQuery({
    queryKey: ['teamCap', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return null;
      const res = await getTeamCap(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam,
  });

  const { data: roster, refetch: refetchRoster } = useQuery({
    queryKey: ['teamRoster', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return [];
      const res = await getTeamRoster(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam,
  });

  const { data: draftPicks, refetch: refetchPicks } = useQuery({
    queryKey: ['teamDraftPicks', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return [];
      const res = await getTeamDraftPicks(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCap(), refetchRoster(), refetchPicks()]);
    setRefreshing(false);
  };

  if (!currentTeam || !currentLeague) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Team Selected</Text>
        <Text style={styles.emptyText}>Go to Settings to connect your Sleeper league</Text>
        <Link href="/(tabs)/settings" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Go to Settings</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  // Filter picks based on settings - show all owned picks
  const filteredPicks = (draftPicks || []).filter((p: any) =>
    p.round <= settings.rookieDraftRounds
  );

  // Calculate pick salary (only for 2026 picks when in offseason mode)
  const currentYearPicks = filteredPicks.filter((p: any) => p.season === 2026);
  const pickSalary = settings.isOffseason
    ? currentYearPicks.reduce((sum: number, pick: any) => sum + getPickValue(pick), 0)
    : 0;

  // Calculate player salary directly from roster data (more accurate than backend view which may have stale season filtering)
  const playerSalary = (roster || []).reduce((sum, contract) => sum + (Number(contract.salary) || 0), 0);
  const totalSalary = playerSalary + pickSalary;
  const deadMoney = Number(capData?.dead_money) || 0;

  const salaryCap = currentLeague.salary_cap || 1;
  const capRoom = salaryCap - totalSalary - deadMoney;
  const capPercentUsed = Math.max(0, Math.min(100, ((totalSalary + deadMoney) / salaryCap) * 100));
  const capColor = getCapStatusColor(capRoom, salaryCap);

  // Group roster by position
  const rosterByPosition = (roster || []).reduce((acc, contract) => {
    const pos = contract.position || 'Other';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(contract);
    return acc;
  }, {} as Record<string, Contract[]>);

  const positionOrder = ['QB', 'RB', 'WR', 'TE'];

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Team Header */}
      <View style={styles.header}>
        <Text style={styles.teamName}>{currentTeam.team_name}</Text>
        <Text style={styles.ownerName}>{currentTeam.owner_name}</Text>
      </View>

      {/* Cap Summary Card */}
      <View style={styles.capCard}>
        <View style={styles.capHeader}>
          <Text style={styles.capTitle}>Salary Cap</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: capColor }}>${capRoom.toFixed(0)} available</Text>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={{ height: 8, borderRadius: 9999, width: `${capPercentUsed}%`, backgroundColor: capColor }} />
        </View>
        
        <View style={styles.capDetails}>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Total Cap</Text>
            <Text style={styles.capValue}>${salaryCap}</Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Used</Text>
            <Text style={styles.capValue}>${totalSalary.toFixed(0)}</Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Dead Money</Text>
            <Text style={styles.capValue}>${deadMoney.toFixed(0)}</Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Contracts</Text>
            <Text style={styles.capValue}>
              {settings.isOffseason 
                ? (roster?.length || 0) + currentYearPicks.length
                : roster?.length || 0}
            </Text>
          </View>
        </View>
        
        {settings.isOffseason && pickSalary > 0 && (
          <View style={styles.capBreakdown}>
            <Text style={styles.capBreakdownText}>
              Players: ${playerSalary.toFixed(0)} • Picks: ${pickSalary.toFixed(0)}
            </Text>
          </View>
        )}
      </View>

      {/* Roster Section */}
      <View style={styles.rosterSection}>
        <Text style={styles.sectionTitle}>Roster ({roster?.length || 0})</Text>
        
        {positionOrder.map(position => {
          const players = rosterByPosition[position] || [];
          if (players.length === 0) return null;
          
          return (
            <View key={position} style={styles.positionGroup}>
              <View style={styles.positionHeader}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: getPositionColor(position) }}>
                  <Text style={styles.positionText}>{position}</Text>
                </View>
                <Text style={styles.positionCount}>{players.length}</Text>
              </View>
              
              {players.sort((a, b) => b.salary - a.salary).map(contract => (
                <Link key={contract.id} href={`/contract/${contract.id}`} asChild>
                  <TouchableOpacity style={styles.playerRow}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{contract.full_name}</Text>
                      <Text style={styles.playerMeta}>
                        {contract.nfl_team || 'FA'} • {contract.years_remaining}yr left
                        {contract.has_option && ' • OPT'}
                        {contract.is_franchise_tagged && ' • TAG'}
                      </Text>
                    </View>
                    <View style={styles.salaryInfo}>
                      <Text style={styles.salary}>${contract.salary}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          );
        })}
      </View>

      {/* Draft Picks Section - only show in offseason mode */}
      {settings.isOffseason && filteredPicks && filteredPicks.length > 0 && (
        <View style={styles.rosterSection}>
          <Text style={styles.sectionTitle}>
            2026 Draft Picks ({currentYearPicks.length}) - ${pickSalary} cap hit
          </Text>
          
          {/* Only show 2026 picks in offseason mode roster view */}
          {currentYearPicks.length > 0 && (
            <View style={styles.positionGroup}>
              <View style={styles.positionHeader}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.secondary }}>
                  <Text style={styles.positionText}>PICKS</Text>
                </View>
                <Text style={styles.positionCount}>{currentYearPicks.length}</Text>
              </View>
              
              {currentYearPicks
                .sort((a: any, b: any) => a.pick_number - b.pick_number)
                .map((pick: any) => {
                  const pickValue = getPickValue(pick);
                  const pickInRound = ((pick.pick_number - 1) % 12) + 1;
                  const pickDisplay = `${pick.round}.${pickInRound.toString().padStart(2, '0')}`;
                  const isTraded = pick.original_team_id !== pick.current_team_id;
                  
                  return (
                    <View key={pick.id} style={styles.playerRow}>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>Pick {pickDisplay}</Text>
                        <Text style={styles.playerMeta}>
                          {getRookieYearsDisplay(pick.round)}
                          {isTraded && pick.original_team_name && ` • via ${pick.original_team_name}`}
                        </Text>
                      </View>
                      <View style={styles.salaryInfo}>
                        <Text style={styles.salary}>${pickValue}</Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      )}

      {/* Future Draft Picks Section - show all years */}
      {filteredPicks && filteredPicks.length > 0 && (
        <View style={styles.rosterSection}>
          <Text style={styles.sectionTitle}>All Draft Picks ({filteredPicks.length})</Text>
          
          {[2026, 2027, 2028].map(season => {
            const seasonPicks = filteredPicks.filter((p: any) => p.season === season);
            if (seasonPicks.length === 0) return null;
            
            // Sort by pick_number if available, else by round
            const sortedPicks = seasonPicks.sort((a: any, b: any) => {
              if (a.pick_number && b.pick_number) return a.pick_number - b.pick_number;
              return a.round - b.round;
            });
            
            return (
              <View key={season} style={styles.positionGroup}>
                <View style={styles.positionHeader}>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: colors.secondary }}>
                    <Text style={styles.positionText}>{season}</Text>
                  </View>
                  <Text style={styles.positionCount}>{sortedPicks.length}</Text>
                </View>
                
                {sortedPicks.map((pick: any) => {
                  const pickValue = getPickValue(pick);
                  const pickDisplay = formatPickDisplay(pick);
                  const isTraded = pick.original_team_id !== pick.current_team_id;
                  
                  return (
                    <View key={pick.id} style={styles.playerRow}>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{pickDisplay}</Text>
                        <Text style={styles.playerMeta}>
                          {getRookieYearsDisplay(pick.round)}
                          {isTraded && pick.original_team_name && ` • via ${pick.original_team_name}`}
                        </Text>
                      </View>
                      <View style={styles.salaryInfo}>
                        <Text style={styles.salary}>${pickValue}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
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
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  ownerName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  capCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  capHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  capTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  capRoom: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  progressFill: {
    height: 8,
    borderRadius: borderRadius.full,
  },
  capDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  capItem: {
    width: '50%',
    paddingVertical: spacing.sm,
  },
  capLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  capValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  capBreakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  capBreakdownText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  rosterSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  positionGroup: {
    marginBottom: spacing.lg,
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  positionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  positionText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  positionCount: {
    color: colors.textMuted,
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  playerMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  salaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salary: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
});
