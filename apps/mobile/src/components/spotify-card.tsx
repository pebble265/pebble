import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, View } from 'react-native';
import { Alert, Text } from './text';
import {
  connectSpotify,
  disconnectSpotify,
  isSpotifyConnected,
  mmss,
  nowPlaying,
  openInSpotify,
  spotifyConfigured,
  SpotifyNotConnected,
  togglePlay,
  type Track,
} from '../lib/spotify';
import { colors } from '../theme';
import { useS } from './figma';

const GREEN = '#1DB954';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/**
 * The music card on the "pebble" tab (Figma: album art, "Moonlight", "BADI Z", 3:09, play).
 * Shows what is playing on the user's Spotify; tap play/pause, tap the card to open Spotify,
 * long-press to disconnect.
 */
export function SpotifyCard() {
  const s = useS();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTrack(await nowPlaying());
      setConnected(true);
    } catch (e) {
      if (e instanceof SpotifyNotConnected) setConnected(false);
    }
  }, []);

  useEffect(() => {
    isSpotifyConnected().then((c) => {
      setConnected(c);
      if (c) void refresh();
    });
  }, [refresh]);

  // keep it fresh while the tab is open
  useFocusEffect(
    useCallback(() => {
      if (connected) {
        void refresh();
        timer.current = setInterval(refresh, 15_000);
      }
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [connected, refresh]),
  );

  async function connect() {
    if (!spotifyConfigured) {
      return notify('เชื่อม Spotify', 'ยังไม่ได้ตั้งค่า Spotify ในแอป (ต้องใส่ EXPO_PUBLIC_SPOTIFY_CLIENT_ID ตามขั้นตอนใน README)');
    }
    setBusy(true);
    try {
      if (await connectSpotify()) {
        setConnected(true);
        await refresh();
      }
    } catch (e) {
      notify('เชื่อม Spotify ไม่สำเร็จ', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function play() {
    setBusy(true);
    try {
      const r = await togglePlay(track);
      if (r === 'premium') notify('Spotify', 'การกดเล่น/หยุดจากแอปอื่นต้องใช้ Spotify Premium จะเปิดเพลงใน Spotify ให้แทน');
      if (r !== 'ok') openInSpotify(track);
      setTimeout(refresh, 700);
    } catch (e) {
      if (e instanceof SpotifyNotConnected) setConnected(false);
    } finally {
      setBusy(false);
    }
  }

  function askDisconnect() {
    const go = async () => {
      await disconnectSpotify();
      setConnected(false);
      setTrack(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('ยกเลิกการเชื่อม Spotify?')) void go();
    } else {
      Alert.alert('ยกเลิกการเชื่อม Spotify?', undefined, [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ยกเลิกการเชื่อม', style: 'destructive', onPress: () => void go() },
      ]);
    }
  }

  const art = (
    <View style={{ width: s(36), height: s(36), borderRadius: s(6), backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {track?.art ? (
        <Image source={{ uri: track.art }} style={{ width: s(36), height: s(36) }} />
      ) : (
        <Ionicons name="musical-notes" size={s(18)} color={connected ? GREEN : colors.muted} />
      )}
    </View>
  );

  if (!connected) {
    return (
      <Pressable
        onPress={connect}
        disabled={busy || connected === null}
        accessibilityRole="button"
        accessibilityLabel="เชื่อม Spotify"
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(7), gap: s(7) }}>
        {art}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: s(6), color: colors.muted }}>เพลง</Text>
          <Text numberOfLines={1} style={{ fontSize: s(11), fontWeight: '700', color: colors.ink }}>
            เชื่อม Spotify
          </Text>
          <Text style={{ fontSize: s(7), color: colors.muted }}>แตะเพื่อเข้าสู่ระบบ</Text>
        </View>
        {busy ? <ActivityIndicator size="small" /> : <Ionicons name="link" size={s(13)} color={GREEN} />}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => openInSpotify(track)}
      onLongPress={askDisconnect}
      accessibilityRole="button"
      accessibilityLabel={track ? `${track.title} โดย ${track.artist} เปิดใน Spotify` : 'เปิด Spotify'}
      accessibilityHint="กดค้างเพื่อยกเลิกการเชื่อม"
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(7), gap: s(7) }}>
      {art}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: s(6), color: colors.muted }}>
          {track ? (track.isPlaying ? 'กำลังเล่นบน Spotify' : track.recent ? 'เล่นล่าสุดบน Spotify' : 'หยุดไว้บน Spotify') : 'Spotify'}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: s(11), fontWeight: '700', color: colors.ink }}>
          {track?.title ?? 'ยังไม่มีเพลง'}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: s(7), fontWeight: '600', color: colors.ink }}>
          {track?.artist ?? ''}
        </Text>
        {track ? <Text style={{ fontSize: s(7), color: colors.muted }}>{mmss(track.durationMs)}</Text> : null}
      </View>
      <Pressable onPress={play} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel={track?.isPlaying ? 'หยุด' : 'เล่น'}>
        {busy ? <ActivityIndicator size="small" /> : <Ionicons name={track?.isPlaying ? 'pause' : 'play'} size={s(14)} color={colors.ink} />}
      </Pressable>
    </Pressable>
  );
}
