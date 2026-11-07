import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { Text } from './Text';
import { radius, shadow, space, useTheme } from './theme';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; kind: ToastKind };

/**
 * Every mounted host, bottom to top. A native modal covers the root host, so
 * sheets mount their own and the newest one shows the message.
 */
const hosts: ((item: ToastItem) => void)[] = [];
let seq = 0;
const push = (item: ToastItem) => hosts[hosts.length - 1]?.(item);

/** Show a short message at the top of the screen. */
export const toast = {
  success: (message: string) => push({ id: ++seq, message, kind: 'success' }),
  error: (message: string) => push({ id: ++seq, message, kind: 'error' }),
  info: (message: string) => push({ id: ++seq, message, kind: 'info' }),
};

/** `active`: take new messages. A closing sheet stops, so a toast shown as it closes lands on the screen below. */
export function ToastHost({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = (next: ToastItem) => {
      if (timer.current) clearTimeout(timer.current);
      anim.stopAnimation();
      setItem(next);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      AccessibilityInfo.announceForAccessibility(next.message);
      timer.current = setTimeout(() => {
        // Only this toast: a newer one shown during the fade must stay.
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
          setItem((current) => (current?.id === next.id ? null : current)),
        );
      }, next.kind === 'error' ? 4200 : 2600);
    };
    if (!active) return;
    hosts.push(show);
    return () => {
      hosts.splice(hosts.indexOf(show), 1);
    };
  }, [anim, active]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
        accessibilityRole="alert"
        accessibilityHint="Kapatmak için dokunun"
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
