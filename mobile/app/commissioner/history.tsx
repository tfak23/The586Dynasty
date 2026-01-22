import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getTradeHistory } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function CommissionerHistoryScreen() {
  const { currentLeague } = useAppStore();

  const { data: tradeHistory } = useQuery({
    queryKey: ['tradeHistory', currentLeague?.id],
    queryFn: async () => {
      const res = await getTradeHistory(currentLeague!.id);
      return res.data.data;
    },
    enabled: !!currentLeague,
  });

  const handleEdit = (trade: any) => {
    Alert.alert(
      'Edit Trade',
      `Editing trade ${trade.trade_number} is coming soon. This will allow you to modify trade details or delete the entry.`
    );
  };

  const handleAddNew = () => {
    Alert.alert(
      'Add Trade Entry',
      'Adding new trade history entries is coming soon. This will allow you to manually record trades that occurred outside the app.'
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
          <Text style={styles.title}>Trade History</Text>
          <Text style={styles.subtitle}>Edit or add trade history entries</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Trade History List */}
      <View style={styles.section}>
        {!tradeHistory || tradeHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No trade history found</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddNew}>
              <Text style={styles.emptyButtonText}>Add First Entry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tradeHistory.map((trade: any) => (
            <View key={trade.id} style={styles.tradeCard}>
              <View style={styles.tradeHeader}>
                <View>
                  <Text style={styles.tradeNumber}>Trade #{trade.trade_number}</Text>
                  <Text style={styles.tradeDate}>{trade.trade_year}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(trade)}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.tradeTeams}>
                <View style={styles.teamSide}>
                  <Text style={styles.teamLabel}>{trade.team1_name}</Text>
                  <Text style={styles.receivedLabel}>received:</Text>
                  {trade.team1_received?.map((item: any, idx: number) => (
                    <Text key={idx} style={styles.assetText}>
                      • {formatAsset(item)}
                    </Text>
                  ))}
                </View>
                <View style={styles.swapIcon}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.textMuted} />
                </View>
                <View style={styles.teamSide}>
                  <Text style={styles.teamLabel}>{trade.team2_name}</Text>
                  <Text style={styles.receivedLabel}>received:</Text>
                  {trade.team2_received?.map((item: any, idx: number) => (
                    <Text key={idx} style={styles.assetText}>
                      • {formatAsset(item)}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

function formatAsset(item: any): string {
  if (item.type === 'player') {
    return `${item.name} ($${item.salary}/yr)`;
  } else if (item.type === 'pick') {
    return `${item.pickYear} Rd ${item.pickRound}${item.originalOwner ? ` (via ${item.originalOwner})` : ''}`;
  } else if (item.type === 'cap') {
    return `$${item.capAmount} cap (${item.capYear})`;
  }
  return JSON.stringify(item);
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
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.full,
  },
  section: {
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptyButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  tradeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeNumber: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  tradeDate: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  editButton: {
    padding: spacing.xs,
  },
  tradeTeams: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamSide: {
    flex: 1,
  },
  teamLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  receivedLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  assetText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  swapIcon: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
  },
});
