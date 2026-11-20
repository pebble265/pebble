import { useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Text } from './text';

/** Common medicines with a one-line note (English, as in the Figma "Med Selected" screen). */
export const MEDS: { name: string; note: string }[] = [
  { name: 'Fluoxetine', note: 'It works by increasing the levels of serotonin etc.' },
  { name: 'Sertraline', note: 'used to treat major depression, OCD, PTSD, PMDD' },
  { name: 'Mirtazapine', note: 'used primarily to treat major depressive disorder.' },
  { name: 'Bupropion', note: 'medication primarily used to treat depression and aid in smoking cessation.' },
  { name: 'Duloxetine', note: 'Used to treat depression, anxiety, and chronic musculoskeletal pain.' },
  { name: 'Escitalopram', note: 'used to treat depression and generalized anxiety disorder.' },
  { name: 'Paroxetine', note: 'used for depression, panic disorder and social anxiety.' },
  { name: 'Venlafaxine', note: 'used for depression, anxiety and panic disorder.' },
  { name: 'Citalopram', note: 'used to treat depression.' },
  { name: 'Vortioxetine', note: 'used to treat major depressive disorder.' },
  { name: 'Agomelatine', note: 'used for depression; also helps the sleep cycle.' },
  { name: 'Trazodone', note: 'used for depression and trouble sleeping.' },
  { name: 'Amitriptyline', note: 'used for depression and nerve pain.' },
  { name: 'Nortriptyline', note: 'used for depression and nerve pain.' },
  { name: 'Quetiapine', note: 'used for bipolar disorder and as an add-on for depression.' },
  { name: 'Aripiprazole', note: 'add-on treatment for depression and bipolar disorder.' },
  { name: 'Lithium', note: 'mood stabilizer used for bipolar disorder.' },
  { name: 'Lamotrigine', note: 'mood stabilizer used in bipolar depression.' },
  { name: 'Clonazepam', note: 'used for panic disorder and anxiety.' },
  { name: 'Lorazepam', note: 'short-term relief of anxiety.' },
  { name: 'Alprazolam', note: 'short-term relief of anxiety and panic.' },
];

const ITEM = 58; // card + gap
const VISIBLE = 5;
// Figma: each card further down is narrower, smaller and fainter.
const STEPS = [0, 1, 2, 3, 4];
const SCALE = [1, 0.93, 0.87, 0.8, 0.76];
const FADE = [1, 0.95, 0.85, 0.5, 0.3];

/**
 * "or choose one of these": a stack of blue cards you can scroll through.
 * The card at the top is full size; cards below shrink and fade like the design.
 */
export function MedPicker({ items, onPick }: { items: { name: string; note: string }[]; onPick(name: string): void }) {
  const y = useRef(new Animated.Value(0)).current;
  const height = Math.min(items.length, VISIBLE) * ITEM;

  return (
    <View style={{ height }}>
      {/* soft blue glow behind the stack */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -40,
          right: -40,
          top: ITEM,
          height: ITEM * 5,
          backgroundImage: 'radial-gradient(ellipse at center, rgba(81,150,255,0.18) 0%, rgba(81,150,255,0) 70%)',
        }}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: ITEM * (VISIBLE - 1) }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}>
        {items.map((m, i) => {
          // position of this card relative to the top slot: 0 = top, 1 = next ...
          const pos = Animated.subtract(i, Animated.divide(y, ITEM));
          const scale = pos.interpolate({ inputRange: [-1, ...STEPS], outputRange: [1, ...SCALE], extrapolate: 'clamp' });
          const opacity = pos.interpolate({ inputRange: [-0.8, 0, ...STEPS.slice(1)], outputRange: [0, 1, ...FADE.slice(1)], extrapolate: 'clamp' });
          return (
            <Animated.View key={m.name} style={{ height: ITEM, justifyContent: 'center', opacity, transform: [{ scale }] }}>
              <Pressable
                onPress={() => onPick(m.name)}
                accessibilityRole="button"
                accessibilityLabel={m.name}
                style={({ pressed }) => ({
                  height: 50,
                  borderRadius: 20,
                  backgroundColor: '#5D9EF4',
                  backgroundImage: 'linear-gradient(90deg, #5AA6FF 0%, #6BA6F2 100%)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: 28,
                  paddingRight: 18,
                  gap: 12,
                  boxShadow: '0 4px 14px rgba(61,139,247,0.25)',
                  opacity: pressed ? 0.8 : 1,
                })}>
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '600', flexShrink: 0 }}>{m.name}</Text>
                <Text numberOfLines={2} style={{ flex: 1, color: '#FFF', fontSize: 10, textAlign: 'right', lineHeight: 13 }}>
                  {m.note}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}
