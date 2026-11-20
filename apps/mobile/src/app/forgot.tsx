import { router } from 'expo-router';
import { FButton, FORGOT_BG, ForgotScreen, PwIcon } from '../components/forgot';
import { FText } from '../components/figma';
import { colors } from '../theme';
import { useTheme } from '../lib/theme-mode';

/** "pebble(a) - Forget Password Select" from Figma, 1:1. */
export default function ForgotSelect() {
  useTheme();
  return (
    <ForgotScreen bg={FORGOT_BG.select}>
      <PwIcon left={153} top={298} size={95} q={{ cx: 95, cy: 63, font: 24 }} />

      <FText left={0} width={402} top={387} size={24} align="center">
        Forget your Password?
      </FText>
      <FText left={0} width={402} top={417} size={14} align="center">
        Don’t worry let’s fix this out.
      </FText>

      <FButton left={32} top={453} width={334} label="Reset Password." onPress={() => router.push('/forgot-email')} />
      <FButton left={32} top={498} width={334} label="No, I’m not." bg="#FDFDFD" color={colors.ink} onPress={() => router.back()} />
    </ForgotScreen>
  );
}
