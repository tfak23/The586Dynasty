import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Switch, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { syncLeague, syncRosters, syncPlayers, syncStats, getLastSyncTime } from '@/lib/api';
import { useAppStore, DEFAULT_ROOKIE_VALUES, SUGGESTED_4_ROUND_VALUES, SUGGESTED_5_ROUND_VALUES } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';

const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}${message ? '\n' + message : ''}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const {
    currentLeague,
    currentTeam,
    isCommissioner,
    settings, setRookieDraftRounds, setRookiePickValue, resetPickValuesToSuggested, setIsOffseason,
    toggleCommissionerTeam,
    teams,
  } = useAppStore();

  const [showRoundsModal, setShowRoundsModal] = useState(false);
  const [showPickValuesModal, setShowPickValuesModal] = useState(false);
  const [editingPick, setEditingPick] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Fetch last sync time
  const { data: syncData, refetch: refetchSyncTime } = useQuery({
    queryKey: ['lastSyncTime', currentLeague?.id],
    queryFn: async () => {
      if (!currentLeague?.id) return null;
      const res = await getLastSyncTime(currentLeague.id);
      return res.data.data;
    },
    enabled: !!currentLeague?.id,
    refetchInterval: 60000,
  });

  // Roster sync mutation
  const rosterSyncMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague) throw new Error('No league connected');
      return syncRosters(currentLeague.id);
    },
    onSuccess: () => {
      showAlert('Success', 'Rosters synced with Sleeper!');
      refetchSyncTime();
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to sync rosters');
    },
  });

  // Player database sync mutation
  const playerSyncMutation = useMutation({
    mutationFn: async () => {
      return syncPlayers();
    },
    onSuccess: (res) => {
      const data = res.data.data;
      showAlert('Success', `Player database synced!\n${data.synced} players synced, ${data.skipped} skipped.`);
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to sync player database');
    },
  });

  // Stats sync mutation
  const statsSyncMutation = useMutation({
    mutationFn: async () => {
      return syncStats(2025, currentLeague?.id);
    },
    onSuccess: (res) => {
      const data = res.data.data;
      const scoringInfo = data.scoringType ? `\nScoring: ${data.scoringType}` : '';
      showAlert('Success', `2025 stats synced!\n${data.synced} players updated.${scoringInfo}`);
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to sync stats');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague) throw new Error('No league connected');
      return syncLeague(currentLeague.id);
    },
    onSuccess: () => {
      showAlert('Success', 'League synced with Sleeper!');
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      showAlert('Error', error.message || 'Failed to sync');
    },
  });

  return (
    <ScrollView style={styles.container}>
      {/* League Info (read-only) */}
      {currentLeague && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>League</Text>
          <View style={styles.card}>
            <View style={styles.connectedHeader}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>

            <View style={styles.leagueInfo}>
              <Text style={styles.leagueName}>{currentLeague.name}</Text>
              <Text style={styles.leagueDetail}>Season: {currentLeague.current_season}</Text>
              <Text style={styles.leagueDetail}>Cap: ${currentLeague.salary_cap}</Text>
            </View>

            {currentTeam && (
              <View style={styles.teamBadge}>
                <Ionicons name="person" size={16} color={colors.primary} />
                <Text style={styles.teamBadgeText}>Your Team: {currentTeam.team_name}</Text>
              </View>
            )}

            {isCommissioner && (
              <View style={styles.commissionerBadge}>
                <Ionicons name="shield" size={16} color={colors.warning} />
                <Text style={styles.commissionerBadgeText}>Commissioner</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {!currentLeague && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>League</Text>
          <View style={styles.card}>
            <Text style={styles.noLeagueText}>No league connected. Complete onboarding to link your Sleeper league.</Text>
          </View>
        </View>
      )}

      {/* Commissioner-only: Sync Controls */}
      {currentLeague && isCommissioner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sleeper Sync</Text>
          <View style={styles.card}>
            <View style={styles.syncStatusRow}>
              <View style={styles.syncStatusInfo}>
                <View style={styles.syncStatusHeader}>
                  <Ionicons
                    name={syncData?.minutes_ago !== null && syncData?.minutes_ago < 10 ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={syncData?.minutes_ago !== null && syncData?.minutes_ago < 10 ? colors.success : colors.warning}
                  />
                  <Text style={styles.syncStatusLabel}>Auto-Sync Status</Text>
                </View>
                <Text style={styles.syncStatusText}>
                  {syncData?.last_sync
                    ? syncData.minutes_ago !== null && syncData.minutes_ago < 1
                      ? 'Just now'
                      : syncData.minutes_ago !== null && syncData.minutes_ago < 60
                        ? `${Math.round(syncData.minutes_ago)} minutes ago`
                        : `${new Date(syncData.last_sync).toLocaleString()}`
                    : 'Never synced'}
                </Text>
                <Text style={styles.syncHint}>
                  Rosters sync automatically every 5 minutes
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={rosterSyncMutation.isPending ? styles.syncButtonDisabled : styles.syncButton}
                onPress={() => rosterSyncMutation.mutate()}
                disabled={rosterSyncMutation.isPending}
              >
                {rosterSyncMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.white} />
                )}
                <Text style={styles.syncButtonText}>
                  {rosterSyncMutation.isPending ? 'Syncing...' : 'Sync Rosters'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={syncMutation.isPending ? styles.syncButtonDisabled : styles.buttonSecondary}
                onPress={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={styles.buttonTextSecondary}>
                  {syncMutation.isPending ? 'Syncing...' : 'Sync League'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.syncNote}>
              When players are dropped on Sleeper, dead cap is automatically applied.
            </Text>

            {/* Player Database & Stats Sync */}
            <View style={styles.advancedSyncSection}>
              <Text style={styles.advancedSyncTitle}>Free Agent Database</Text>
              <Text style={styles.advancedSyncHint}>
                Sync NFL player database and stats to enable free agent browsing and contract estimation.
              </Text>

              <View style={styles.advancedSyncButtons}>
                <TouchableOpacity
                  style={playerSyncMutation.isPending ? styles.smallSyncButtonDisabled : styles.smallSyncButton}
                  onPress={() => playerSyncMutation.mutate()}
                  disabled={playerSyncMutation.isPending}
                >
                  {playerSyncMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="people-outline" size={16} color={colors.primary} />
                  )}
                  <Text style={styles.smallSyncButtonText}>
                    {playerSyncMutation.isPending ? 'Syncing...' : 'Sync Players'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={statsSyncMutation.isPending ? styles.smallSyncButtonDisabled : styles.smallSyncButton}
                  onPress={() => statsSyncMutation.mutate()}
                  disabled={statsSyncMutation.isPending}
                >
                  {statsSyncMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="stats-chart-outline" size={16} color={colors.primary} />
                  )}
                  <Text style={styles.smallSyncButtonText}>
                    {statsSyncMutation.isPending ? 'Syncing...' : 'Sync 2025 Stats'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Commissioner-only: Draft & League Settings */}
      {currentLeague && isCommissioner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commissioner Settings</Text>
          <View style={styles.card}>
            {/* Draft Settings */}
            <Text style={styles.subsectionTitle}>Draft Settings</Text>

            {/* Offseason Mode Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Offseason Mode</Text>
                <Text style={styles.settingHint}>
                  Include rookie draft picks in cap calculations
                </Text>
              </View>
              <Switch
                value={settings.isOffseason}
                onValueChange={setIsOffseason}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            {/* Rounds Dropdown */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowRoundsModal(true)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Rookie Draft Rounds</Text>
                <Text style={styles.settingHint}>Number of rounds in the rookie draft</Text>
              </View>
              <View style={styles.dropdownValue}>
                <Text style={styles.dropdownText}>{settings.rookieDraftRounds} Rounds</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Pick Values Editor */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => setShowPickValuesModal(true)}
            >
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Rookie Pick Salaries</Text>
                <Text style={styles.settingHint}>Edit salary cap values for each pick</Text>
              </View>
              <View style={styles.dropdownValue}>
                <Text style={styles.dropdownText}>Edit</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Commissioner Tools */}
            <View style={styles.divider} />

            <Text style={styles.subsectionTitle}>Commissioner Access</Text>
            <Text style={styles.commissionerHint}>
              Select which teams have commissioner access to manage league settings, trades, and rosters.
            </Text>
            {teams.map((team) => {
              const isCommissionerTeam = settings.commissionerTeamIds?.includes(team.id) || false;
              return (
                <TouchableOpacity
                  key={team.id}
                  style={styles.commissionerRow}
                  onPress={() => toggleCommissionerTeam(team.id)}
                >
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.team_name}</Text>
                    <Text style={styles.ownerName}>{team.owner_name}</Text>
                  </View>
                  <Switch
                    value={isCommissionerTeam}
                    onValueChange={() => toggleCommissionerTeam(team.id)}
                    trackColor={{ false: colors.border, true: colors.warning }}
                    thumbColor={colors.white}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Commissioner Tools Button */}
            <TouchableOpacity
              style={styles.commissionerToolsButton}
              onPress={() => router.push('/commissioner')}
            >
              <Ionicons name="shield-outline" size={20} color={colors.white} />
              <Text style={styles.commissionerToolsText}>Commissioner Tools</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current Season</Text>
            <Text style={styles.infoValue}>2025</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            await signOut();
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Rounds Selection Modal */}
      <Modal
        visible={showRoundsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRoundsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Draft Rounds</Text>
              <TouchableOpacity onPress={() => setShowRoundsModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {([3, 4, 5] as const).map((rounds) => (
              <TouchableOpacity
                key={rounds}
                style={settings.rookieDraftRounds === rounds ? styles.optionSelected : styles.option}
                onPress={() => {
                  setRookieDraftRounds(rounds);
                  resetPickValuesToSuggested(rounds);
                  setShowRoundsModal(false);
                }}
              >
                <View>
                  <Text style={styles.optionText}>{rounds} Rounds</Text>
                  <Text style={styles.optionHint}>
                    {rounds === 3 && 'Default - Rounds 1-2 are premium picks'}
                    {rounds === 4 && 'Extended - Adds graduated Round 3 values'}
                    {rounds === 5 && 'Full - Maximum roster building flexibility'}
                  </Text>
                </View>
                {settings.rookieDraftRounds === rounds && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.suggestButton}
              onPress={() => {
                resetPickValuesToSuggested(settings.rookieDraftRounds);
                showAlert('Updated', `Pick values reset to suggested values for ${settings.rookieDraftRounds}-round draft`);
              }}
            >
              <Ionicons name="refresh" size={18} color={colors.primary} />
              <Text style={styles.suggestButtonText}>Apply Suggested Pick Values</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pick Values Editor Modal */}
      <Modal
        visible={showPickValuesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPickValuesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Pick Salaries</Text>
              <TouchableOpacity onPress={() => setShowPickValuesModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickValuesList}>
              {Array.from({ length: settings.rookieDraftRounds }, (_, roundIndex) => {
                const round = roundIndex + 1;
                const startPick = roundIndex * 12 + 1;

                return (
                  <View key={round} style={styles.roundSection}>
                    <Text style={styles.roundTitle}>Round {round}</Text>
                    <Text style={styles.roundHint}>
                      {round <= 2 ? '4 years + team option at 1.5x' : '2 years'}
                    </Text>
                    <View style={styles.pickGrid}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const pickNumber = startPick + i;
                        const pickInRound = i + 1;
                        const value = settings.rookiePickValues[pickNumber] || 1;

                        return (
                          <TouchableOpacity
                            key={pickNumber}
                            style={styles.pickValueItem}
                            onPress={() => {
                              setEditingPick(pickNumber);
                              setEditingValue(value.toString());
                            }}
                          >
                            <Text style={styles.pickLabel}>
                              {round}.{pickInRound.toString().padStart(2, '0')}
                            </Text>
                            {editingPick === pickNumber ? (
                              <TextInput
                                style={styles.pickValueInput}
                                value={editingValue}
                                onChangeText={setEditingValue}
                                keyboardType="numeric"
                                autoFocus
                                selectTextOnFocus
                                onBlur={() => {
                                  const newValue = parseInt(editingValue) || 1;
                                  setRookiePickValue(pickNumber, Math.max(1, newValue));
                                  setEditingPick(null);
                                }}
                                onSubmitEditing={() => {
                                  const newValue = parseInt(editingValue) || 1;
                                  setRookiePickValue(pickNumber, Math.max(1, newValue));
                                  setEditingPick(null);
                                }}
                              />
                            ) : (
                              <Text style={styles.pickValueText}>${value}</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  resetPickValuesToSuggested(settings.rookieDraftRounds);
                  showAlert('Reset', `Pick values reset to suggested values for ${settings.rookieDraftRounds}-round draft`);
                }}
              >
                <Ionicons name="refresh" size={18} color={colors.white} />
                <Text style={styles.resetButtonText}>Reset to Suggested</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  connectedText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.success,
    marginLeft: spacing.sm,
  },
  leagueInfo: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  leagueName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  leagueDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.primaryDark + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  teamBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  commissionerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.warning + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  commissionerBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.warning,
    marginLeft: spacing.sm,
  },
  noLeagueText: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  // Sync styles
  syncStatusRow: {
    marginBottom: spacing.md,
  },
  syncStatusInfo: {
    flex: 1,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  syncStatusLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  syncStatusText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginLeft: spacing.lg + spacing.sm,
  },
  syncHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginLeft: spacing.lg + spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flex: 1,
  },
  syncButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flex: 1,
    opacity: 0.6,
  },
  syncButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  syncNote: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  advancedSyncSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  advancedSyncTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  advancedSyncHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  advancedSyncButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  smallSyncButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
    marginHorizontal: spacing.xs,
    opacity: 0.6,
  },
  smallSyncButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.sm,
    marginLeft: spacing.xs,
  },
  // Settings styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  settingHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  dropdownValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: fontSize.base,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  // Commissioner styles
  commissionerHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  commissionerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  ownerName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  commissionerToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  commissionerToolsText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    flex: 1,
  },
  // Info styles
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.base,
    color: colors.text,
  },
  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  modalContentLarge: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primaryDark + '20',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  optionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  optionHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  suggestButtonText: {
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  pickValuesList: {
    flex: 1,
  },
  roundSection: {
    marginBottom: spacing.lg,
  },
  roundTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  roundHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  pickValueItem: {
    width: '25%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  pickLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pickValueText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  pickValueInput: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  resetButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
