import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';

export default function LinkSleeperScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLinkAccount = async () => {
    if (!username || username.trim() === '') {
      Alert.alert('Error', 'Please enter your Sleeper username');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('sleeper-link-account', {
        body: { sleeper_username: username.trim() }
      });

      setLoading(false);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to link Sleeper account');
        return;
      }

      if (!data.success) {
        if (data.code === 'SLEEPER_USERNAME_TAKEN') {
          Alert.alert(
            'Username Already Linked',
            'This Sleeper username is already linked to another account. Each Sleeper account can only be linked once.'
          );
        } else if (data.code === 'SLEEPER_USER_NOT_FOUND') {
          Alert.alert(
            'Username Not Found',
            'This Sleeper username does not exist. Please check your spelling and try again.'
          );
        } else {
          Alert.alert('Error', data.error || 'Failed to link Sleeper account');
        }
        return;
      }

      // Refresh the user profile to get updated Sleeper info
      await refreshProfile();

      // Success - navigate to league selection
      Alert.alert(
        'Success!',
        `Your Sleeper account (@${username}) has been linked successfully.`,
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/onboarding/select-league')
          }
        ]
      );
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message || 'An unexpected error occurred');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Link Sleeper Account</Text>
        <Text style={styles.subtitle}>
          Enter your Sleeper.com username to connect your leagues
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Each Sleeper account can only be linked to one app account
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Sleeper Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your Sleeper username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLinkAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Link Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helpBox}>
            <Text style={styles.helpTitle}>Where to find your username:</Text>
            <Text style={styles.helpText}>
              1. Open the Sleeper app or website{'\n'}
              2. Go to your profile{'\n'}
              3. Your username is displayed at the top
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
  },
  infoText: {
    color: '#1976D2',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    color: '#1a1a1a',
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
