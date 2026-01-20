import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius, getCapStatusColor } from '@/lib/theme';
import { getTeamCapProjection } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function ProjectionsScreen() {
  const { currentTeam, currentLeague } = useAppStore();

  const { data: projection } = useQuery({
    queryKey: ['capProjection', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return null;
      const res = await getTeamCapProjection(currentTeam.id);
      return res.data.data;
    },
    enabled: !!currentTeam,
  });

  if (!currentTeam || !currentLeague) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trending-up-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Team Selected</Text>
        <Text style={styles.emptyText}>Connect your league in Settings</Text>
      </View>
    );
  }

  const salaryCap = projection?.salary_cap || currentLeague.salary_cap;
  const projections = projection?.projections || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cap Projections</Text>
        <Text style={styles.subtitle}>{currentTeam.team_name}</Text>
      </View>

      {/* 5-Year Chart (simplified bars) */}
      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>5-Year Outlook</Text>
        
        <View style={styles.chart}>
          {projections.map((year: any) => {
            const usedPercent = Math.min((year.total_cap_used / salaryCap) * 100, 100);
            const capColor = getCapStatusColor(year.cap_room, salaryCap);
            
            return (
              <View key={year.season} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View 
                    style={{ 
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      borderRadius: 4,
                      height: `${usedPercent}%`, 
                      backgroundColor: capColor 
                    }} 
                  />
                </View>
                <Text style={styles.barLabel}>{year.season}</Text>
              </View>
            );
          })}
        </View>
        
        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.capHealthy }} />
            <Text style={styles.legendText}>Healthy (&gt;15%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.capWarning }} />
            <Text style={styles.legendText}>Tight (5-15%)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.capCritical }} />
            <Text style={styles.legendText}>Critical (&lt;5%)</Text>
          </View>
        </View>
      </View>

      {/* Year-by-Year Details */}
      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Year-by-Year Breakdown</Text>
        
        {projections.map((year: any) => {
          const capColor = getCapStatusColor(year.cap_room, salaryCap);
          
          return (
            <View key={year.season} style={styles.yearCard}>
              <View style={styles.yearHeader}>
                <Text style={styles.yearTitle}>{year.season}</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: capColor }}>
                  ${year.cap_room.toFixed(2)} room
                </Text>
              </View>
              
              <View style={styles.yearDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Committed Salary</Text>
                  <Text style={styles.detailValue}>${year.committed_salary.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Dead Money</Text>
                  <Text style={year.dead_money > 0 ? { fontSize: 14, fontWeight: '600', color: colors.error } : styles.detailValue}>
                    ${year.dead_money.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total Cap Used</Text>
                  <Text style={styles.detailValue}>${year.total_cap_used.toFixed(2)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contracts</Text>
                  <Text style={styles.detailValue}>{year.contract_count}</Text>
                </View>
              </View>
              
              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View 
                  style={{ 
                    height: 8,
                    borderRadius: 9999,
                    width: `${Math.min((year.total_cap_used / salaryCap) * 100, 100)}%`,
                    backgroundColor: capColor 
                  }} 
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Contract Year Limits */}
      <View style={styles.limitsSection}>
        <Text style={styles.sectionTitle}>Contract Year Limits</Text>
        <View style={styles.limitsCard}>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Minimum Contract Years</Text>
            <Text style={styles.limitValue}>{currentLeague.min_contract_years}</Text>
          </View>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Maximum Contract Years</Text>
            <Text style={styles.limitValue}>{currentLeague.max_contract_years}</Text>
          </View>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Your Current Total</Text>
            <Text style={styles.limitValue}>
              {projections[0]?.contract_count 
                ? `${projections[0].contract_count * 2} (est.)` // rough estimate
                : '-'}
            </Text>
          </View>
        </View>
      </View>
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
    marginTop: spacing.sm,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  chartContainer: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  chart: {
    flexDirection: 'row',
    height: 150,
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    width: 40,
    height: 120,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: borderRadius.sm,
  },
  barLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  detailsSection: {
    padding: spacing.md,
  },
  yearCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  yearHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  yearTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  yearCapRoom: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  yearDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.full,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  limitsSection: {
    padding: spacing.md,
    marginBottom: spacing.xxl,
  },
  limitsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  limitLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  limitValue: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
});
