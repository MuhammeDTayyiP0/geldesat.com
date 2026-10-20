import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { X } from 'lucide-react-native';
import { IconButton } from './Button';
import { Text } from './Text';
import { radius, space, useTheme } from './theme';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Fill most of the screen (long lists); otherwise the sheet hugs its content. */
  tall?: boolean;
  /** Wrap children in a ScrollView (default true). */
  scroll?: boolean;
  /**
   * Called once the sheet has slid out and its modal is gone. Open the next
   * modal, photo picker or camera from here, not from the row's onPress:
   * presenting one while this modal is still closing freezes the app.
   */
  onDismissed?: () => void;
};

/** Pull further than this (or flick faster than DISMISS_VELOCITY) and the sheet closes. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

/**
 * Bottom sheet on a native modal. Drag the handle or header down to dismiss;
 * the backdrop, back button and close icon dismiss it too. It slides out
 * before unmounting, whoever closes it.
 */
export function Sheet({ visible, onClose, title, subtitle, children, footer, tall, scroll = true, onDismissed }: SheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = height - insets.top - 24;

  // Stay mounted while the closing animation runs.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  const offset = useSharedValue(height);

  // After the modal has unmounted, give the native side a frame to tear it down.
  const wasMounted = useRef(mounted);
  const dismissed = useRef(onDismissed);
  useEffect(() => {
    dismissed.current = onDismissed;
  });
  useEffect(() => {
    if (wasMounted.current && !mounted) {
      const t = setTimeout(() => dismissed.current?.(), 60);
      wasMounted.current = mounted;
      return () => clearTimeout(t);
    }
    wasMounted.current = mounted;
  }, [mounted]);

  useEffect(() => {
    if (visible) {
      offset.set(withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
    } else {
      offset.set(
        withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, height, offset]);

  const drag = usePanGesture({
    activeOffsetY: 6,
    onUpdate: (e) => {
      'worklet';
      // Follow the finger down; resist a little when pulled up.
      offset.set(e.translationY > 0 ? e.translationY : e.translationY / 6);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        offset.set(withSpring(0, { damping: 22, stiffness: 260 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(offset.get(), [0, height * 0.6], [1, 0], 'clamp') }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <Animated.View style={[styles.backdrop, { backgroundColor: c.overlay }, backdropStyle]}>
            <Pressable accessibilityLabel="Kapat" style={styles.flex} onPress={onClose} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: c.surface, maxHeight, paddingBottom: footer ? 0 : insets.bottom + space.md },
              tall && { height: maxHeight },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View accessibilityHint="Kapatmak için aşağı kaydırın">
                <View style={styles.handleArea}>
                  <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
                </View>
                {title ? (
                  <View style={styles.header}>
                    <View style={styles.flex}>
                      <Text variant="subheading">{title}</Text>
                      {subtitle ? (
                        <Text variant="caption" tone="muted">
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <IconButton icon={X} label="Kapat" onPress={onClose} size={36} />
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            {scroll ? (
              <ScrollView
                style={tall ? styles.flex : undefined}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.flex, styles.bodyFixed]}>{children}</View>
            )}
            {footer ? (
              <View style={[styles.footer, { borderTopColor: c.border, paddingBottom: insets.bottom + space.md }]}>{footer}</View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  handleArea: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  bodyFixed: { paddingHorizontal: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space.sm },
});
