import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Top inset to clear the status bar / notch on the tab screens.
 *
 * Each tab's first ScrollView uses `contentInsetAdjustmentBehavior="automatic"`
 * (DESIGN-UI.md §8), which insets content below the status bar on iOS — but is a
 * no-op on Android, where SDK 56 draws edge-to-edge by default and content slides
 * up under the clock. So on Android we add the measured inset ourselves; on iOS
 * it returns 0 to avoid double-padding on top of the automatic behavior.
 */
export function useStatusBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' ? insets.top : 0;
}
