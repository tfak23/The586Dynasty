import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, getCapStatusColor } from '@/lib/theme';
import { getLeagueCapSummary, TeamCapSummary } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useState } from 'react';

export default function LeagueScreen() {
  const { currentLeague, currentTeam } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  const { data: capSummaries, refetch } = useQuery({
    queryKey: ['leagueCap', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague) return [];
      const res = await getLeagueCapSummary(currentLeague.id);
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
        <Ionicons name="people-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No League Connected</Text>
        <Text style={styles.emptyText}>Connect your Sleeper league in Settings</Text>
      </View>
    );
  }

  // Sort by cap room (most to least)
  const sortedTeams = [...(capSummaries || [])].sort((a, b) => (Number(b.cap_room) || 0) - (Number(a.cap_room) || 0));

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

      {/* League Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sortedTeams.length}</Text>
          <Text style={styles.statLabel}>Teams</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ${sortedTeams.reduce((sum, t) => sum + (Number(t.total_salary) || 0), 0).toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Total Salary</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {sortedTeams.reduce((sum, t) => sum + (Number(t.active_contracts) || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Contracts</Text>
        </View>
      </View>

      {/* Teams List */}
      <View style={styles.teamsSection}>
        <Text style={styles.sectionTitle}>Team Standings by Cap Room</Text>
        
        {sortedTeams.map((team, index) => {
          const isMyTeam = team.team_id === currentTeam?.id;
          const capRoom = Number(team.cap_room) || 0;
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
                    ${capRoom.toFixed(2)}
                  </Text>
                  <Text style={styles.capUsed}>
                    ${(Number(team.total_salary) || 0).toFixed(2)} used
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
  statsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
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
