import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Info, Reply } from 'lucide-react-native';
import { useTheme } from '@/ui';

/** How far to drag before letting go triggers the action. */
const TRIGGER = 64;
const MAX = 96;
/**
 * Left strip that belongs to "go back" (the chat screen lets iOS swipe-back
 * start anywhere in it, see BACK_SWIPE_END), and the right strip Android
 * gesture navigation uses. A drag starting here is never a reply. The rows
 * span the full list width, so these are measured from the screen edges.
 */
export const BACK_SWIPE_ZONE = 60;
const RIGHT_EDGE = 30;
/**
 * iOS decides on swipe-back once the finger has moved ~10pt, so its strip is a
 * little wider than ours: a back swipe that starts at the zone's border still
 * counts, and every drag starting past the border is a reply.
 */
export const BACK_SWIPE_END = BACK_SWIPE_ZONE + 16;

function tick() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * WhatsApp-style message gestures: drag right to reply; drag your own message
 * left to see its details. Vertical scrolling wins over small diagonal moves,
 * and drags from the screen edge are left to the back gesture.
 */
export function SwipeToReply({
  children,
  onReply,
  onInfo,
  disabled,
  mine,
}: {
  /** Gets the layout callback for the bubble, so the reply icon can sit right next to it. */
  children: (onBubbleLayout: (e: LayoutChangeEvent) => void) => ReactNode;
  /** Your own message, on the right: the reply icon appears just left of it, not at the screen edge. */
  mine?: boolean;
  onReply: () => void;
  /** Only for your own messages. */
  onInfo?: () => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const tx = useSharedValue(0);
  const armed = useSharedValue(0);
  const allowLeft = Boolean(onInfo);
  const [bubbleX, setBubbleX] = useState<number | null>(null);
  const onBubbleLayout = useCallback((e: LayoutChangeEvent) => setBubbleX(e.nativeEvent.layout.x), []);
  // The bubble row has an 8px side padding; the 32px icon sits 8px before the bubble.
  const replyLeft = mine && bubbleX != null ? Math.max(12, bubbleX - 32) : 12;

  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: allowLeft ? [-14, 14] : 14,
    failOffsetY: [-12, 12],
    hitSlop: { left: -BACK_SWIPE_ZONE, right: -RIGHT_EDGE },
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
    onDeactivate: (e) => {
      'worklet';
      // Cancelled means something else (the back gesture, the list) took over.
      const state = e.canceled ? 0 : armed.get();
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
      <Animated.View pointerEvents="none" style={[styles.icon, { left: replyLeft, backgroundColor: c.elevated }, replyStyle]}>
        <Reply size={16} color={c.muted} />
      </Animated.View>
      {allowLeft ? (
        <Animated.View pointerEvents="none" style={[styles.icon, styles.right, { backgroundColor: c.elevated }, infoStyle]}>
          <Info size={16} color={c.muted} />
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children(onBubbleLayout)}</Animated.View>
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
  right: { right: 12 },
});
