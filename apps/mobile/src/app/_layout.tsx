import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Three states, each with its own screens:
 *   signed out          -> sign-in / sign-up
 *   signed in, no consent -> onboarding
 *   ready               -> the app
 */
function RootNavigator() {
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = !!user;
  const ready = signedIn && !!user.onboardedAt;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !ready}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="medication-new"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'เพิ่มยา',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.primary,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
