import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { font, radius, space, useTheme } from './theme';

/** Ref type of a TextInput (RN 0.88 exposes an instance type separate from the component). */
export type TextInputRef = ComponentRef<typeof TextInput>;

export type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  right?: ReactNode;
  suffix?: string;
  required?: boolean;
};

export const Input = forwardRef<TextInputRef, InputProps>(function Input(
  { label, hint, error, icon: Icon, right, suffix, required, multiline, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? c.danger : focused ? c.primary : c.border;
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
          {required ? <Text variant="label" tone="danger"> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: c.surface, minHeight: multiline ? 110 : 48, alignItems: multiline ? 'flex-start' : 'center' },
        ]}
      >
        {Icon ? <Icon size={18} color={c.subtle} style={multiline ? styles.iconTop : undefined} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.subtle}
          selectionColor={c.primary}
          multiline={multiline}
          secureTextEntry={secureTextEntry && hidden}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: c.fg, paddingVertical: multiline ? space.md : 0 }, style]}
          {...rest}
        />
        {suffix ? <Text tone="muted">{suffix}</Text> : null}
        {secureTextEntry ? (
          <Pressable accessibilityLabel={hidden ? 'Şifreyi göster' : 'Şifreyi gizle'} hitSlop={10} onPress={() => setHidden((h) => !h)}>
            {hidden ? <Eye size={18} color={c.subtle} /> : <EyeOff size={18} color={c.subtle} />}
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.below}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle" style={styles.below}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** A field-looking button that opens a picker (sheet) instead of the keyboard. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  error,
  required,
  icon: Icon,
  disabled,
}: {
  label?: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
  required?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
          {required ? <Text variant="label" tone="danger"> *</Text> : null}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: error ? c.danger : c.border,
            backgroundColor: pressed ? c.elevated : c.surface,
            minHeight: 48,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {Icon ? <Icon size={18} color={c.subtle} /> : null}
        <Text style={styles.selectText} tone={value ? 'default' : 'subtle'} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text tone="subtle">▾</Text>
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.below}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  label: { marginLeft: 2 },
  field: {
    flexDirection: 'row',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, fontSize: font.md, minHeight: 46 },
  iconTop: { marginTop: 14 },
  below: { marginLeft: 2 },
  selectText: { flex: 1 },
});
