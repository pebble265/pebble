import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/text';
import { GoogleButton } from '../components/auth-social';
import { At, FigmaFrame, FText, SocialButton, useFigmaScale, useS } from '../components/figma';
import { learnMore } from '../lib/about';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/**
 * "pebble(a) - Sign-Up" sheet from Figma: shown over the Sign-In screen, which
 * is blurred (3px) and dimmed with #848484 at 20%.
 */
function Sheet({ onClose }: { onClose(): void }) {
  const s = useS();
  return (
    <>
      <At left={0} top={372} width={402} height={517} style={{ backgroundColor: colors.surface, borderRadius: s(50) }} />

      <At left={335} top={408} width={26} height={26}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close-circle-outline" size={s(26)} color={colors.ink} style={{ marginTop: -s(0.5) }} />
        </Pressable>
      </At>

      <FText left={53} top={419} size={32}>
        Let’s Sign-Up
      </FText>
      <FText left={241} top={416} size={40}>
        🤩
      </FText>
      <FText left={53} top={457} size={32}>
        Relax, and feel free
      </FText>
      <FText left={53} top={495} size={32}>
        to be here!
      </FText>

      <GoogleButton
        label="Sign-Up with google"
        rect={{ left: 42, top: 573 }}
        icon={{ left: 73, top: 596, size: 18 }}
        textRight={18}
        bg="#FDFDFD"
      />
      <SocialButton
        kind="email"
        label="Sign-Up with Email"
        rect={{ left: 42, top: 654 }}
        icon={{ left: 73, top: 676, size: 20 }}
        textRight={18}
        onPress={() => router.replace('/sign-up-email')}
      />

      <At left={0} width={402} top={800} height={16}>
        <Pressable
          onPress={learnMore}
          accessibilityRole="link"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="information-circle-outline" size={s(14)} color={colors.ink} />
          <Text style={{ fontSize: s(12), color: colors.ink, marginLeft: s(2) }}>Learn more about pebble</Text>
        </Pressable>
      </At>
    </>
  );
}

export default function SignUpSheet() {
  useTheme();
  const k = useFigmaScale();
  const slide = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  function close() {
    Animated.timing(slide, { toValue: 1, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
      router.back(),
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* The Sign-In screen underneath shows through, blurred and dimmed. */}
      <BlurView intensity={12} tint="default" style={StyleSheet.absoluteFill} />
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(132,132,132,0.2)' }]} onPress={close} accessibilityLabel="Close" />
      <Animated.View
        pointerEvents="box-none"
        style={{ transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 520 * k] }) }] }}>
        <FigmaFrame style={{ backgroundColor: 'transparent' }}>
          <Sheet onClose={close} />
        </FigmaFrame>
      </Animated.View>
    </View>
  );
}
