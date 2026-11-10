import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

/** How long the splash stays up at minimum, so it reads as a moment, not a flicker. */
const MIN_MS = 1400;

/**
 * "pebble(a) - splash screen" from Figma. The native splash shows the same logo
 * at the same spot, so the hand-over is invisible; this one adds the tagline,
 * waits until the app is ready, then fades out.
 */
export function Splash({ ready, onDone }: { ready: boolean; onDone(): void }) {
  const fade = useRef(new Animated.Value(1)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(fade, { toValue: 0, duration: 380, useNativeDriver: true }).start(() => onDone());
  }, [ready, minElapsed, fade, onDone]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade }]}
      onLayout={() => {
        SplashScreen.hideAsync().catch(() => {});
        Animated.timing(tagline, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }).start();
      }}
      accessibilityLabel="pebble — Mindful. Always.">
      <Image source={require('../../assets/images/splash-logo.png')} style={styles.logo} resizeMode="contain" />
      <Animated.Text
        style={[
          styles.tagline,
          { opacity: tagline, transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        ]}>
        Mindful. Always.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  logo: { width: 150, height: 150 },
  tagline: {
    position: 'absolute',
    bottom: 76,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.text,
  },
});
