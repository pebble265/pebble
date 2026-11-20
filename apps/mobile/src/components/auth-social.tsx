import { SocialButton } from './figma';
import { googleConfigured, googleNotConfigured, useGoogleSignIn } from '../lib/social';

type Pos = { left: number; top: number };
type ButtonSpec = { rect: Pos; icon: Pos & { size: number }; textRight: number; label: string; bg?: string };

function GoogleButtonLive(spec: ButtonSpec) {
  const google = useGoogleSignIn();
  return <SocialButton kind="google" {...spec} onPress={google.start} busy={google.busy} />;
}

export function GoogleButton(spec: ButtonSpec) {
  if (!googleConfigured) return <SocialButton kind="google" {...spec} onPress={googleNotConfigured} />;
  return <GoogleButtonLive {...spec} />;
}
