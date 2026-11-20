import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import { FText } from '../components/figma';
import { Avatar, LightScreen } from '../components/setup';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Create Account" (Welcome) from Figma, 1:1. Moves on by itself or on tap. */
export default function Welcome() {
  useTheme();
  useEffect(() => {
    const t = setTimeout(() => router.replace('/onboarding'), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <LightScreen>
      <Pressable
        onPress={() => router.replace('/onboarding')}
        accessibilityRole="button"
        accessibilityLabel="Create your pebble account"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <FText left={0} width={402} top={232} size={32} align="center" style={{ pointerEvents: 'none' }}>
        Welcome!
      </FText>
      <FText left={0} width={402} top={272} size={24} align="center" style={{ fontFamily: 'Thonburi', pointerEvents: 'none' }}>
        สวัสดี
      </FText>
      <Avatar left={144} top={331} />
      <FText left={0} width={402} top={465} size={32} align="center" style={{ pointerEvents: 'none' }}>
        {'Create your\npebble account'}
      </FText>
    </LightScreen>
  );
}
