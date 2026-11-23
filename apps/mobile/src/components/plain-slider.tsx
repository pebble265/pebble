import { useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, View } from 'react-native';
import { colors } from '../theme';

/** Small dependency-free slider: drag or tap along the track. onDone fires when the finger lifts. */
export default function PlainSlider({
  value,
  min,
  max,
  onChange,
  onDone,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
  onDone?(v: number): void;
  disabled?: boolean;
}) {
  const [w, setW] = useState(1);
  const width = useRef(1);
  const last = useRef(value);
  const props = useRef({ min, max, onChange, onDone, disabled });
  props.current = { min, max, onChange, onDone, disabled };

  const at = (x: number) => {
    const { min: lo, max: hi } = props.current;
    const k = Math.max(0, Math.min(1, x / width.current));
    return Math.round(lo + k * (hi - lo));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !props.current.disabled,
      onMoveShouldSetPanResponder: () => !props.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        last.current = at(e.nativeEvent.locationX);
        props.current.onChange(last.current);
      },
      onPanResponderMove: (e) => {
        last.current = at(e.nativeEvent.locationX);
        props.current.onChange(last.current);
      },
      onPanResponderRelease: () => props.current.onDone?.(last.current),
    }),
  ).current;

  const k = (value - min) / (max - min || 1);
  return (
    <View
      style={{ flex: 1, height: 32, justifyContent: 'center' }}
      onLayout={(e: LayoutChangeEvent) => {
        width.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}>
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: colors.line }}>
        <View style={{ width: k * w, height: 6, borderRadius: 3, backgroundColor: colors.blue }} />
      </View>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: Math.max(0, k * w - 11), width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
      />
    </View>
  );
}
