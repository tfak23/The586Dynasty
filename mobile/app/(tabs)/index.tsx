import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, getPositionColor, getCapStatusColor } from '@/lib/theme';
import { getTeamRoster, getTeamCap, getTeamDraftPicks, getTeamCapAdjustments, Contract, TeamCapSummary } from '@/lib/api';
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
  const [showDeadCapModal, setShowDeadCapModal] = useState(false);

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

  const { data: capAdjustments } = useQuery({
    queryKey: ['teamCapAdjustments', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return null;
      const res = await getTeamCapAdjustments(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam && showDeadCapModal,
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
          <TouchableOpacity
            style={styles.capItem}
            onPress={() => deadMoney > 0 && setShowDeadCapModal(true)}
            disabled={deadMoney === 0}
          >
            <Text style={styles.capLabel}>Adjustments</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={deadMoney > 0 ? { fontSize: fontSize.md, fontWeight: '600', color: colors.error, marginTop: spacing.xs } : styles.capValue}>
                ${deadMoney.toFixed(0)}
              </Text>
              {deadMoney > 0 && (
                <Ionicons name="information-circle-outline" size={14} color={colors.error} style={{ marginLeft: 4, marginTop: spacing.xs }} />
              )}
            </View>
          </TouchableOpacity>
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

      {/* Cap Projections Link */}
      <Link href="/(tabs)/projections" asChild>
        <TouchableOpacity style={styles.projectionButton}>
          <Ionicons name="trending-up" size={20} color={colors.primary} />
          <Text style={styles.projectionButtonText}>View Cap Projections</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </Link>

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

      {/* Salary Cap Adjustment Modal */}
      <Modal
        visible={showDeadCapModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeadCapModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeadCapModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Salary Cap Adjustments</Text>
              <TouchableOpacity onPress={() => setShowDeadCapModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Total for 2026</Text>
              <Text style={styles.modalTotalValue}>${deadMoney.toFixed(0)}</Text>
            </View>

            {/* Cap Adjustments List */}
            {capAdjustments && capAdjustments.adjustments && capAdjustments.adjustments.length > 0 ? (
              <ScrollView style={styles.modalScrollView}>
                {capAdjustments.adjustments.map((adj: any, index: number) => {
                  const amt2026 = Number(adj.amount_2026) || 0;
                  const amt2027 = Number(adj.amount_2027) || 0;
                  const amt2028 = Number(adj.amount_2028) || 0;
                  const amt2029 = Number(adj.amount_2029) || 0;
                  const amt2030 = Number(adj.amount_2030) || 0;
                  const displayReason = adj.description || adj.reason || 'Unknown adjustment';

                  // Build year breakdown string
                  const yearBreakdown = [];
                  if (amt2026 !== 0) yearBreakdown.push(`2026: $${Math.round(amt2026)}`);
                  if (amt2027 !== 0) yearBreakdown.push(`2027: $${Math.round(amt2027)}`);
                  if (amt2028 !== 0) yearBreakdown.push(`2028: $${Math.round(amt2028)}`);
                  if (amt2029 !== 0) yearBreakdown.push(`2029: $${Math.round(amt2029)}`);
                  if (amt2030 !== 0) yearBreakdown.push(`2030: $${Math.round(amt2030)}`);

                  const content = (
                    <View style={styles.modalAdjustmentItem}>
                      <View style={styles.modalAdjustmentHeader}>
                        <Ionicons
                          name={adj.trade_id ? 'swap-horizontal' : 'calculator'}
                          size={16}
                          color={adj.trade_id ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.modalAdjustmentReason, adj.trade_id && { color: colors.primary }]}>
                          {displayReason}
                        </Text>
                        {adj.trade_id && (
                          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                        )}
                      </View>
                      <Text style={styles.modalAdjustmentDate}>
                        {new Date(adj.created_at).toLocaleDateString()}
                      </Text>
                      {yearBreakdown.length > 0 && (
                        <Text style={styles.modalAdjustmentYears}>
                          {yearBreakdown.join(' • ')}
                        </Text>
                      )}
                    </View>
                  );

                  // If has trade_id, make it clickable
                  if (adj.trade_id) {
                    return (
                      <TouchableOpacity
                        key={adj.id || index}
                        onPress={() => {
                          setShowDeadCapModal(false);
                          router.push(`/trade/${adj.trade_id}`);
                        }}
                      >
                        {content}
                      </TouchableOpacity>
                    );
                  }

                  return <View key={adj.id || index}>{content}</View>;
                })}
              </ScrollView>
            ) : (
              <Text style={styles.noDeadCapText}>No cap adjustments found</Text>
            )}

            {/* Totals by Year */}
            {capAdjustments && capAdjustments.totals && (
              <View style={styles.modalTotalsSection}>
                <Text style={styles.modalTotalsTitle}>Totals by Year</Text>
                <View style={styles.modalTotalsGrid}>
                  {Number(capAdjustments.totals.total_2026) !== 0 && (
                    <View style={styles.modalTotalItem}>
                      <Text style={styles.modalTotalYear}>2026</Text>
                      <Text style={[styles.modalTotalYearAmount, { color: Number(capAdjustments.totals.total_2026) > 0 ? colors.error : colors.success }]}>
                        ${Math.round(Number(capAdjustments.totals.total_2026))}
                      </Text>
                    </View>
                  )}
                  {Number(capAdjustments.totals.total_2027) !== 0 && (
                    <View style={styles.modalTotalItem}>
                      <Text style={styles.modalTotalYear}>2027</Text>
                      <Text style={[styles.modalTotalYearAmount, { color: Number(capAdjustments.totals.total_2027) > 0 ? colors.error : colors.success }]}>
                        ${Math.round(Number(capAdjustments.totals.total_2027))}
                      </Text>
                    </View>
                  )}
                  {Number(capAdjustments.totals.total_2028) !== 0 && (
                    <View style={styles.modalTotalItem}>
                      <Text style={styles.modalTotalYear}>2028</Text>
                      <Text style={[styles.modalTotalYearAmount, { color: Number(capAdjustments.totals.total_2028) > 0 ? colors.error : colors.success }]}>
                        ${Math.round(Number(capAdjustments.totals.total_2028))}
                      </Text>
                    </View>
                  )}
                  {Number(capAdjustments.totals.total_2029) !== 0 && (
                    <View style={styles.modalTotalItem}>
                      <Text style={styles.modalTotalYear}>2029</Text>
                      <Text style={[styles.modalTotalYearAmount, { color: Number(capAdjustments.totals.total_2029) > 0 ? colors.error : colors.success }]}>
                        ${Math.round(Number(capAdjustments.totals.total_2029))}
                      </Text>
                    </View>
                  )}
                  {Number(capAdjustments.totals.total_2030) !== 0 && (
                    <View style={styles.modalTotalItem}>
                      <Text style={styles.modalTotalYear}>2030</Text>
                      <Text style={[styles.modalTotalYearAmount, { color: Number(capAdjustments.totals.total_2030) > 0 ? colors.error : colors.success }]}>
                        ${Math.round(Number(capAdjustments.totals.total_2030))}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  projectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectionButtonText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  modalTotalLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  modalTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.error,
  },
  modalSection: {
    marginBottom: spacing.md,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  modalSectionTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionTotal: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: colors.error,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  modalItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalItemName: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  modalItemPosition: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  modalItemAmount: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
  noDeadCapText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  modalScrollView: {
    maxHeight: 250,
  },
  modalAdjustmentItem: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  modalAdjustmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  modalAdjustmentReason: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  modalAdjustmentDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginLeft: 24,
  },
  modalAdjustmentYears: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginLeft: 24,
  },
  modalTotalsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalTotalsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  modalTotalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalTotalItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
  },
  modalTotalYear: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  modalTotalYearAmount: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
});
