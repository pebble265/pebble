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
import type { Tokens, User } from './types';

interface AuthState {
  isLoading: boolean;
  user: User | null;
  signIn(email: string, password: string): Promise<void>;
  signUp(displayName: string, email: string, password: string): Promise<void>;
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

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(() => {});
    }
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ isLoading, user, signIn, signUp, signOut, reloadUser }),
    [isLoading, user, signIn, signUp, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
