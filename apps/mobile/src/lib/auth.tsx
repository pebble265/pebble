import { clearMedAlarms } from './med-alarms';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  api,
  clearTokens,
  getRefreshToken,
  refreshSession,
  saveTokens,
  setSessionLostHandler,
} from './api';
import { getItem, setItem } from './storage';
import type { Tokens, User } from './types';

const REMEMBER_KEY = 'pebble.remember';

interface AuthState {
  isLoading: boolean;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(displayName: string, email: string, password: string): Promise<void>;
  /** id_token from the Google sign-in sheet. */
  signInWithGoogle(idToken: string): Promise<void>;
  /** Last step of Forget Password: sets the new password and signs in. */
  resetPassword(resetToken: string, newPassword: string): Promise<void>;
  /** "Remember me": when off, the session ends when the app is closed. */
  setRemember(remember: boolean): Promise<void>;
  signOut(): Promise<void>;
  /** Re-read the profile (e.g. after onboarding). */
  reloadUser(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const reloadUser = useCallback(async () => {
    setUser(await api<User>('/users/me'));
  }, []);

  // Restore the session on app start.
  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    (async () => {
      try {
        // "Remember me" was off last time: start signed out.
        if ((await getItem(REMEMBER_KEY)) === '0') {
          await clearTokens();
          await setItem(REMEMBER_KEY, null);
        }
        if ((await getRefreshToken()) && (await refreshSession())) {
          await reloadUser();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const t = await api<Tokens>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password, deviceInfo: 'Pebble app' },
      });
      await saveTokens(t);
      await reloadUser();
    },
    [reloadUser],
  );

  const signUp = useCallback(
    async (displayName: string, email: string, password: string) => {
      const t = await api<Tokens>('/auth/register', {
        method: 'POST',
        auth: false,
        body: { displayName: displayName.trim(), email: email.trim(), password, deviceInfo: 'Pebble app' },
      });
      await saveTokens(t);
      await reloadUser();
    },
    [reloadUser],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const t = await api<Tokens>('/auth/google', {
        method: 'POST',
        auth: false,
        body: { idToken, deviceInfo: 'Pebble app' },
      });
      await saveTokens(t);
      await reloadUser();
    },
    [reloadUser],
  );

  const resetPassword = useCallback(
    async (resetToken: string, newPassword: string) => {
      const t = await api<Tokens>('/auth/password/reset', {
        method: 'POST',
        auth: false,
        body: { resetToken, newPassword, deviceInfo: 'Pebble app' },
      });
      await saveTokens(t);
      await reloadUser();
    },
    [reloadUser],
  );

  const setRemember = useCallback(async (remember: boolean) => {
    await setItem(REMEMBER_KEY, remember ? null : '0');
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => {});
    }
    await clearTokens();
    await clearMedAlarms(); // the next person on this phone shouldn't get these alarms
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ isLoading, user, signIn, signUp, signInWithGoogle, resetPassword, setRemember, signOut, reloadUser }),
    [isLoading, user, signIn, signUp, signInWithGoogle, resetPassword, setRemember, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
