import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
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
};

/** Bottom sheet built on a native modal: backdrop tap, back button and the close icon dismiss it. */
export function Sheet({ visible, onClose, title, subtitle, children, footer, tall, scroll = true }: SheetProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxHeight = height - insets.top - 24;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable accessibilityLabel="Kapat" style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, maxHeight, paddingBottom: footer ? 0 : insets.bottom + space.md },
            tall && { height: maxHeight },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
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
        </View>
      </KeyboardAvoidingView>
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
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: space.sm, marginBottom: space.xs },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  bodyFixed: { paddingHorizontal: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space.sm },
});
