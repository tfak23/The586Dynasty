import { Redirect } from 'expo-router';
import { useAuthStore } from '@/lib/authStore';

export default function Index() {
  const { isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return null; // or a loading screen
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
