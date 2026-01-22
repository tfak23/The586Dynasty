import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Switch, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { initializeLeague, syncLeague, syncRosters, syncPlayers, syncStats, getTeams, getLeagueBySleeperId, getLastSyncTime } from '@/lib/api';
import { useAppStore, DEFAULT_ROOKIE_VALUES, SUGGESTED_4_ROUND_VALUES, SUGGESTED_5_ROUND_VALUES } from '@/lib/store';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const {
    currentLeague, setCurrentLeague,
    currentTeam, setCurrentTeam,
    teams, setTeams,
    isCommissioner, setIsCommissioner,
    settings, setRookieDraftRounds, setRookiePickValue, resetPickValuesToSuggested, setIsOffseason,
    toggleCommissionerTeam,
    reset
  } = useAppStore();

  // Check if current team is commissioner
  const isCurrentTeamCommissioner = currentTeam && settings.commissionerTeamIds?.includes(currentTeam.id);

  const [sleeperLeagueId, setSleeperLeagueId] = useState('1315789488873553920'); // Default to The 586
  const [isConnecting, setIsConnecting] = useState(false);
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
    refetchInterval: 60000, // Refresh every minute
  });

  // Roster sync mutation (quick sync)
  const rosterSyncMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague) throw new Error('No league connected');
      return syncRosters(currentLeague.id);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Rosters synced with Sleeper!');
      refetchSyncTime();
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to sync rosters');
    },
  });

  // Player database sync mutation
  const playerSyncMutation = useMutation({
    mutationFn: async () => {
      return syncPlayers();
    },
    onSuccess: (res) => {
      const data = res.data.data;
      Alert.alert('Success', `Player database synced!\n${data.synced} players synced, ${data.skipped} skipped.`);
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to sync player database');
    },
  });

  // Stats sync mutation - uses league-specific scoring settings
  const statsSyncMutation = useMutation({
    mutationFn: async () => {
      // Pass league ID to use league's scoring settings from Sleeper
      return syncStats(2025, currentLeague?.id);
    },
    onSuccess: (res) => {
      const data = res.data.data;
      const scoringInfo = data.scoringType ? `\nScoring: ${data.scoringType}` : '';
      Alert.alert('Success', `2025 stats synced!\n${data.synced} players updated.${scoringInfo}`);
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to sync stats');
    },
  });

  const initializeMutation = useMutation({
    mutationFn: async (sleeperId: string) => {
      // First try to get existing league
      try {
        const existingRes = await getLeagueBySleeperId(sleeperId);
        return { league: existingRes.data.data, isNew: false };
      } catch {
        // League doesn't exist, initialize it
        const initRes = await initializeLeague(sleeperId);
        return { league: initRes.data.data.league, isNew: true };
      }
    },
    onSuccess: async (data) => {
      setCurrentLeague(data.league);
      
      // Fetch teams
      const teamsRes = await getTeams(data.league.id);
      setTeams(teamsRes.data.data);
      
      if (data.isNew) {
        Alert.alert('Success', 'League initialized! Now sync your data from Sleeper.');
      } else {
        Alert.alert('Connected', 'League found and connected!');
      }
      
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to connect league');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague) throw new Error('No league connected');
      return syncLeague(currentLeague.id);
    },
    onSuccess: () => {
      Alert.alert('Success', 'League synced with Sleeper!');
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to sync');
    },
  });

  const handleConnect = async () => {
    if (!sleeperLeagueId.trim()) {
      Alert.alert('Error', 'Please enter a Sleeper League ID');
      return;
    }
    setIsConnecting(true);
    try {
      await initializeMutation.mutateAsync(sleeperLeagueId.trim());
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectTeam = (team: any) => {
    setCurrentTeam(team);
    // Check if commissioner (simplified - would need API call in real app)
    setIsCommissioner(team.sleeper_roster_id === 1); // Placeholder
    Alert.alert('Team Selected', `You are now viewing as ${team.team_name}`);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect League',
      'Are you sure you want to disconnect from this league?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: () => {
            reset();
            queryClient.clear();
          }
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* League Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleeper League</Text>
        
        {!currentLeague ? (
          <View style={styles.card}>
            <Text style={styles.label}>Sleeper League ID</Text>
            <TextInput
              style={styles.input}
              value={sleeperLeagueId}
              onChangeText={setSleeperLeagueId}
              placeholder="Enter your Sleeper League ID"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <Text style={styles.hint}>
              Find this in the Sleeper app: League Settings → General → League ID
            </Text>
            <TouchableOpacity 
              style={isConnecting ? styles.buttonDisabled : styles.button}
              onPress={handleConnect}
              disabled={isConnecting}
            >
              <Ionicons name="link" size={18} color={colors.white} />
              <Text style={styles.buttonText}>
                {isConnecting ? 'Connecting...' : 'Connect League'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.connectedHeader}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
            
            <View style={styles.leagueInfo}>
              <Text style={styles.leagueName}>{currentLeague.name}</Text>
              <Text style={styles.leagueDetail}>ID: {currentLeague.sleeper_league_id}</Text>
              <Text style={styles.leagueDetail}>Season: {currentLeague.current_season}</Text>
              <Text style={styles.leagueDetail}>Cap: ${currentLeague.salary_cap}</Text>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.buttonSecondary}
                onPress={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={styles.buttonTextSecondary}>
                  {syncMutation.isPending ? 'Syncing...' : 'Sync'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.buttonDanger}
                onPress={handleDisconnect}
              >
                <Ionicons name="unlink" size={18} color={colors.white} />
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Automatic Sync Status */}
      {currentLeague && (
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

            <View style={styles.syncButtonRow}>
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
                  {rosterSyncMutation.isPending ? 'Syncing...' : 'Sync Now'}
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

      {/* Team Selection */}
      {currentLeague && teams.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Your Team</Text>
          <View style={styles.card}>
            {teams.map((team) => (
              <TouchableOpacity
                key={team.id}
                style={currentTeam?.id === team.id ? styles.teamRowSelected : styles.teamRow}
                onPress={() => handleSelectTeam(team)}
              >
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.team_name}</Text>
                  <Text style={styles.ownerName}>{team.owner_name}</Text>
                </View>
                {currentTeam?.id === team.id && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Commissioner Settings */}
      {currentLeague && teams.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commissioner Settings</Text>
          <View style={styles.card}>
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
            {isCurrentTeamCommissioner && (
              <TouchableOpacity
                style={styles.commissionerToolsButton}
                onPress={() => router.push('/commissioner')}
              >
                <Ionicons name="shield-outline" size={20} color={colors.white} />
                <Text style={styles.commissionerToolsText}>Commissioner Tools</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Draft Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Draft Settings</Text>
        <View style={styles.card}>
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
        </View>
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
                  // Auto-reset pick values when changing rounds
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
                Alert.alert('Updated', `Pick values reset to suggested values for ${settings.rookieDraftRounds}-round draft`);
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
                const endPick = startPick + 11;
                
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
                  Alert.alert(
                    'Reset Pick Values',
                    'Choose which values to apply:',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: '3-Round Default', 
                        onPress: () => resetPickValuesToSuggested(3)
                      },
                      { 
                        text: '4-Round Suggested', 
                        onPress: () => resetPickValuesToSuggested(4)
                      },
                      { 
                        text: '5-Round Suggested', 
                        onPress: () => resetPickValuesToSuggested(5)
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="refresh" size={18} color={colors.white} />
                <Text style={styles.resetButtonText}>Reset to Suggested</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    opacity: 0.6,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    flex: 1,
  },
  buttonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    backgroundColor: colors.error,
    flex: 1,
    marginLeft: spacing.sm,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
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
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamRowSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primaryDark + '20',
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
  // Sync status styles
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
  syncButtonRow: {
    marginTop: spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  syncButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
});
