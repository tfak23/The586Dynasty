import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/lib/theme';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Component to auto-load league on startup
function LeagueLoader() {
  const { currentLeague, setCurrentLeague, setTeams } = useAppStore();

  useEffect(() => {
    const loadLeague = async () => {
      // Skip if league already loaded
      if (currentLeague) return;
      
      try {
        // Fetch first available league
        const response = await api.get('/leagues');
        const leagues = response.data.data;
        
        if (leagues && leagues.length > 0) {
          setCurrentLeague(leagues[0]);
          
          // Also fetch teams
          const teamsRes = await api.get(`/teams/league/${leagues[0].id}`);
          setTeams(teamsRes.data.data);
        }
      } catch (error) {
        console.log('Could not auto-load league:', error);
      }
    };

    loadLeague();
  }, [currentLeague, setCurrentLeague, setTeams]);

  return null;
}

// Protected navigation - handles auth routing
function ProtectedNavigation() {
  const { user, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    // Redirect to login if not authenticated
    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } 
    // Redirect to link Sleeper if authenticated but no Sleeper account
    else if (user && !profile?.sleeper_username && !inOnboarding) {
      router.replace('/onboarding/link-sleeper');
    } 
    // Redirect to select league if in auth pages but already authenticated
    else if (user && profile?.sleeper_username && inAuthGroup) {
      router.replace('/onboarding/select-league');
    }
  }, [user, profile, loading, segments]);

  return (
    <>
      <LeagueLoader />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="auth/login" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="auth/signup" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="auth/forgot-password" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="onboarding/link-sleeper" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="onboarding/select-league" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="team/[id]" 
          options={{ 
            title: 'Team Details',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="contract/[id]" 
          options={{ 
            title: 'Contract Details',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="trade/[id]" 
          options={{ 
            title: 'Trade Details',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="trade/new" 
          options={{ 
            title: 'New Trade',
            presentation: 'modal',
          }} 
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ProtectedNavigation />
      </QueryClientProvider>
    </AuthProvider>
  );
}
