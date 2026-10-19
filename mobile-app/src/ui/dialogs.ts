import { Alert, Platform } from 'react-native';

/** Native confirm dialog; resolves true when the person confirms. */
export function confirm({
  title,
  message,
  confirmText = 'Tamam',
  cancelText = 'Vazgeç',
  destructive,
}: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
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
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
