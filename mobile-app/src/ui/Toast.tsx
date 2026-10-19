import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { Text } from './Text';
import { radius, shadow, space, useTheme } from './theme';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; kind: ToastKind };

let push: ((item: ToastItem) => void) | null = null;
let seq = 0;

/** Show a short message at the top of the screen. */
export const toast = {
  success: (message: string) => push?.({ id: ++seq, message, kind: 'success' }),
  error: (message: string) => push?.({ id: ++seq, message, kind: 'error' }),
  info: (message: string) => push?.({ id: ++seq, message, kind: 'info' }),
};

export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    push = (next) => {
      if (timer.current) clearTimeout(timer.current);
      setItem(next);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setItem(null));
      }, next.kind === 'error' ? 4200 : 2600);
    };
    return () => {
      push = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim]);

  if (!item) return null;
  const Icon = item.kind === 'success' ? CircleCheck : item.kind === 'error' ? CircleAlert : Info;
  const color = item.kind === 'success' ? c.ok : item.kind === 'error' ? c.danger : c.primary;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + space.sm,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <Pressable
        accessibilityLiveRegion="polite"
        onPress={() => setItem(null)}
        style={[styles.toast, { backgroundColor: c.ink }, shadow(2)]}
      >
        <Icon size={18} color={color === c.primary ? '#8fb0ff' : color} />
        <Text variant="label" style={[styles.text, { color: c.bg }]}>
          {item.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    maxWidth: 480,
  },
  text: { flexShrink: 1 },
});
