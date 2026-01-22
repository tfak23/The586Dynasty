import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { getLeagueRules, getLeague, LeagueRules } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type SectionKey = 'buyIn' | 'salaryCap' | 'keyDates' | 'deadCap' | 'trades' | 'rookies' | 'tanking';

export default function RulesScreen() {
  const { leagueId: paramLeagueId } = useLocalSearchParams<{ leagueId: string }>();
  const { currentLeagueId } = useAppStore();
  const leagueId = paramLeagueId || currentLeagueId;

  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(new Set(['buyIn', 'salaryCap']));

  const { data: league } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      const res = await getLeague(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['leagueRules', leagueId],
    queryFn: async () => {
      const res = await getLeagueRules(leagueId!);
      return res.data.data;
    },
    enabled: !!leagueId,
  });

  const toggleSection = (section: SectionKey) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Default rules if none configured
  const defaultRules: LeagueRules = {
    buyIn: {
      amount: 200,
      payouts: [
        { place: 1, amount: 1200, label: 'Champion' },
        { place: 2, amount: 600, label: 'Runner-up' },
        { place: 3, amount: 300, label: '3rd Place' },
        { place: 4, amount: 300, label: 'Division Winners (2)' },
      ],
    },
    salaryCap: {
      hardCap: 500,
      minYears: 45,
      maxYears: 75,
      minimumSalaries: {
        1: 1,
        2: 3,
        3: 6,
        4: 10,
        5: 15,
      },
    },
    keyDates: [
      { event: 'Offseason Opens', week: 'Week 18', description: 'Free agency and trades open' },
      { event: 'Franchise Tag Window', week: 'Weeks 1-4', description: 'Apply franchise tags to expiring contracts' },
      { event: 'Rookie Draft', week: 'TBD', description: 'Annual rookie draft' },
      { event: 'Trade Deadline', week: 'Week 10', description: 'Last day to make trades' },
    ],
    deadCapTable: [
      [50, 0, 0, 0, 0],
      [50, 25, 0, 0, 0],
      [50, 25, 10, 0, 0],
      [75, 50, 25, 10, 0],
      [75, 50, 25, 10, 10],
    ],
    tradeRules: [
      'All trades must be submitted through the app',
      'Trades are processed on commissioner approval',
      'No trade backs within 48 hours',
      'Future picks can only be traded 3 years out',
    ],
    rookieRules: [
      'Rookie salaries are fixed based on draft position',
      '1st round picks: 4-year contracts with team option',
      '2nd round picks: 3-year contracts with team option',
      '3rd+ round picks: 3-year contracts',
      'Rookies can be extended after year 2',
    ],
    tankingRules: [
      'Teams must set competitive lineups each week',
      'Repeat offenders may face draft pick penalties',
      'Commissioner has final say on tanking violations',
    ],
  };

  const displayRules = rules || defaultRules;

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>League Rules</Text>
          <Text style={styles.subtitle}>{league?.name || 'The 586 Dynasty'}</Text>
        </View>
      </View>

      {/* Buy-In & Payouts Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('buyIn')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="cash-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Buy-In & Payouts</Text>
        </View>
        <Ionicons
          name={expandedSections.has('buyIn') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('buyIn') && displayRules.buyIn && (
        <View style={styles.sectionContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Annual Buy-In</Text>
            <Text style={styles.infoValue}>${displayRules.buyIn.amount}</Text>
          </View>
          <Text style={styles.subheading}>Payouts</Text>
          {displayRules.buyIn.payouts.map((payout, index) => (
            <View key={index} style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>{payout.label || `${payout.place}${getOrdinal(payout.place)} Place`}</Text>
              <Text style={styles.payoutAmount}>${payout.amount}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Salary Cap Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('salaryCap')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="calculator-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Salary Cap</Text>
        </View>
        <Ionicons
          name={expandedSections.has('salaryCap') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('salaryCap') && displayRules.salaryCap && (
        <View style={styles.sectionContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hard Cap</Text>
            <Text style={styles.infoValue}>${displayRules.salaryCap.hardCap}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Min Contract Years</Text>
            <Text style={styles.infoValue}>{displayRules.salaryCap.minYears}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Max Contract Years</Text>
            <Text style={styles.infoValue}>{displayRules.salaryCap.maxYears}</Text>
          </View>
          {displayRules.salaryCap.minimumSalaries && (
            <>
              <Text style={styles.subheading}>Minimum Salaries by Year</Text>
              {Object.entries(displayRules.salaryCap.minimumSalaries).map(([year, salary]) => (
                <View key={year} style={styles.payoutRow}>
                  <Text style={styles.payoutLabel}>Year {year}</Text>
                  <Text style={styles.payoutAmount}>${salary}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Key Dates Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('keyDates')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Key Dates</Text>
        </View>
        <Ionicons
          name={expandedSections.has('keyDates') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('keyDates') && displayRules.keyDates && (
        <View style={styles.sectionContent}>
          {displayRules.keyDates.map((item, index) => (
            <View key={index} style={styles.dateItem}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateEvent}>{item.event}</Text>
                <Text style={styles.dateWeek}>{item.week}</Text>
              </View>
              <Text style={styles.dateDescription}>{item.description}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Dead Cap Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('deadCap')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="trending-down-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Dead Cap Table</Text>
        </View>
        <Ionicons
          name={expandedSections.has('deadCap') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('deadCap') && displayRules.deadCapTable && (
        <View style={styles.sectionContent}>
          <Text style={styles.tableNote}>Percentage of salary retained when releasing a player</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Contract</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Yr 1</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Yr 2</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Yr 3</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Yr 4</Text>
              <Text style={[styles.tableCell, styles.tableHeaderCell]}>Yr 5</Text>
            </View>
            {displayRules.deadCapTable.map((row, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableLabelCell]}>{index + 1} Year</Text>
                {row.map((val, colIndex) => (
                  <Text key={colIndex} style={styles.tableCell}>
                    {colIndex <= index ? `${val}%` : '-'}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Trade Rules Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('trades')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Trade Rules</Text>
        </View>
        <Ionicons
          name={expandedSections.has('trades') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('trades') && displayRules.tradeRules && (
        <View style={styles.sectionContent}>
          {displayRules.tradeRules.map((rule, index) => (
            <View key={index} style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>{'\u2022'}</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Rookie Rules Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('rookies')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="school-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Rookie Rules</Text>
        </View>
        <Ionicons
          name={expandedSections.has('rookies') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('rookies') && displayRules.rookieRules && (
        <View style={styles.sectionContent}>
          {displayRules.rookieRules.map((rule, index) => (
            <View key={index} style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>{'\u2022'}</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tanking Rules Section */}
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection('tanking')}
      >
        <View style={styles.sectionTitleRow}>
          <Ionicons name="warning-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Tanking Policy</Text>
        </View>
        <Ionicons
          name={expandedSections.has('tanking') ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {expandedSections.has('tanking') && displayRules.tankingRules && (
        <View style={styles.sectionContent}>
          {displayRules.tankingRules.map((rule, index) => (
            <View key={index} style={styles.ruleItem}>
              <Text style={styles.ruleBullet}>{'\u2022'}</Text>
              <Text style={styles.ruleText}>{rule}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
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
  backButton: {
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
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  subheading: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  payoutLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  payoutAmount: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.success,
  },
  dateItem: {
    marginBottom: spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dateEvent: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  dateWeek: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  dateDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tableNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableCell: {
    flex: 1,
    padding: spacing.sm,
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.text,
  },
  tableHeaderCell: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tableLabelCell: {
    textAlign: 'left',
    fontWeight: '500',
  },
  ruleItem: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  ruleBullet: {
    fontSize: fontSize.md,
    color: colors.primary,
    marginRight: spacing.sm,
    lineHeight: 22,
  },
  ruleText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
});
