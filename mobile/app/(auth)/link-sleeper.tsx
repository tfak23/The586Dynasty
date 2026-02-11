import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/theme';
import { useAuthStore } from '@/lib/authStore';
import { linkSleeperAccount } from '@/lib/api';

export default function LinkSleeperScreen() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { updateUser } = useAuthStore();

  const handleLink = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter your Sleeper username');
      return;
    }

    setIsLoading(true);
    try {
      const response = await linkSleeperAccount(username);
      updateUser({
        has_sleeper_account: true,
        sleeper_username: response.data.data.sleeper_username,
        sleeper_user_id: response.data.data.sleeper_user_id,
      });
      Alert.alert('Success', 'Sleeper account linked successfully!');
      router.replace('/(auth)/discover-leagues');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not link Sleeper account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Link Sleeper Account</Text>
        <Text style={styles.subtitle}>
          Enter your Sleeper.com username to connect your account
        </Text>
        <Text style={styles.note}>
          Note: One Sleeper account can only be linked to one app account
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Sleeper Username"
          placeholderTextColor={colors.textSecondary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLink}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Link Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(auth)/discover-leagues')}
        >
          <Text style={styles.skipText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  note: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 12,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
