import { createContext, useContext, type ReactNode, type Ref } from 'react';
import {
  Alert as RNAlert,
  type AlertButton,
  type AlertOptions,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { getLang, t } from '../lib/i18n';
import { colors } from '../theme';

/**
 * Drop-in Text / TextInput / Alert that show the app in the chosen language.
 * Screens import these instead of the react-native ones (same props).
 */
function translate(children: ReactNode): ReactNode {
  if (getLang() === 'th') return children;
  if (typeof children === 'string') return t(children);
  if (Array.isArray(children)) {
    // "แบตเตอรี่ | " + "25%": try the whole sentence first, then piece by piece
    if (children.every((c) => typeof c === 'string' || typeof c === 'number')) {
      const joined = children.join('');
      const whole = t(joined);
      if (whole !== joined) return whole;
    }
    return children.map((c) => (typeof c === 'string' ? t(c) : c));
  }
  return children;
}

/** true inside one of our <Text>s: nested text inherits its parent's colour instead of the default. */
const InText = createContext(false);

export function Text({ children, style, ...props }: TextProps) {
  const nested = useContext(InText);
  // Unstyled text would be black (React Native's default) and vanish in dark mode: default to the theme's text colour.
  const withDefault = nested ? style : [{ color: colors.text }, style];
  return (
    <InText.Provider value>
      <RNText {...props} style={withDefault}>
        {translate(children)}
      </RNText>
    </InText.Provider>
  );
}

export function TextInput({ placeholder, style, ...props }: TextInputProps & { ref?: Ref<TextInputInstance> }) {
  return (
    <RNTextInput
      placeholder={placeholder ? t(placeholder) : placeholder}
      placeholderTextColor={colors.faint}
      {...props}
      style={[{ color: colors.text }, style]}
    />
  );
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    RNAlert.alert(
      t(title),
      message ? t(message) : message,
      buttons?.map((b) => ({ ...b, ...(b.text && { text: t(b.text) }) })),
      options,
    );
  },
  prompt: RNAlert.prompt,
};
