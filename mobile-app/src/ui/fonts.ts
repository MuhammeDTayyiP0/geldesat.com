import * as Font from 'expo-font';

export const FONT_FAMILY = {
  regular: 'IBMPlexSans-Regular',
  medium: 'IBMPlexSans-Medium',
  semibold: 'IBMPlexSans-SemiBold',
  bold: 'IBMPlexSans-Bold',
} as const;

/** Loads bundled IBM Plex Sans faces before hiding the splash screen. */
export async function loadFonts(): Promise<void> {
  try {
    await Font.loadAsync({
      [FONT_FAMILY.regular]: require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
      [FONT_FAMILY.medium]: require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
      [FONT_FAMILY.semibold]: require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
      [FONT_FAMILY.bold]: require('../../assets/fonts/IBMPlexSans-Bold.ttf'),
    });
  } catch {
    // Missing or unreadable font assets must never prevent startup; system font stays as fallback.
  }
}
