import { router } from 'expo-router';
import { DarkScreen, GradientText, HitArea, SETUP_BG } from '../components/setup';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Onboarding" from Figma: Hello, {name} — connect your first pebble(a)™. */
export default function ConnectHello() {
  useTheme();
  const { user } = useAuth();
  return (
    <DarkScreen bg={SETUP_BG.hello}>
      <GradientText left={35} top={512} width={340} size={40}>
        {`Hello, ${user?.displayName ?? ''}`}
      </GradientText>
      {/* the black "Connect →" button is part of the background */}
      <HitArea left={35} top={690} width={240} height={53} label="Connect" onPress={() => router.push('/connect-finding')} />
    </DarkScreen>
  );
}
