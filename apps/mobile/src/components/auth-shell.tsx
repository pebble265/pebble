import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space, type } from '../theme';
import { Logo } from './ui';

/** Shared frame for sign-in / sign-up / onboarding: logo on top, big two-line title. */
export function AuthShell({
  title,
  subtitle,
  footer,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; footer?: ReactNode }>) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={{ alignItems: 'center', marginBottom: space.sm }}>
              <Logo size={20} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </View>
          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.lg },
  inner: { gap: space.xl, width: '100%', maxWidth: 440, alignSelf: 'center', flexGrow: 1 },
  title: { ...type.title, fontWeight: '500', fontSize: 27, lineHeight: 34 },
  subtitle: { fontSize: 27, lineHeight: 34, fontWeight: '500', color: colors.text, letterSpacing: -0.5 },
  footer: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingTop: space.xl },
});
