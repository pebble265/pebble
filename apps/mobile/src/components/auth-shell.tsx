import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';

/** Shared frame for sign-in / sign-up / onboarding. */
export function AuthShell({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={styles.brand}>
              <View style={styles.pebble} />
              <Text style={styles.wordmark}>
                pebble<Text style={{ color: colors.primary }}>(a)</Text>
              </Text>
            </View>
            <View style={{ gap: space.xs }}>
              <Text style={type.title}>{title}</Text>
              {subtitle ? <Text style={[type.body, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  inner: { gap: space.xl, width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pebble: {
    width: 30,
    height: 24,
    borderRadius: 14,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-12deg' }],
  },
  wordmark: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
});
