import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTeams } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import api from '@/lib/api';

export default function CommissionerTeamsScreen() {
  const { currentLeague } = useAppStore();
  const queryClient = useQueryClient();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedOwner, setEditedOwner] = useState('');

  const { data: teams } = useQuery({
    queryKey: ['teams', currentLeague?.id],
    queryFn: async () => {
      const res = await getTeams(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, data }: { teamId: string; data: any }) => {
      return api.patch(`/api/teams/${teamId}`, data);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Team updated successfully');
      setEditingTeamId(null);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update team');
    },
  });

  const handleEdit = (team: any) => {
    setEditingTeamId(team.id);
    setEditedName(team.team_name);
    setEditedOwner(team.owner_name);
  };

  const handleSave = () => {
    if (!editingTeamId) return;

    updateTeamMutation.mutate({
      teamId: editingTeamId,
      data: {
        team_name: editedName,
        owner_name: editedOwner,
      },
    });
  };

  const handleCancel = () => {
    setEditingTeamId(null);
    setEditedName('');
    setEditedOwner('');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Manage Teams</Text>
          <Text style={styles.subtitle}>Edit team names and owners</Text>
        </View>
      </View>

      {/* Teams List */}
      <View style={styles.section}>
        {teams?.map((team) => (
          <View key={team.id} style={styles.teamCard}>
            {editingTeamId === team.id ? (
              <>
                <View style={styles.editForm}>
                  <Text style={styles.inputLabel}>Team Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Team name"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.inputLabel}>Owner Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editedOwner}
                    onChangeText={setEditedOwner}
                    placeholder="Owner name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.editButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancel}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{team.team_name}</Text>
                  <Text style={styles.ownerName}>{team.owner_name}</Text>
                  <Text style={styles.rosterId}>Roster #{team.sleeper_roster_id}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(team)}
                >
                  <Ionicons name="pencil" size={20} color={colors.primary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}
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
  teamCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  teamInfo: {
    flexDirection: 'column',
  },
  teamName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  ownerName: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rosterId: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  editButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
  },
  editForm: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
    color: colors.text,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.white,
  },
});
