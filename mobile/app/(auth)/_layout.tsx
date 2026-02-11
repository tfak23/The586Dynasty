import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  return (
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
        name="login" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="register" 
        options={{ 
          title: 'Create Account',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
        name="forgot-password" 
        options={{ 
          title: 'Forgot Password',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
        name="link-sleeper" 
        options={{ 
          title: 'Link Sleeper Account',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
        name="discover-leagues" 
        options={{ 
          title: 'Discover Leagues',
          headerBackTitle: 'Back',
        }} 
      />
    </Stack>
  );
}
