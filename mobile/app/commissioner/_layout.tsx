import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function CommissionerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="roster" />
      <Stack.Screen name="cap" />
      <Stack.Screen name="trade" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="history" />
      <Stack.Screen name="rules" />
    </Stack>
  );
}
