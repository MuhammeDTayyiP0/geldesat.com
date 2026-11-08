import { Alert, Platform } from 'react-native';

/** Native confirm dialog; resolves true when the person confirms. */
export function confirm({
  title,
  message,
  confirmText = 'Tamam',
  cancelText = 'Vazgeç',
  destructive,
  cancelable = true,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  /** false: on Android a tap outside or the back button does not count as "cancel" (a real choice is needed). */
  cancelable?: boolean;
}): Promise<boolean> {
  // react-native-web's Alert is a no-op; use the browser dialog there.
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.([title, message].filter(Boolean).join('\n\n')) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable, onDismiss: () => resolve(false) },
    );
  });
}
