import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/theme';
import { useAuthStore } from '@/lib/authStore';
import { discoverLeagues, convertLeague, joinLeague, UserLeague } from '@/lib/api';

export default function DiscoverLeaguesScreen() {
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingLeagueId, setProcessingLeagueId] = useState<string | null>(null);
  const { user } = useAuthStore();

  const loadLeagues = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await discoverLeagues();
      setLeagues(response.data.data.leagues);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load leagues');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeagues();
  }, []);

  const handleConvert = async (league: UserLeague) => {
    Alert.alert(
      'Convert League',
      `Convert "${league.name}" to a Salary Cap League? You will become the commissioner.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            setProcessingLeagueId(league.sleeper_league_id);
            try {
              await convertLeague(league.sleeper_league_id);
              Alert.alert('Success', 'League converted successfully!', [
                { text: 'OK', onPress: () => loadLeagues() }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not convert league');
            } finally {
              setProcessingLeagueId(null);
            }
          },
        },
      ]
    );
  };

  const handleJoin = async (league: UserLeague) => {
    setProcessingLeagueId(league.sleeper_league_id);
    try {
      await joinLeague(league.sleeper_league_id);
      Alert.alert('Success', 'Joined league successfully!', [
        { text: 'OK', onPress: () => loadLeagues() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not join league');
    } finally {
      setProcessingLeagueId(null);
    }
  };

  const renderLeague = ({ item }: { item: UserLeague }) => {
    const isProcessing = processingLeagueId === item.sleeper_league_id;
    
    return (
      <View style={styles.leagueCard}>
        <View style={styles.leagueHeader}>
          <Text style={styles.leagueName}>{item.name}</Text>
          <Text style={styles.leagueInfo}>
            Season {item.season} • {item.total_rosters} Teams
          </Text>
        </View>

        {item.action === 'already_joined' ? (
          <View style={[styles.button, styles.joinedButton]}>
            <Text style={styles.joinedText}>✓ Joined</Text>
          </View>
        ) : item.action === 'convert_to_salary_cap' ? (
          <TouchableOpacity
            style={[styles.button, styles.convertButton]}
            onPress={() => handleConvert(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Convert to Salary Cap League</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.joinButton]}
            onPress={() => handleJoin(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join League</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user?.has_sleeper_account) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Sleeper Account Linked</Text>
          <Text style={styles.emptyText}>
            Please link your Sleeper account to discover your leagues
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/link-sleeper')}
          >
            <Text style={styles.primaryButtonText}>Link Sleeper Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Sleeper Leagues</Text>
        <Text style={styles.subtitle}>
          Convert your leagues or join existing salary cap leagues
        </Text>
      </View>

      {leagues.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Leagues Found</Text>
          <Text style={styles.emptyText}>
            You don't have any Sleeper leagues for the current season
          </Text>
        </View>
      ) : (
        <FlatList
          data={leagues}
          renderItem={renderLeague}
          keyExtractor={(item) => item.sleeper_league_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadLeagues(true)}
              tintColor={colors.primary}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.continueButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.continueButtonText}>Continue to App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  leagueCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueHeader: {
    marginBottom: 12,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  leagueInfo: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  convertButton: {
    backgroundColor: colors.primary,
  },
  joinButton: {
    backgroundColor: colors.success || '#10b981',
  },
  joinedButton: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.success || '#10b981',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  joinedText: {
    color: colors.success || '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    margin: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  continueButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
