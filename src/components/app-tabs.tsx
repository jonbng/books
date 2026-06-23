import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { NudgePill } from '@/components/today/nudge-pill';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  // Android Material 3: the active-tab pill (`indicatorColor`) and the press
  // ripple (`rippleColor`) must read as *selection/feedback*, not background.
  // Using `backgroundSelected` made both ≈ the background, so pressing the
  // active tab painted a near-background wash over the accent icon and it
  // vanished. Tint them with the accent at low alpha instead: a soft clay pill
  // and a faint clay ripple that the icon stays legible against.
  const indicatorColor = `${colors.accent}33`; // ~20% accent — selection pill
  const rippleColor = `${colors.accent}1F`; // ~12% accent — press feedback

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      backgroundColor={colors.background}
      tintColor={colors.accent}
      iconColor={colors.textSecondary}
      indicatorColor={indicatorColor}
      rippleColor={rippleColor}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.BottomAccessory>
        <NudgePill />
      </NativeTabs.BottomAccessory>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'book.closed', selected: 'book.closed.fill' }}
          md="menu_book"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shelf">
        <NativeTabs.Trigger.Label>Shelf</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="library_books" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>Stats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
