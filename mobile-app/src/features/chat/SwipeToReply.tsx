import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Info, Reply } from 'lucide-react-native';
import { useTheme } from '@/ui';

/** How far to drag before letting go triggers the action. */
const TRIGGER = 64;
const MAX = 96;

function tick() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * WhatsApp-style message gestures: drag right to reply; drag your own message
 * left to see its details. Vertical scrolling wins over small diagonal moves.
 */
export function SwipeToReply({
  children,
  onReply,
  onInfo,
  disabled,
}: {
  children: ReactNode;
  onReply: () => void;
  /** Only for your own messages. */
  onInfo?: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const tx = useSharedValue(0);
  const armed = useSharedValue(0);
  const allowLeft = Boolean(onInfo);

  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: allowLeft ? [-14, 14] : 14,
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      let x = e.translationX;
      if (x < 0 && !allowLeft) x = 0;
      // Rubber band past the maximum.
      const sign = x < 0 ? -1 : 1;
      const abs = Math.abs(x);
      const eased = abs > MAX ? MAX + (abs - MAX) * 0.15 : abs;
      tx.set(sign * eased);
      const over = abs >= TRIGGER ? sign : 0;
      if (over !== armed.get()) {
        armed.set(over);
        if (over !== 0) scheduleOnRN(tick);
      }
    },
    onDeactivate: () => {
      'worklet';
      const state = armed.get();
      if (state > 0) scheduleOnRN(onReply);
      else if (state < 0 && onInfo) scheduleOnRN(onInfo);
      armed.set(0);
      tx.set(withSpring(0, { damping: 20, stiffness: 240 }));
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));
  const replyStyle = useAnimatedStyle(() => {
    const x = tx.get();
    return {
      opacity: interpolate(x, [0, TRIGGER], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(x, [0, TRIGGER, MAX], [0.5, 1, 1.1], 'clamp') }],
    };
  });
  const infoStyle = useAnimatedStyle(() => {
    const x = -tx.get();
    return {
      opacity: interpolate(x, [0, TRIGGER], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(x, [0, TRIGGER, MAX], [0.5, 1, 1.1], 'clamp') }],
    };
  });

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.icon, styles.left, { backgroundColor: c.elevated }, replyStyle]}>
        <Reply size={16} color={c.muted} />
      </Animated.View>
      {allowLeft ? (
        <Animated.View pointerEvents="none" style={[styles.icon, styles.right, { backgroundColor: c.elevated }, infoStyle]}>
          <Info size={16} color={c.muted} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: { left: 12 },
  right: { right: 12 },
});
