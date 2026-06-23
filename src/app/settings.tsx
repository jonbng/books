import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useConfirm } from '@/components/confirm/confirm-provider';
import { Paper, PaperBackground } from '@/components/paper';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast/toast-provider';
import {
  type ColorSchemePreference,
  Elevation,
  FontFamily,
  Spacing,
  Type,
} from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { logError, toUserMessage } from '@/lib/errors';
import { hasPermission, isReminderSupported, requestPermissions } from '@/services/notifications';

const TARGET_OPTIONS = [4, 5, 6, 7];

// Matches the destructive tint used by the confirm dialog.
const DESTRUCTIVE = '#B4442E';

// Outward-facing links. Replace the placeholders with the real URLs before
// shipping — they're centralized here so there's one place to update.
const SUPPORT_EMAIL = 'hello@books.app';
const WEBSITE_URL = 'https://books.app';
const PRIVACY_URL = 'https://books.app/privacy';
const TERMS_URL = 'https://books.app/terms';
const APP_STORE_URL = 'https://apps.apple.com/app/id000000000';
const PLAY_STORE_URL = 'market://details?id=dk.jonathanb.books';

const THEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const data = useAppData();
  const confirm = useConfirm();
  const theme = useTheme();
  const { show: showToast } = useToast();
  const s = data.settings;

  // Settings writes are optimistic (the control tracks the tap, then a reload
  // reconciles). If the write fails the reload never lands, so the toggle would
  // silently show a value that isn't saved — surface that instead of swallowing.
  function save(p: Promise<unknown>) {
    void p.catch((err) => {
      logError('settings.save', err);
      showToast('Couldn’t save that change. Please try again.');
    });
  }

  if (!s) {
    return (
      <PaperBackground style={styles.loading}>
        <ScreenHeader title="Settings" />
      </PaperBackground>
    );
  }

  const time = `${String(s.reminderHour).padStart(2, '0')}:${String(s.reminderMinute).padStart(2, '0')}`;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  function setReminderTime(hourDelta: number, minuteCycle: boolean) {
    if (!s) return;
    let hour = s.reminderHour;
    let minute = s.reminderMinute;
    if (minuteCycle) {
      minute = (minute + 15) % 60;
    } else {
      hour = (hour + hourDelta + 24) % 24;
    }
    save(data.setReminder({ enabled: s.reminderEnabled, hour, minute }));
  }

  function changeYearly(delta: number) {
    if (!s) return;
    const base = s.yearlyGoal ?? 12;
    save(data.setYearlyGoal(Math.max(1, base + delta)));
  }

  function pickTheme(preference: ColorSchemePreference) {
    if (preference === s?.themePreference) return;
    void Haptics.selectionAsync();
    save(data.setThemePreference(preference));
  }

  function handleExport() {
    const json = data.exportData();
    if (!json) return;
    // The OS share sheet handles where it goes (Files, AirDrop, email, …).
    void Share.share({ message: json }).catch(() => {});
  }

  async function handleReset() {
    const ok = await confirm({
      title: 'Reset all data?',
      message:
        'This permanently erases your books, reading history, sessions, and stats. This can’t be undone.',
      confirmLabel: 'Reset everything',
      destructive: true,
    });
    if (!ok) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await data.resetAllData();
    } catch (err) {
      logError('settings.handleReset', err);
      showToast(toUserMessage(err, 'Couldn’t reset your data. Please try again.'));
    }
  }

  function handleRate() {
    void Linking.openURL(Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL).catch(() => {});
  }

  function handleShareApp() {
    void Share.share({
      message: `I’m building a reading habit with Books — a calm, private reading tracker. ${WEBSITE_URL}`,
    }).catch(() => {});
  }

  function handleFeedback() {
    const body = `\n\n—\nBooks ${version} · ${Platform.OS} ${Platform.Version}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      'Books feedback'
    )}&body=${encodeURIComponent(body)}`;
    void Linking.openURL(url).catch(() => {});
  }

  return (
    <PaperBackground>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Goals -------------------------------------------------------------- */}
        <Section title="GOALS">
          {/* Weekly goal */}
          <Paper style={styles.card}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>WEEKLY GOAL</Text>
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              How many days a week you aim to read. Miss it and a banked freeze covers the week
              automatically.
            </Text>
            <View style={styles.chips}>
              {TARGET_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={String(t)}
                  active={t === s.weeklyTarget}
                  onPress={() => save(data.setWeeklyTarget(t))}
                />
              ))}
              <Text style={[styles.chipSuffix, { color: theme.textSecondary }]}>days / week</Text>
            </View>
          </Paper>

          {/* Yearly reading goal */}
          <Paper style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>YEARLY GOAL</Text>
              <Switch
                accessibilityLabel="Yearly reading goal"
                value={s.yearlyGoal != null}
                onValueChange={(on) => save(data.setYearlyGoal(on ? 12 : null))}
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.backgroundSelected}
              />
            </View>
            {s.yearlyGoal != null ? (
              <View style={styles.timeRow}>
                <Stepper label="−6" onPress={() => changeYearly(-6)} />
                <Stepper label="−1" onPress={() => changeYearly(-1)} />
                <Text style={[styles.time, { color: theme.text }]}>
                  {s.yearlyGoal} <Text style={{ color: theme.textSecondary }}>books</Text>
                </Text>
                <Stepper label="+1" onPress={() => changeYearly(1)} />
                <Stepper label="+6" onPress={() => changeYearly(6)} />
              </View>
            ) : (
              <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                An encouraging target for the year — never a guilt meter.
              </Text>
            )}
          </Paper>
        </Section>

        {/* Reminders ---------------------------------------------------------- */}
        <Section title="REMINDERS">
          <Paper style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
                READING REMINDER
              </Text>
              <Switch
                accessibilityLabel="Daily reminder"
                value={s.reminderEnabled}
                onValueChange={(enabled) =>
                  save(data.setReminder({ enabled, hour: s.reminderHour, minute: s.reminderMinute }))
                }
                trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.backgroundSelected}
              />
            </View>
            {s.reminderEnabled ? (
              <>
                <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                  A gentle daily nudge at this time that quietly eases off when you’re away — and
                  stops nagging once you’ve clearly taken a break.
                </Text>
                <View style={styles.timeRow}>
                  <Stepper label="Hour −" onPress={() => setReminderTime(-1, false)} />
                  <Stepper label="Hour +" onPress={() => setReminderTime(1, false)} />
                  <Text style={[styles.time, { color: theme.text }]}>{time}</Text>
                  <Stepper label="Min +15" onPress={() => setReminderTime(0, true)} />
                </View>
              </>
            ) : (
              <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
                A gentle nudge to read, at a time you choose.
              </Text>
            )}
            <PermissionRow enabled={s.reminderEnabled} />
          </Paper>
        </Section>

        {/* Appearance --------------------------------------------------------- */}
        <Section title="APPEARANCE">
          <Paper style={styles.card}>
            <Segmented value={s.themePreference} options={THEME_OPTIONS} onChange={pickTheme} />
            <Text style={[styles.cardHint, { color: theme.textSecondary }]}>
              How Books looks. “System” follows your device’s light or dark setting.
            </Text>
          </Paper>
        </Section>

        {/* Data --------------------------------------------------------------- */}
        <Section title="YOUR DATA">
          <Group>
            <Row icon="download-outline" label="Export a backup" onPress={handleExport} />
            <Divider />
            <Row icon="trash-outline" label="Reset all data" destructive onPress={handleReset} />
          </Group>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Books keeps everything on this device — no account, no cloud. A backup is a plain JSON
            copy you can save anywhere.
          </Text>
        </Section>

        {/* About -------------------------------------------------------------- */}
        <Section title="ABOUT">
          <Group>
            <Row icon="star-outline" label="Rate Books" onPress={handleRate} />
            <Divider />
            <Row icon="share-social-outline" label="Tell a friend" onPress={handleShareApp} />
            <Divider />
            <Row icon="mail-outline" label="Send feedback" onPress={handleFeedback} />
            <Divider />
            <Row
              icon="lock-closed-outline"
              label="Privacy Policy"
              external
              onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
            />
            <Divider />
            <Row
              icon="document-text-outline"
              label="Terms of Use"
              external
              onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}
            />
          </Group>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Book covers and details from Open Library. Version {version}.
          </Text>
        </Section>
      </ScrollView>
    </PaperBackground>
  );
}

/** OS notification permission state, surfaced when the reminder needs it. */
function PermissionRow({ enabled }: { enabled: boolean }) {
  const theme = useTheme();
  const [granted, setGranted] = useState<boolean | null>(null);
  const supported = isReminderSupported();

  const refresh = useCallback(() => {
    if (!supported) return;
    void hasPermission().then(setGranted);
  }, [supported]);

  useEffect(() => refresh(), [refresh]);

  // Returning from system settings should reflect a permission they just changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!supported || !enabled || granted !== false) {
    // Only worth showing when reminders are on but the OS is blocking them.
    return null;
  }

  async function enable() {
    const ok = await requestPermissions();
    setGranted(ok);
    // Already denied → the OS won't re-prompt, so send them to system settings.
    if (!ok) void Linking.openSettings();
  }

  return (
    <Pressable
      onPress={enable}
      accessibilityRole="button"
      style={({ pressed }) => [styles.permRow, pressed && styles.pressed]}>
      <Ionicons name="notifications-off-outline" size={18} color={DESTRUCTIVE} />
      <Text style={[styles.permText, { color: theme.text }]}>
        Notifications are turned off for Books — reminders won’t arrive.
      </Text>
      <Text style={[styles.permAction, { color: theme.accent }]}>Turn on</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

/** A grouped list surface — a Paper that hosts a stack of Rows + Dividers. */
function Group({ children }: { children: ReactNode }) {
  return <Paper style={styles.group}>{children}</Paper>;
}

function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />;
}

function Row({
  icon,
  label,
  destructive,
  external,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  external?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = destructive ? DESTRUCTIVE : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={destructive ? DESTRUCTIVE : theme.textSecondary} />
      <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={external ? 16 : 18}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: ColorSchemePreference;
  options: { value: ColorSchemePreference; label: string }[];
  onChange: (value: ColorSchemePreference) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.backgroundElement, boxShadow: Elevation.rest },
            ]}>
            <Text
              style={[styles.segmentText, { color: active ? theme.text : theme.textSecondary }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} days per week`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.accent : theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stepper,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.stepperText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {},
  content: { padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
    marginLeft: Spacing.one,
    marginBottom: Spacing.half,
  },
  card: { padding: Spacing.four, gap: Spacing.three },
  cardLabel: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  cardHint: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: {
    width: 46,
    height: 46,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: FontFamily.semibold, fontSize: 17 },
  chipSuffix: { marginLeft: 'auto', fontSize: 14, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  time: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    paddingHorizontal: Spacing.two,
    height: 40,
    minWidth: 44,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontSize: 13, fontWeight: '700' },
  // Notification-permission warning row, tucked under the reminder controls.
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  permText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  permAction: { fontSize: 14, fontWeight: '700' },
  // Grouped list (Data / About).
  group: { paddingHorizontal: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.four + Spacing.three },
  // Segmented theme control.
  segment: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    padding: Spacing.half,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: Spacing.three - Spacing.half,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 14, lineHeight: 20, fontWeight: '500', paddingHorizontal: Spacing.one },
  pressed: { opacity: 0.7 },
});
