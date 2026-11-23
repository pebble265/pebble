import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Splash } from '../components/splash';
import { AuthProvider, useAuth } from '../lib/auth';
import { firstSetup } from '../lib/first-setup';
import { colors } from '../theme';
import { ThemeProvider, useTheme } from '../lib/theme-mode';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <RootNavigator />
          <SplashGate />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

/** Branded splash on top of everything until the session check is done. */
function SplashGate() {
  const { isLoading } = useAuth();
  const [shown, setShown] = useState(true);
  const done = useCallback(() => setShown(false), []);
  return shown ? <Splash ready={!isLoading} onDone={done} /> : null;
}

/**
 * Three states, each with its own screens:
 *   signed out          -> sign-in / sign-up
 *   signed in, no consent -> onboarding
 *   ready               -> the app
 */
function RootNavigator() {
  const { setLightOnly, setLang } = useTheme();
  const { isLoading, user } = useAuth();
  // the account's language (Settings > Appearance) once signed in
  const userLang = user ? (user.locale?.startsWith('en') ? 'en' : 'th') : null;
  useEffect(() => {
    if (userLang) setLang(userLang);
  }, [userLang, setLang]);
  const isReady = !!user?.onboardedAt && !!user?.robotSetupAt;
  // dark mode is for the app itself; sign-in and first-run screens stay light like the design
  useEffect(() => setLightOnly(!isReady), [isReady, setLightOnly]);

  if (isLoading) return null;

  const signedIn = !!user;
  // First run after sign-in / sign-up: Welcome -> profile + consent -> connect the robot.
  const ready = signedIn && !!user.onboardedAt && !!user.robotSetupAt;
  // right after connecting the robot: pick medicines first, then All Set, then Home
  const home = !signedIn ? '/sign-in' : ready ? (firstSetup.pending ? '/setup-meds' : '/') : '/welcome';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      {/* Terms and Conditions: page sheet, reachable signed in or out */}
      <Stack.Screen name="terms" options={{ presentation: 'modal' }} />

      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen
          name="sign-up"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="sign-up-email" />
        <Stack.Screen name="forgot" />
        <Stack.Screen name="forgot-email" />
        <Stack.Screen name="forgot-verify" />
        <Stack.Screen name="forgot-new" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !ready} redirectTo={home}>
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="connect" options={{ animation: 'fade' }} />
        <Stack.Screen name="connect-code" options={{ animation: 'fade' }} />
      </Stack.Protected>

      {/* explicit targets, so a guarded route never falls back to the first route by name */}
      <Stack.Protected guard={ready} redirectTo={home}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="setup-meds" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="all-set" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="medication-new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meds-manage" />
        <Stack.Screen
          name="med-show"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="brief" />
        <Stack.Screen name="chat-history" />
        <Stack.Screen name="chat-log" />
        <Stack.Screen name="robot-test" />
        <Stack.Screen
          name="feel"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen
          name="quick-chat"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen
          name="schedule"
          options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack.Protected>
    </Stack>
  );
}
