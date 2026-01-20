import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors, getCapStatusColor } from '@/lib/theme';
import { getTeamRoster, getTeamCapSummary, getTeamDraftPicks, getTeam } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

// Get rookie contract years based on round (4 years + option for Rd 1-2)
const getRookieYearsNum = (round: number) => round <= 2 ? 4 : 2;
const getRookieYearsDisplay = (round: number) => round <= 2 ? '4yr + OPT' : '2yr';

// Format pick display (e.g., "1.02" or "Rd 1")
const formatPickDisplay = (pick: any) => {
  if (pick.pick_number) {
    const round = pick.round;
    const pickInRound = ((pick.pick_number - 1) % 12) + 1;
    return `${round}.${pickInRound.toString().padStart(2, '0')}`;
  }
  return `Rd ${pick.round}`;
};

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppStore();

  // Get pick value from settings
  const getPickValue = (pick: any) => {
    if (pick.pick_number) {
      return settings.rookiePickValues[pick.pick_number] || 1;
    }
    // Estimate based on middle of round for future picks
    const midPick = (pick.round - 1) * 12 + 6;
    return settings.rookiePickValues[midPick] || 1;
  };

  const { data: teamData } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      const res = await getTeam(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', id],
    queryFn: async () => {
      const res = await getTeamRoster(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: capSummary, isLoading: capLoading } = useQuery({
    queryKey: ['capSummary', id],
    queryFn: async () => {
      const res = await getTeamCapSummary(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: draftPicks } = useQuery({
    queryKey: ['draftPicks', id],
    queryFn: async () => {
      const res = await getTeamDraftPicks(id);
      return res.data.data || [];
    },
    enabled: !!id,
  });

  if (rosterLoading || capLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading team...</Text>
      </View>
    );
  }

  // roster is an array of contracts directly
  const contracts = Array.isArray(roster) ? roster : [];
  const salaryCap = capSummary?.salary_cap || 500;

  // Filter picks based on settings
  const filteredPicks = (draftPicks || []).filter((p: any) => p.round <= settings.rookieDraftRounds);

  // Calculate pick salary (only for 2026 picks that count against cap)
  const currentYearPicks = filteredPicks.filter((p: any) => p.season === 2026);
  const pickSalary = currentYearPicks.reduce((sum: number, pick: any) => sum + getPickValue(pick), 0);

  // Group contracts by position
  const grouped: Record<Position, any[]> = {
    QB: [], RB: [], WR: [], TE: [], K: [], DEF: [],
  };
  
  contracts.forEach((contract: any) => {
    const pos = contract.position as Position;
    if (grouped[pos]) {
      grouped[pos].push(contract);
    }
  });

  // Sort each group by salary
  Object.keys(grouped).forEach((pos) => {
    grouped[pos as Position].sort((a: any, b: any) => (b.salary || 0) - (a.salary || 0));
  });

  // Calculate player salary directly from roster data (more accurate than backend view)
  const playerSalary = contracts.reduce((sum: number, contract: any) => sum + (Number(contract.salary) || 0), 0);
  const totalSalary = playerSalary + pickSalary;
  const deadMoney = Number(capSummary?.dead_money) || 0;
  const capRoom = salaryCap - totalSalary - deadMoney;
  const contractCount = contracts.length + currentYearPicks.length;

  const capColor = getCapStatusColor(capRoom, salaryCap);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.teamName}>{teamData?.team_name || 'Team'}</Text>
          <Text style={styles.ownerName}>{teamData?.owner_name}</Text>
        </View>
      </View>

      {/* Cap Summary */}
      <View style={styles.capCard}>
        <View style={styles.capHeader}>
          <Text style={styles.capTitle}>Salary Cap</Text>
          <Text style={{ fontSize: fontSize.lg, fontWeight: 'bold', color: capColor }}>
            ${capRoom.toFixed(0)} available
          </Text>
        </View>
        
        {/* Cap bar */}
        <View style={styles.capBar}>
          <View 
            style={{ 
              height: 8,
              borderRadius: 4,
              width: `${Math.min(((totalSalary + deadMoney) / salaryCap) * 100, 100)}%`,
              backgroundColor: capColor 
            }} 
          />
        </View>
        
        <View style={styles.capRow}>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Total Cap</Text>
            <Text style={styles.capValue}>${salaryCap.toFixed(0)}</Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Used</Text>
            <Text style={styles.capValue}>${totalSalary.toFixed(0)}</Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Dead Money</Text>
            <Text style={deadMoney > 0 ? { fontSize: fontSize.md, fontWeight: '600', color: colors.error } : styles.capValue}>
              ${deadMoney.toFixed(0)}
            </Text>
          </View>
          <View style={styles.capItem}>
            <Text style={styles.capLabel}>Contracts</Text>
            <Text style={styles.capValue}>{contractCount}</Text>
          </View>
        </View>

        {pickSalary > 0 && (
          <View style={styles.capBreakdown}>
            <Text style={styles.capBreakdownText}>
              Players: ${playerSalary.toFixed(0)} • Picks: ${pickSalary.toFixed(0)}
            </Text>
          </View>
        )}
      </View>

      {/* Roster by Position */}
      {(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).map((position) => {
        const players = grouped[position];
        if (players.length === 0) return null;

        return (
          <View key={position} style={styles.positionSection}>
            <View style={styles.positionHeader}>
              <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: positionColors[position] }}>
                <Text style={styles.positionBadgeText}>{position}</Text>
              </View>
              <Text style={styles.positionCount}>{players.length}</Text>
            </View>
            
            {players.map((contract: any) => (
              <TouchableOpacity
                key={contract.id}
                style={styles.playerCard}
                onPress={() => router.push(`/contract/${contract.id}`)}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{contract.full_name}</Text>
                  <Text style={styles.contractDetails}>
                    {contract.nfl_team} • {contract.years_remaining}yr left
                    {contract.is_franchise_tagged && ' • 🏷️ TAG'}
                  </Text>
                </View>
                <View style={styles.playerSalary}>
                  <Text style={styles.salaryAmount}>
                    ${(Number(contract.salary) || 0).toFixed(2)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}

      {/* Draft Picks Section */}
      {filteredPicks && filteredPicks.length > 0 && (
        <View style={styles.positionSection}>
          <View style={styles.positionHeader}>
            <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.secondary }}>
              <Text style={styles.positionBadgeText}>PICKS</Text>
            </View>
            <Text style={styles.positionCount}>{filteredPicks.length} picks</Text>
          </View>
          
          {/* Group picks by season */}
          {[2026, 2027, 2028].map(season => {
            const seasonPicks = filteredPicks.filter((p: any) => p.season === season);
            if (seasonPicks.length === 0) return null;
            
            // Sort by pick_number if available, else by round
            const sortedPicks = seasonPicks.sort((a: any, b: any) => {
              if (a.pick_number && b.pick_number) return a.pick_number - b.pick_number;
              return a.round - b.round;
            });
            
            return (
              <View key={season} style={styles.seasonGroup}>
                <Text style={styles.seasonLabel}>{season}</Text>
                {sortedPicks.map((pick: any) => {
                  const pickValue = getPickValue(pick);
                  const pickDisplay = formatPickDisplay(pick);
                  const isTraded = pick.original_team_id !== pick.current_team_id;
                  
                  return (
                    <View key={pick.id} style={styles.pickCard}>
                      <View style={styles.pickInfo}>
                        <Text style={styles.pickRound}>{pickDisplay}</Text>
                        {isTraded && pick.original_team_name && (
                          <Text style={styles.pickOrigin}>via {pick.original_team_name}</Text>
                        )}
                      </View>
                      <View style={styles.pickDetails}>
                        <Text style={styles.pickValue}>${pickValue}</Text>
                        <Text style={styles.pickYears}>{getRookieYearsDisplay(pick.round)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

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
  teamName: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  ownerName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  capCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  capRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  capItem: {
    alignItems: 'center',
  },
  capLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  capValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xs,
  },
  capBar: {
    height: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  capBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  capFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  capFooterText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  capHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  capTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  capBreakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  capBreakdownText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  positionSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
  positionBadgeText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: 'bold',
  },
  positionCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  contractDetails: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  playerSalary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salaryAmount: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  seasonGroup: {
    marginBottom: spacing.md,
  },
  seasonLabel: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  pickInfo: {
    flex: 1,
  },
  pickRound: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  pickOrigin: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pickDetails: {
    alignItems: 'flex-end',
  },
  pickValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  pickYears: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
