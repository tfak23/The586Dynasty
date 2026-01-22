import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTeams, getTeamCapSummary, createCapAdjustment, getTeamCapAdjustments, deleteCapAdjustment } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerCapScreen() {
  const { currentLeague } = useAppStore();
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');

  const { data: teams } = useQuery({
    queryKey: ['teams', currentLeague?.id],
    queryFn: async () => {
      const res = await getTeams(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const selectedTeam = teams?.find(t => t.id === selectedTeamId);

  const { data: capSummary } = useQuery({
    queryKey: ['capSummary', selectedTeamId],
    queryFn: async () => {
      const res = await getTeamCapSummary(selectedTeamId!);
      return res.data.data;
    },
    enabled: !!selectedTeamId,
  });

  const { data: capAdjustments, refetch: refetchAdjustments } = useQuery({
    queryKey: ['capAdjustments', selectedTeamId],
    queryFn: async () => {
      const res = await getTeamCapAdjustments(selectedTeamId!);
      return res.data.data;
    },
    enabled: !!selectedTeamId,
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: { reason: string; amount_2026: number }) => {
      return createCapAdjustment(selectedTeamId!, data);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Cap adjustment applied successfully');
      setAdjustmentAmount('');
      setAdjustmentReason('');
      queryClient.invalidateQueries({ queryKey: ['capSummary', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['capAdjustments', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['leagueCapSummary'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to apply adjustment');
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (adjustmentId: string) => {
      return deleteCapAdjustment(selectedTeamId!, adjustmentId);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Cap adjustment deleted');
      queryClient.invalidateQueries({ queryKey: ['capSummary', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['capAdjustments', selectedTeamId] });
      queryClient.invalidateQueries({ queryKey: ['leagueCapSummary'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to delete adjustment');
    },
  });

  const handleApplyAdjustment = () => {
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!adjustmentReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for this adjustment');
      return;
    }

    // For "subtract" (removing dead cap), we use negative values
    const finalAmount = adjustmentType === 'subtract' ? -amount : amount;

    Alert.alert(
      'Apply Cap Adjustment',
      `This will ${adjustmentType === 'add' ? 'add' : 'remove'} $${amount} ${adjustmentType === 'add' ? 'dead cap to' : 'dead cap from'} ${selectedTeam?.team_name}.\n\nReason: ${adjustmentReason}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: () => {
          createAdjustmentMutation.mutate({
            reason: adjustmentReason,
            amount_2026: finalAmount,
          });
        }},
      ]
    );
  };

  const handleDeleteAdjustment = (adjustmentId: string, reason: string) => {
    Alert.alert(
      'Delete Adjustment',
      `Are you sure you want to delete this cap adjustment?\n\n"${reason}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          deleteAdjustmentMutation.mutate(adjustmentId);
        }},
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
          <Text style={styles.title}>Cap Adjustments</Text>
          <Text style={styles.subtitle}>Adjust cap space for any team</Text>
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

      {/* Current Cap Info */}
      {selectedTeam && capSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Cap Status</Text>
          <View style={styles.capCard}>
            <View style={styles.capRow}>
              <View style={styles.capItem}>
                <Text style={styles.capLabel}>Salary Cap</Text>
                <Text style={styles.capValue}>${capSummary.salary_cap}</Text>
              </View>
              <View style={styles.capItem}>
                <Text style={styles.capLabel}>Total Salary</Text>
                <Text style={styles.capValue}>${Number(capSummary.total_salary).toFixed(0)}</Text>
              </View>
            </View>
            <View style={styles.capRow}>
              <View style={styles.capItem}>
                <Text style={styles.capLabel}>Dead Money</Text>
                <Text style={[styles.capValue, { color: colors.error }]}>
                  ${Number(capSummary.dead_money).toFixed(0)}
                </Text>
              </View>
              <View style={styles.capItem}>
                <Text style={styles.capLabel}>Cap Room</Text>
                <Text style={[styles.capValue, { color: Number(capSummary.cap_room) >= 0 ? colors.success : colors.error }]}>
                  ${Number(capSummary.cap_room).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Adjustment Form */}
      {selectedTeam && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Make Adjustment</Text>

          {/* Adjustment Type */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, adjustmentType === 'add' && styles.typeButtonActive]}
              onPress={() => setAdjustmentType('add')}
            >
              <Ionicons name="add" size={20} color={adjustmentType === 'add' ? colors.white : colors.error} />
              <Text style={[styles.typeButtonText, adjustmentType === 'add' && styles.typeButtonTextActive]}>
                Add Dead Cap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, adjustmentType === 'subtract' && styles.typeButtonActiveSuccess]}
              onPress={() => setAdjustmentType('subtract')}
            >
              <Ionicons name="remove" size={20} color={adjustmentType === 'subtract' ? colors.white : colors.success} />
              <Text style={[styles.typeButtonText, adjustmentType === 'subtract' && styles.typeButtonTextActive]}>
                Remove Dead Cap
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <Text style={styles.inputLabel}>Amount</Text>
          <View style={styles.amountInput}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountField}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={adjustmentAmount}
              onChangeText={setAdjustmentAmount}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Reason */}
          <Text style={styles.inputLabel}>Reason</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g., Trade dead cap adjustment, Commissioner correction..."
            placeholderTextColor={colors.textMuted}
            value={adjustmentReason}
            onChangeText={setAdjustmentReason}
            multiline
            numberOfLines={3}
          />

          {/* Apply Button */}
          <TouchableOpacity
            style={[
              styles.applyButton,
              (!adjustmentAmount || !adjustmentReason) && styles.applyButtonDisabled,
            ]}
            onPress={handleApplyAdjustment}
            disabled={!adjustmentAmount || !adjustmentReason}
          >
            <Text style={styles.applyButtonText}>Apply Adjustment</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Existing Adjustments */}
      {selectedTeam && capAdjustments && capAdjustments.adjustments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Existing Adjustments</Text>
          <View style={styles.adjustmentsList}>
            {capAdjustments.adjustments.map((adj: any) => {
              const totalAmount = (adj.amount_2026 || 0) + (adj.amount_2027 || 0) +
                (adj.amount_2028 || 0) + (adj.amount_2029 || 0) + (adj.amount_2030 || 0);
              return (
                <View key={adj.id} style={styles.adjustmentItem}>
                  <View style={styles.adjustmentInfo}>
                    <Text style={styles.adjustmentReason}>{adj.reason}</Text>
                    <Text style={styles.adjustmentDate}>
                      {new Date(adj.created_at).toLocaleDateString()}
                    </Text>
                    {adj.amount_2026 !== 0 && (
                      <Text style={styles.adjustmentYear}>2026: ${adj.amount_2026}</Text>
                    )}
                  </View>
                  <View style={styles.adjustmentActions}>
                    <Text style={[
                      styles.adjustmentAmount,
                      { color: totalAmount >= 0 ? colors.error : colors.success }
                    ]}>
                      {totalAmount >= 0 ? '+' : ''}${totalAmount}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteAdjustment(adj.id, adj.reason)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
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
  capCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  capRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  capItem: {
    flex: 1,
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
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  typeButtonActive: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  typeButtonActiveSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  typeButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  dollarSign: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  amountField: {
    flex: 1,
    padding: spacing.md,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  reasonInput: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  applyButton: {
    backgroundColor: colors.warning,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
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
  adjustmentsList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  adjustmentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  adjustmentInfo: {
    flex: 1,
  },
  adjustmentReason: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: '500',
  },
  adjustmentDate: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  adjustmentYear: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  adjustmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  adjustmentAmount: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  deleteBtn: {
    padding: spacing.xs,
  },
});
