import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeague, advanceSeason } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerSeasonScreen() {
  const { currentLeague, currentTeam } = useAppStore();
  const queryClient = useQueryClient();

  // Default to 7 days from now
  const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [deadlineDate, setDeadlineDate] = useState(defaultDate.toISOString().split('T')[0]); // YYYY-MM-DD
  const [deadlineTime, setDeadlineTime] = useState('23:59'); // HH:MM

  // Compute the full deadline Date object
  const tagDeadline = useMemo(() => {
    try {
      const [year, month, day] = deadlineDate.split('-').map(Number);
      const [hours, minutes] = deadlineTime.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    } catch {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }, [deadlineDate, deadlineTime]);

  const { data: league, isLoading } = useQuery({
    queryKey: ['league', currentLeague?.id],
    queryFn: async () => {
      const res = await getLeague(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const advanceSeasonMutation = useMutation({
    mutationFn: async () => {
      if (!currentLeague || !currentTeam) throw new Error('No league or team selected');
      return advanceSeason(currentLeague.id, currentTeam.id, tagDeadline.toISOString());
    },
    onSuccess: (response) => {
      const data = response.data.data;
      Alert.alert(
        'Season Advanced',
        `Successfully moved from ${data.previous_season} to ${data.new_season}.\n\n${data.expiring_contracts_count} contracts require a decision (tag or release).`,
        [{ text: 'OK', onPress: () => {
          queryClient.invalidateQueries();
          router.back();
        }}]
      );
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to advance season');
    },
  });

  const handleAdvanceSeason = () => {
    Alert.alert(
      'Advance Season',
      `This will:\n\n1. Move the league to season ${(league?.current_season || 2026) + 1}\n2. Decrement all contract years\n3. Flag expiring contracts for tag/release decisions\n4. Set franchise tag deadline to ${tagDeadline.toLocaleDateString()} at ${tagDeadline.toLocaleTimeString()}\n\nThis action cannot be easily undone. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Advance Season', style: 'destructive', onPress: () => advanceSeasonMutation.mutate() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
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
          <Text style={styles.title}>Advance Season</Text>
          <Text style={styles.subtitle}>Move to the next season</Text>
        </View>
      </View>

      {/* Current Season Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Season</Text>
        <View style={styles.infoCard}>
          <View style={styles.seasonDisplay}>
            <Text style={styles.seasonNumber}>{league?.current_season || 2026}</Text>
            <Ionicons name="arrow-forward" size={24} color={colors.primary} style={{ marginHorizontal: spacing.lg }} />
            <Text style={styles.seasonNumberNew}>{(league?.current_season || 2026) + 1}</Text>
          </View>
        </View>
      </View>

      {/* Franchise Tag Deadline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Franchise Tag Deadline</Text>
        <Text style={styles.sectionDescription}>
          Set the deadline for teams to apply franchise tags to expiring players.
        </Text>

        <View style={styles.dateTimeRow}>
          {/* Date Input - uses native date picker on web */}
          <View style={styles.dateInputContainer}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={deadlineDate}
                onChange={(e: any) => setDeadlineDate(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.text,
                  fontSize: 16,
                  flex: 1,
                  outline: 'none',
                }}
              />
            ) : (
              <TextInput
                style={styles.dateInput}
                value={deadlineDate}
                onChangeText={setDeadlineDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            )}
          </View>

          {/* Time Input - uses native time picker on web */}
          <View style={styles.timeInputContainer}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            {Platform.OS === 'web' ? (
              <input
                type="time"
                value={deadlineTime}
                onChange={(e: any) => setDeadlineTime(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.text,
                  fontSize: 16,
                  flex: 1,
                  outline: 'none',
                }}
              />
            ) : (
              <TextInput
                style={styles.timeInput}
                value={deadlineTime}
                onChangeText={setDeadlineTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.textMuted}
              />
            )}
          </View>
        </View>

        <Text style={styles.deadlinePreview}>
          Deadline: {tagDeadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {tagDeadline.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>

      {/* What Happens Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What Happens</Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.bulletText}>All contract years will be decremented by 1</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.bulletText}>Expiring contracts will be flagged for decisions</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.bulletText}>Each team can apply ONE franchise tag</Text>
          </View>
          <View style={styles.bulletItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.bulletText}>Unflagged expired contracts will be auto-released after deadline</Text>
          </View>
        </View>
      </View>

      {/* Franchise Tag Cost Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Franchise Tag Costs</Text>
        <View style={styles.bulletList}>
          <View style={styles.bulletItem}>
            <Text style={styles.positionBadge}>QB</Text>
            <Text style={styles.bulletText}>Average of top 10 QB salaries</Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.positionBadge}>TE</Text>
            <Text style={styles.bulletText}>Average of top 10 TE salaries</Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={[styles.positionBadge, { backgroundColor: colors.info }]}>RB</Text>
            <Text style={styles.bulletText}>Average of top 20 RB salaries</Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={[styles.positionBadge, { backgroundColor: colors.success }]}>WR</Text>
            <Text style={styles.bulletText}>Average of top 20 WR salaries</Text>
          </View>
        </View>
      </View>

      {/* Warning */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning-outline" size={24} color={colors.warning} />
        <Text style={styles.warningText}>
          This action will affect all teams and contracts in the league. Make sure all trades and roster moves for the current season are complete before advancing.
        </Text>
      </View>

      {/* Advance Button */}
      <TouchableOpacity
        style={styles.advanceButton}
        onPress={handleAdvanceSeason}
        disabled={advanceSeasonMutation.isPending}
      >
        <Ionicons name="calendar" size={24} color={colors.white} />
        <Text style={styles.advanceButtonText}>
          {advanceSeasonMutation.isPending ? 'Advancing...' : 'Advance to Next Season'}
        </Text>
      </TouchableOpacity>

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
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  seasonDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seasonNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textMuted,
  },
  seasonNumberNew: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.primary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateInputContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  timeInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  dateInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  timeInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  deadlinePreview: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bulletList: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  positionBadge: {
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    minWidth: 32,
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '20',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.warning,
    lineHeight: 20,
  },
  advanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  advanceButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.white,
  },
});
