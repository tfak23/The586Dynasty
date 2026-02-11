import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

interface League {
  sleeper_league_id: string;
  name: string;
  total_rosters: number;
  season: string;
  avatar?: string;
  is_registered: boolean;
  app_league_id?: string;
  is_member: boolean;
  member_role?: string;
  action: 'convert' | 'join' | 'view';
}

export default function SelectLeagueScreen() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sleeper-get-leagues');

      if (error) {
        Alert.alert('Error', 'Failed to fetch your leagues');
        setLoading(false);
        return;
      }

      if (!data.success) {
        if (data.code === 'NO_SLEEPER_ACCOUNT') {
          Alert.alert(
            'No Sleeper Account',
            'Please link your Sleeper account first',
            [{ text: 'OK', onPress: () => router.replace('/onboarding/link-sleeper') }]
          );
        } else {
          Alert.alert('Error', data.error || 'Failed to fetch leagues');
        }
        setLoading(false);
        return;
      }

      setLeagues(data.leagues || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to fetch leagues');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertLeague = async (league: League) => {
    Alert.alert(
      'Convert League',
      `Convert "${league.name}" to a salary cap league? You will become the commissioner.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            setProcessing(league.sleeper_league_id);
            try {
              const { data, error } = await supabase.functions.invoke('league-convert', {
                body: { sleeper_league_id: league.sleeper_league_id }
              });

              setProcessing(null);

              if (error) {
                Alert.alert('Error', error.message || 'Failed to convert league');
                return;
              }

              if (!data.success) {
                Alert.alert('Error', data.error || 'Failed to convert league');
                return;
              }

              Alert.alert(
                'Success!',
                `"${league.name}" has been converted to a salary cap league. You are now the commissioner!`,
                [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
              );
            } catch (err: any) {
              setProcessing(null);
              Alert.alert('Error', err.message || 'Failed to convert league');
            }
          }
        }
      ]
    );
  };

  const handleJoinLeague = async (league: League) => {
    Alert.alert(
      'Join League',
      `Join "${league.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: async () => {
            setProcessing(league.sleeper_league_id);
            try {
              const { data, error } = await supabase.functions.invoke('league-join', {
                body: { sleeper_league_id: league.sleeper_league_id }
              });

              setProcessing(null);

              if (error) {
                Alert.alert('Error', error.message || 'Failed to join league');
                return;
              }

              if (!data.success) {
                if (data.code === 'ALREADY_MEMBER') {
                  Alert.alert(
                    'Already a Member',
                    'You are already a member of this league',
                    [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
                  );
                } else if (data.code === 'NOT_IN_SLEEPER_LEAGUE') {
                  Alert.alert(
                    'Not in League',
                    'You are not a member of this league on Sleeper'
                  );
                } else {
                  Alert.alert('Error', data.error || 'Failed to join league');
                }
                return;
              }

              Alert.alert(
                'Success!',
                `You've joined "${league.name}"!`,
                [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
              );
            } catch (err: any) {
              setProcessing(null);
              Alert.alert('Error', err.message || 'Failed to join league');
            }
          }
        }
      ]
    );
  };

  const handleViewLeague = (league: League) => {
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your leagues...</Text>
      </View>
    );
  }

  if (leagues.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Leagues Found</Text>
          <Text style={styles.emptyText}>
            You don't have any leagues on Sleeper for this season.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.buttonText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Your League</Text>
        <Text style={styles.subtitle}>
          Choose a league to manage in The 586 Dynasty
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {leagues.map((league) => (
          <View key={league.sleeper_league_id} style={styles.leagueCard}>
            <View style={styles.leagueHeader}>
              <View style={styles.leagueInfo}>
                <Text style={styles.leagueName}>{league.name}</Text>
                <Text style={styles.leagueDetails}>
                  {league.total_rosters} Teams • Season {league.season}
                </Text>
              </View>
              {league.is_registered && (
                <View style={styles.registeredBadge}>
                  <Text style={styles.registeredBadgeText}>Registered</Text>
                </View>
              )}
            </View>

            {league.is_member && (
              <View style={styles.memberInfo}>
                <Text style={styles.memberText}>
                  You're a {league.member_role} in this league
                </Text>
              </View>
            )}

            <View style={styles.leagueActions}>
              {league.action === 'convert' && (
                <TouchableOpacity
                  style={[styles.button, styles.convertButton]}
                  onPress={() => handleConvertLeague(league)}
                  disabled={processing === league.sleeper_league_id}
                >
                  {processing === league.sleeper_league_id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Convert to Salary Cap League</Text>
                  )}
                </TouchableOpacity>
              )}

              {league.action === 'join' && (
                <TouchableOpacity
                  style={[styles.button, styles.joinButton]}
                  onPress={() => handleJoinLeague(league)}
                  disabled={processing === league.sleeper_league_id}
                >
                  {processing === league.sleeper_league_id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Join League</Text>
                  )}
                </TouchableOpacity>
              )}

              {league.action === 'view' && (
                <TouchableOpacity
                  style={[styles.button, styles.viewButton]}
                  onPress={() => handleViewLeague(league)}
                >
                  <Text style={styles.buttonText}>View League</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  leagueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  leagueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  leagueDetails: {
    fontSize: 14,
    color: '#666',
  },
  registeredBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  registeredBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  memberInfo: {
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  memberText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  leagueActions: {
    marginTop: 8,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  convertButton: {
    backgroundColor: '#FF9800',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
  },
  viewButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  skipButton: {
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
