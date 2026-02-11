import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/lib/theme';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useAuthStore } from '@/lib/authStore';
import { api } from '@/lib/api';
import { router } from 'expo-router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Component to initialize auth and auto-load league
function AppInitializer() {
  const { currentLeague, setCurrentLeague, setTeams } = useAppStore();
  const { isAuthenticated, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    // Initialize auth state from storage
    initialize();
  }, []);

  useEffect(() => {
    if (isInitializing) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }

    // Load league if authenticated
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
  }, [isInitializing, isAuthenticated, currentLeague, setCurrentLeague, setTeams]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInitializer />
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
          name="(auth)" 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="(tabs)" 
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
    </QueryClientProvider>
  );
}
