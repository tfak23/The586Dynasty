import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, getCapStatusColor } from '@/lib/theme';
import { getLeagueCapDetailed, getLeagueDraftPicks } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useState, useMemo } from 'react';

export default function LeagueScreen() {
  const { currentLeague, currentTeam, settings } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  // Use roster-based cap calculation (matches team page)
  const { data: capSummaries, refetch: refetchCap } = useQuery({
    queryKey: ['leagueCapDetailed', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getLeagueCapDetailed(currentLeague.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const { data: draftPicks, refetch: refetchPicks } = useQuery({
    queryKey: ['leagueDraftPicks', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getLeagueDraftPicks(currentLeague.id);
      return res.data.data || [];
    },
    enabled: !!currentLeague,
  });

  // Helper to get pick value from settings
  const getPickValue = (pick: any) => {
    if (pick.pick_number) {
      return settings.rookiePickValues[pick.pick_number] || 1;
    }
    // Estimate based on middle of round for future picks
    const midPick = (pick.round - 1) * 12 + 6;
    return settings.rookiePickValues[midPick] || 1;
  };

  // Calculate pick salary per team (only 2026 picks when in offseason mode)
  const pickSalaryByTeam = useMemo(() => {
    const salaryMap: Record<string, number> = {};
    if (!draftPicks || !settings.isOffseason) return salaryMap;

    const filteredPicks = draftPicks.filter(
      (p: any) => p.round <= settings.rookieDraftRounds && p.season === 2026
    );

    filteredPicks.forEach((pick: any) => {
      const teamId = pick.current_team_id;
      if (!salaryMap[teamId]) salaryMap[teamId] = 0;
      salaryMap[teamId] += getPickValue(pick);
    });

    return salaryMap;
  }, [draftPicks, settings.rookieDraftRounds, settings.rookiePickValues, settings.isOffseason]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCap(), refetchPicks()]);
    setRefreshing(false);
  };

  if (!currentLeague) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No League Connected</Text>
        <Text style={styles.emptyText}>Connect your Sleeper league in Settings</Text>
      </View>
    );
  }

  // Calculate adjusted cap data including pick salaries
  // The new endpoint returns roster_salary (matches team page calculation)
  const teamsWithPickSalary = useMemo(() => {
    return (capSummaries || []).map((team: any) => {
      const pickSalary = pickSalaryByTeam[team.team_id] || 0;
      // roster_salary comes from the new cap-detailed endpoint (same calculation as team page)
      const adjustedTotalSalary = (Number(team.roster_salary) || 0) + pickSalary;
      const adjustedCapRoom = (Number(team.cap_room) || 0) - pickSalary;
      return {
        ...team,
        pick_salary: pickSalary,
        adjusted_total_salary: adjustedTotalSalary,
        adjusted_cap_room: adjustedCapRoom,
      };
    });
  }, [capSummaries, pickSalaryByTeam]);

  // Sort by adjusted cap room (most to least)
  const sortedTeams = [...teamsWithPickSalary].sort((a, b) => a.adjusted_cap_room - b.adjusted_cap_room).reverse();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* League Header */}
      <View style={styles.header}>
        <Text style={styles.leagueName}>{currentLeague.name}</Text>
        <Text style={styles.leagueInfo}>
          {currentLeague.current_season} Season • ${currentLeague.salary_cap} Cap
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/rules')}
        >
          <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Rules</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/league-history')}
        >
          <Ionicons name="trophy-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/buy-ins')}
        >
          <Ionicons name="cash-outline" size={24} color={colors.primary} />
          <Text style={styles.actionLabel}>Buy-Ins</Text>
        </TouchableOpacity>
      </View>

      {/* Teams List */}
      <View style={styles.teamsSection}>
        <Text style={styles.sectionTitle}>Team Standings by Cap Room</Text>
        
        {sortedTeams.map((team, index) => {
          const isMyTeam = team.team_id === currentTeam?.id;
          const capRoom = team.adjusted_cap_room;
          const salaryCap = currentLeague.salary_cap || 1; // Prevent division by zero
          const capPercentUsed = Math.max(0, Math.min(100, ((salaryCap - capRoom) / salaryCap) * 100));
          const capColor = getCapStatusColor(capRoom, salaryCap);
          
          return (
            <Link key={team.team_id} href={`/team/${team.team_id}`} asChild>
              <TouchableOpacity style={isMyTeam ? styles.teamCardMyTeam : styles.teamCard}>
                <View style={styles.teamRank}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>
                
                <View style={styles.teamInfo}>
                  <View style={styles.teamNameRow}>
                    <Text style={styles.teamName}>{team.team_name}</Text>
                    {isMyTeam && (
                      <View style={styles.myTeamBadge}>
                        <Text style={styles.myTeamText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.ownerName}>{team.owner_name}</Text>
                  
                  {/* Mini progress bar */}
                  <View style={styles.miniProgressBar}>
                    <View 
                      style={{
                        height: 4,
                        borderRadius: 9999,
                        width: `${capPercentUsed}%`, 
                        backgroundColor: capColor
                      }} 
                    />
                  </View>
                </View>
                
                <View style={styles.capInfo}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: capColor
                  }}>
                    ${capRoom.toFixed(0)}
                  </Text>
                  <Text style={styles.capUsed}>
                    ${team.adjusted_total_salary.toFixed(0)} used
                  </Text>
                  <Text style={styles.contractYears}>
                    {team.total_contract_years || 0} yrs
                  </Text>
                </View>
                
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>
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
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leagueName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  leagueInfo: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginTop: spacing.xs,
  },
  teamsSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  teamCardMyTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  teamRank: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rankNumber: {
    fontSize: fontSize.base,
    fontWeight: 'bold',
    color: colors.textSecondary,
  },
  teamInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  myTeamBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  myTeamText: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    color: colors.white,
  },
  ownerName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  miniProgressBar: {
    height: 4,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  miniProgressFill: {
    height: 4,
    borderRadius: borderRadius.full,
  },
  capInfo: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  capRoom: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  capUsed: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  contractYears: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
