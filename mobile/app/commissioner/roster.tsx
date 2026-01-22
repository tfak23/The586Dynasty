import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTeams, getTeamRoster, searchPlayers, releasePlayer } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerRosterScreen() {
  const { currentLeague } = useAppStore();
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');

  const { data: teams } = useQuery({
    queryKey: ['teams', currentLeague?.id],
    queryFn: async () => {
      const res = await getTeams(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);

  const { data: roster } = useQuery({
    queryKey: ['roster', selectedTeamId],
    queryFn: async () => {
      const res = await getTeamRoster(selectedTeamId!);
      return res.data.data;
    },
    enabled: !!selectedTeamId,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['playerSearch', playerSearch],
    queryFn: async () => {
      const res = await searchPlayers(playerSearch);
      return res.data.data;
    },
    enabled: playerSearch.length >= 2,
  });

  const releaseMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return releasePlayer(contractId, 'Commissioner release');
    },
    onSuccess: () => {
      Alert.alert('Success', 'Player released successfully');
      queryClient.invalidateQueries({ queryKey: ['roster', selectedTeamId] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to release player');
    },
  });

  const handleRelease = (contract: any) => {
    Alert.alert(
      'Release Player',
      `Are you sure you want to release ${contract.full_name}? This will apply dead cap.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: () => releaseMutation.mutate(contract.id),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Manage Rosters</Text>
          <Text style={styles.subtitle}>Add or drop players from any team</Text>
        </View>
      </View>

      {/* Team Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Team</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowTeamPicker(true)}
        >
          <Text style={selectedTeam ? styles.pickerText : styles.pickerPlaceholder}>
            {selectedTeam ? selectedTeam.team_name : 'Choose a team...'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Current Roster */}
      {selectedTeam && roster && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Roster ({roster.length} players)</Text>
          {roster.map((contract: any) => (
            <View key={contract.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{contract.full_name}</Text>
                <Text style={styles.playerDetails}>
                  {contract.position} • ${contract.salary}/yr • {contract.years_remaining}yr left
                </Text>
              </View>
              <TouchableOpacity
                style={styles.releaseButton}
                onPress={() => handleRelease(contract)}
              >
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add Player Search */}
      {selectedTeam && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Player</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a player..."
            placeholderTextColor={colors.textMuted}
            value={playerSearch}
            onChangeText={setPlayerSearch}
          />
          {searchResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.slice(0, 10).map((player: any) => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.searchResultItem}
                  onPress={() => {
                    Alert.alert(
                      'Add Player',
                      `Adding ${player.full_name} to ${selectedTeam.team_name} requires creating a contract. This feature is coming soon.`
                    );
                  }}
                >
                  <View>
                    <Text style={styles.searchResultName}>{player.full_name}</Text>
                    <Text style={styles.searchResultDetails}>
                      {player.position} • {player.team || 'FA'}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.success} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 50 }} />

      {/* Team Picker Modal */}
      <Modal
        visible={showTeamPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <TouchableOpacity onPress={() => setShowTeamPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {teams?.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.teamOption,
                    selectedTeamId === team.id && styles.teamOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedTeamId(team.id);
                    setShowTeamPicker(false);
                  }}
                >
                  <View>
                    <Text style={styles.teamOptionName}>{team.team_name}</Text>
                    <Text style={styles.teamOptionOwner}>{team.owner_name}</Text>
                  </View>
                  {selectedTeamId === team.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
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
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  pickerPlaceholder: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  playerCard: {
    flexDirection: 'row',
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
  playerDetails: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  releaseButton: {
    padding: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
    color: colors.text,
  },
  searchResults: {
    marginTop: spacing.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  searchResultDetails: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
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
    maxHeight: '70%',
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
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  teamOptionSelected: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  teamOptionName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  teamOptionOwner: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
});
