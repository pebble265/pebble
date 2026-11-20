# Pebble mobile app (Expo SDK 58)

## Run on your phone
1. Install **Expo Go** from the App Store / Play Store (must support SDK 58).
2. Find your Mac's Wi-Fi IP: `ipconfig getifaddr en0`
3. `cp .env.example .env` and set `EXPO_PUBLIC_API_URL=http://<that IP>:3000`
4. `npm install`
5. `npx expo start` and scan the QR code with the phone camera (iOS) or Expo Go (Android).
   Phone and Mac must be on the same Wi-Fi.

## Run in a browser (quick check)
`npx expo start --web` (needs the backend with CORS enabled — see apps/api/src/main.ts)

## Structure
- `src/app/` screens (Expo Router). `(tabs)/` = bottom tabs.
- `src/lib/api.ts` API client with automatic token refresh
- `src/lib/auth.tsx` sign in / sign up / session restore
- `src/components/ui.tsx` shared UI pieces
- `src/theme.ts` colors and spacing

## Spotify (music card on the "pebble" tab)
1. Go to https://developer.spotify.com/dashboard and **Create app**.
   - Redirect URI: `pebble://spotify`
   - APIs used: **Web API**
2. Copy the app's **Client ID** into `.env`: `EXPO_PUBLIC_SPOTIFY_CLIENT_ID=...`
3. While the Spotify app is in development mode, add each tester's Spotify email under
   **User Management** (Spotify only lets listed users sign in).
4. Rebuild the app. On the "pebble" tab tap **เชื่อม Spotify** and sign in.
   - Showing the current song works with any account.
   - Play / pause from Pebble needs **Spotify Premium**; otherwise the card opens Spotify.
   - Long-press the card to disconnect.
