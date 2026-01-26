import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, positionColors } from '@/lib/theme';
import { getTrade, acceptTrade, rejectTrade, voteTrade, processTradeApproval, withdrawTrade } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { currentTeam, isCommissioner } = useAppStore();

  const { data: trade, isLoading } = useQuery({
    queryKey: ['trade', id],
    queryFn: async () => {
      const res = await getTrade(id);
      return res.data.data;
    },
    enabled: !!id,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!currentTeam?.id) {
        throw new Error('No team selected. Please select your team in Settings first.');
      }
      console.log('[Trade Accept] team_id:', currentTeam.id, 'trade_id:', id);
      return acceptTrade(id, currentTeam.id);
    },
    onSuccess: () => {
      if (Platform.OS === 'web') {
        (globalThis as any).alert('Trade accepted!');
      } else {
        Alert.alert('Success', 'Trade accepted!');
      }
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      console.error('[Trade Accept Error]', error);
      if (Platform.OS === 'web') {
        (globalThis as any).alert(error.message || 'Failed to accept trade');
      } else {
        Alert.alert('Error', error.message || 'Failed to accept trade');
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTeam?.id) {
        throw new Error('No team selected. Please select your team in Settings first.');
      }
      console.log('[Trade Reject] team_id:', currentTeam.id, 'trade_id:', id);
      return rejectTrade(id, currentTeam.id);
    },
    onSuccess: () => {
      if (Platform.OS === 'web') {
        (globalThis as any).alert('Trade has been rejected.');
      } else {
        Alert.alert('Rejected', 'Trade has been rejected.');
      }
      queryClient.invalidateQueries();
      router.back();
    },
    onError: (error: any) => {
      console.error('[Trade Reject Error]', error);
      if (Platform.OS === 'web') {
        (globalThis as any).alert(error.message || 'Failed to reject trade');
      } else {
        Alert.alert('Error', error.message || 'Failed to reject trade');
      }
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (approve: boolean) => voteTrade(id, currentTeam?.id || '', approve),
    onSuccess: () => {
      Alert.alert('Voted', 'Your vote has been recorded.');
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to vote');
    },
  });

  const commissionerMutation = useMutation({
    mutationFn: async (approve: boolean) => processTradeApproval(id, approve),
    onSuccess: () => {
      Alert.alert('Processed', 'Trade has been processed.');
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to process trade');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!currentTeam?.id) {
        throw new Error('No team selected. Please select your team in Settings first.');
      }
      console.log('[Trade Withdraw] team_id:', currentTeam.id, 'trade_id:', id);
      return withdrawTrade(id, currentTeam.id);
    },
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        window.alert('Trade has been withdrawn.');
      } else {
        Alert.alert('Withdrawn', 'Trade has been withdrawn.');
      }
      queryClient.invalidateQueries();
      router.back();
    },
    onError: (error: any) => {
      console.error('[Trade Withdraw Error]', error);
      if (typeof window !== 'undefined') {
        window.alert(error.message || 'Failed to withdraw trade');
      } else {
        Alert.alert('Error', error.message || 'Failed to withdraw trade');
      }
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading trade...</Text>
      </View>
    );
  }

  if (!trade) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trade not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isInvolved = trade.teams?.some((t: any) => t.team_id === currentTeam?.id);
  const isProposer = trade.proposer_team_id === currentTeam?.id;
  // Only receivers with pending status can accept/reject (NOT the proposer)
  const needsMyResponse = trade.teams?.some(
    (t: any) => t.team_id === currentTeam?.id && t.status === 'pending'
  ) && !isProposer;
  const isPending = trade.status === 'pending';
  const needsCommissioner = trade.status === 'pending_approval';
  const needsVotes = trade.status === 'voting';
  const canWithdraw = isPending && isProposer;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'completed':
        return colors.success;
      case 'rejected':
      case 'vetoed':
        return colors.error;
      case 'pending':
      case 'pending_approval':
      case 'voting':
        return colors.warning;
      default:
        return colors.textMuted;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade Details</Text>
      </View>

      {/* Status Banner */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: getStatusColor(trade.status) + '20' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm, backgroundColor: getStatusColor(trade.status) }} />
        <Text style={{ fontSize: fontSize.sm, fontWeight: 'bold', textTransform: 'uppercase', color: getStatusColor(trade.status) }}>
          {trade.status.replace(/_/g, ' ').toUpperCase()}
        </Text>
      </View>

      {/* Trade Summary */}
      <View style={styles.tradeCard}>
        {trade.teams?.map((team: any, index: number) => (
          <View key={team.team_id}>
            {index > 0 && (
              <View style={styles.tradeDivider}>
                <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
              </View>
            )}
            
            <View style={styles.teamSection}>
              <View style={styles.teamHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={styles.teamName}>{team.team_name}</Text>
                  {trade.proposer_team_id && (
                    <View style={{
                      backgroundColor: team.team_id === trade.proposer_team_id ? colors.primary + '30' : colors.secondary + '30',
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: borderRadius.sm,
                    }}>
                      <Text style={{
                        fontSize: fontSize.xs,
                        fontWeight: '600',
                        color: team.team_id === trade.proposer_team_id ? colors.primary : colors.secondary,
                      }}>
                        {team.team_id === trade.proposer_team_id ? 'Proposer' : 'Receiver'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '600', textTransform: 'capitalize', color: getStatusColor(team.status) }}>
                  {team.status}
                </Text>
              </View>
              
              <Text style={styles.assetsLabel}>Receives:</Text>
              
              {team.assets_receiving?.map((asset: any, i: number) => (
                <View key={i} style={styles.assetRow}>
                  {asset.type === 'player' ? (
                    <>
                      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: positionColors[asset.position as Position] || colors.textMuted }}>
                        <Text style={styles.positionText}>{asset.position}</Text>
                      </View>
                      <View style={styles.assetInfo}>
                        <Text style={styles.assetName}>{asset.player_name}</Text>
                        <Text style={styles.assetDetails}>
                          ${asset.salary}/yr • {asset.years_remaining}yr remaining
                        </Text>
                        <Text style={styles.fromTeamText}>from {asset.from_team_name}</Text>
                      </View>
                    </>
                  ) : asset.type === 'pick' ? (
                    <>
                      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: colors.secondary }}>
                        <Ionicons name="document-text" size={12} color={colors.white} />
                      </View>
                      <View style={styles.assetInfo}>
                        <Text style={styles.assetName}>
                          {asset.season} Round {asset.round} Pick
                        </Text>
                        {asset.pick_number && (
                          <Text style={styles.assetDetails}>Pick #{asset.pick_number}</Text>
                        )}
                        <Text style={styles.fromTeamText}>from {asset.from_team_name}</Text>
                      </View>
                    </>
                  ) : asset.type === 'cap' ? (
                    <>
                      <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm, backgroundColor: colors.warning }}>
                        <Text style={styles.positionText}>CAP</Text>
                      </View>
                      <View style={styles.assetInfo}>
                        <Text style={styles.assetName}>${asset.cap_amount} Cap Relief</Text>
                        <Text style={styles.assetDetails}>Year: {asset.cap_year}</Text>
                        <Text style={styles.fromTeamText}>from {asset.from_team_name}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              ))}
              
              {(!team.assets_receiving || team.assets_receiving.length === 0) && (
                <Text style={styles.noAssets}>Nothing</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Trade Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{formatDate(trade.created_at)}</Text>
        </View>
        {trade.expires_at && trade.status === 'pending' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expires</Text>
            <Text style={[styles.infoValue, { color: new Date(trade.expires_at) < new Date() ? colors.error : colors.warning }]}>
              {formatDate(trade.expires_at)}
            </Text>
          </View>
        )}
        {trade.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.infoLabel}>Notes</Text>
            <Text style={styles.notesText}>{trade.notes}</Text>
          </View>
        )}
      </View>

      {/* Voting Info (if applicable) */}
      {trade.votes && trade.votes.length > 0 && (
        <View style={styles.votingSection}>
          <Text style={styles.sectionTitle}>Votes</Text>
          <View style={styles.votesCard}>
            {trade.votes.map((vote: any) => (
              <View key={vote.team_id} style={styles.voteRow}>
                <Text style={styles.voteName}>{vote.team_name}</Text>
                <Text style={[
                  styles.voteValue, 
                  { color: vote.approved ? colors.success : colors.error }
                ]}>
                  {vote.approved ? '✓ Approve' : '✗ Reject'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsSection}>
        {/* Accept/Reject for involved teams */}
        {needsMyResponse && (
          <>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Trade'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  if ((globalThis as any).confirm('Are you sure you want to reject this trade?')) {
                    rejectMutation.mutate();
                  }
                } else {
                  Alert.alert('Reject Trade', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reject', style: 'destructive', onPress: () => rejectMutation.mutate() },
                  ]);
                }
              }}
              disabled={rejectMutation.isPending}
            >
              <Ionicons name="close" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Trade'}
              </Text>
            </TouchableOpacity>

            {/* Counter Offer button */}
            <TouchableOpacity
              style={styles.counterOfferButton}
              onPress={() => {
                // Navigate to new trade with counter offer data
                // The original trade will be auto-rejected when counter is sent
                router.push({
                  pathname: '/trade/new',
                  params: {
                    counterOfferId: id,
                    partnerId: (trade as any).proposer_team_id,
                  },
                });
              }}
            >
              <Ionicons name="swap-horizontal" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>Counter Offer</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Voting for league members */}
        {needsVotes && !isInvolved && currentTeam && (
          <>
            <Text style={styles.votePrompt}>Cast your vote:</Text>
            <View style={styles.voteButtons}>
              <TouchableOpacity 
                style={styles.voteApprove}
                onPress={() => voteMutation.mutate(true)}
                disabled={voteMutation.isPending}
              >
                <Ionicons name="thumbs-up" size={20} color={colors.white} />
                <Text style={styles.voteButtonText}>Approve</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.voteReject}
                onPress={() => voteMutation.mutate(false)}
                disabled={voteMutation.isPending}
              >
                <Ionicons name="thumbs-down" size={20} color={colors.white} />
                <Text style={styles.voteButtonText}>Veto</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Commissioner approval */}
        {needsCommissioner && isCommissioner && (
          <>
            <Text style={styles.commissionerPrompt}>Commissioner Action Required:</Text>
            <View style={styles.voteButtons}>
              <TouchableOpacity
                style={styles.voteApprove}
                onPress={() => commissionerMutation.mutate(true)}
                disabled={commissionerMutation.isPending}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.voteButtonText}>Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.voteReject}
                onPress={() => commissionerMutation.mutate(false)}
                disabled={commissionerMutation.isPending}
              >
                <Ionicons name="close-circle" size={20} color={colors.white} />
                <Text style={styles.voteButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Withdraw button for proposer */}
        {canWithdraw && (
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => {
              if (typeof window !== 'undefined') {
                // Web browser
                if (window.confirm('Are you sure you want to withdraw this trade proposal?')) {
                  withdrawMutation.mutate();
                }
              } else {
                // Native
                Alert.alert('Withdraw Trade', 'Are you sure you want to withdraw this trade proposal?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Withdraw', style: 'destructive', onPress: () => withdrawMutation.mutate() },
                ]);
              }
            }}
            disabled={withdrawMutation.isPending}
          >
            <Ionicons name="arrow-undo" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>
              {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw Trade'}
            </Text>
          </TouchableOpacity>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: '600',
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
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  tradeCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  teamSection: {
    paddingVertical: spacing.sm,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  teamName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  teamStatus: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  assetsLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  positionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  positionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  assetInfo: {
    flex: 1,
  },
  assetName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  assetDetails: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  fromTeamText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  noAssets: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tradeDivider: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  infoSection: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  notesSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.text,
    marginTop: spacing.xs,
  },
  votingSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  votesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  voteName: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  voteValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  actionsSection: {
    padding: spacing.md,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.success,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  votePrompt: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  commissionerPrompt: {
    fontSize: fontSize.md,
    color: colors.warning,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  voteApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success,
  },
  voteReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  voteButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    backgroundColor: colors.warning,
  },
  counterOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    backgroundColor: colors.secondary,
  },
});
