/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  // `useColorScheme()` returns 'light' | 'dark' | null — collapse anything that
  // isn't an explicit 'dark' to 'light' so a null scheme never indexes Colors
  // with undefined (which would crash every consumer).
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
