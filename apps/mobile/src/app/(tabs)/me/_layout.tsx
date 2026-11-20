import { Stack } from 'expo-router';
import { colors } from '../../../theme';
import { useTheme } from '../../../lib/theme-mode';

/** User tab: main page plus its sub-pages, all under the same tab bar. */
export default function MeLayout() {
  useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}
