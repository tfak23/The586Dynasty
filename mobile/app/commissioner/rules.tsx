import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueRules, updateLeagueRules, LeagueRules } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerRulesScreen() {
  const { currentLeague } = useAppStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRules, setEditedRules] = useState<LeagueRules | null>(null);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['leagueRules', currentLeague?.id],
    queryFn: async () => {
      const res = await getLeagueRules(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const updateMutation = useMutation({
    mutationFn: async (newRules: LeagueRules) => {
      return updateLeagueRules(currentLeague!.id, newRules);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Rules updated successfully');
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['leagueRules'] });
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update rules');
    },
  });

  const handleEdit = () => {
    setEditedRules(rules || {
      buyIn: { amount: 200, payouts: [] },
      salaryCap: { hardCap: 500, minYears: 45, maxYears: 75 },
      keyDates: [],
      tradeRules: [],
      rookieRules: [],
      tankingRules: [],
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedRules) {
      updateMutation.mutate(editedRules);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedRules(null);
  };

  const updateBuyInAmount = (amount: string) => {
    if (!editedRules) return;
    setEditedRules({
      ...editedRules,
      buyIn: {
        ...editedRules.buyIn,
        amount: parseInt(amount) || 0,
        payouts: editedRules.buyIn?.payouts || [],
      },
    });
  };

  const updateCapValue = (field: string, value: string) => {
    if (!editedRules) return;
    setEditedRules({
      ...editedRules,
      salaryCap: {
        ...editedRules.salaryCap,
        [field]: parseInt(value) || 0,
        hardCap: editedRules.salaryCap?.hardCap || 500,
        minYears: editedRules.salaryCap?.minYears || 45,
        maxYears: editedRules.salaryCap?.maxYears || 75,
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading rules...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Edit Rules</Text>
          <Text style={styles.subtitle}>Update league rules and settings</Text>
        </View>
        {!isEditing ? (
          <TouchableOpacity style={styles.editHeaderButton} onPress={handleEdit}>
            <Ionicons name="pencil" size={20} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.cancelHeaderButton} onPress={handleCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveHeaderButton} onPress={handleSave}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Buy-In Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Buy-In & Payouts</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Annual Buy-In</Text>
            {isEditing ? (
              <View style={styles.inputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.smallInput}
                  value={String(editedRules?.buyIn?.amount || 200)}
                  onChangeText={updateBuyInAmount}
                  keyboardType="number-pad"
                />
              </View>
            ) : (
              <Text style={styles.fieldValue}>${rules?.buyIn?.amount || 200}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Salary Cap Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salary Cap Settings</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Hard Cap</Text>
            {isEditing ? (
              <View style={styles.inputContainer}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.smallInput}
                  value={String(editedRules?.salaryCap?.hardCap || 500)}
                  onChangeText={(v) => updateCapValue('hardCap', v)}
                  keyboardType="number-pad"
                />
              </View>
            ) : (
              <Text style={styles.fieldValue}>${rules?.salaryCap?.hardCap || 500}</Text>
            )}
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Min Contract Years</Text>
            {isEditing ? (
              <TextInput
                style={styles.smallInput}
                value={String(editedRules?.salaryCap?.minYears || 45)}
                onChangeText={(v) => updateCapValue('minYears', v)}
                keyboardType="number-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{rules?.salaryCap?.minYears || 45}</Text>
            )}
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Max Contract Years</Text>
            {isEditing ? (
              <TextInput
                style={styles.smallInput}
                value={String(editedRules?.salaryCap?.maxYears || 75)}
                onChangeText={(v) => updateCapValue('maxYears', v)}
                keyboardType="number-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{rules?.salaryCap?.maxYears || 75}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Note about additional editing */}
      <View style={styles.section}>
        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.noteText}>
            Additional rules editing (trade rules, rookie rules, key dates, dead cap table) is coming soon.
            For now, you can update the basic league settings above.
          </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
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
  editHeaderButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelHeaderButton: {
    padding: spacing.sm,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveHeaderButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveText: {
    color: colors.white,
    fontWeight: '600',
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  fieldValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarSign: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  smallInput: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSize.md,
    color: colors.text,
    minWidth: 80,
    textAlign: 'right',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  noteText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary,
    lineHeight: 20,
  },
});
