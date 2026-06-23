/**
 * Self-contained ISBN barcode scanner (expo-camera).
 *
 * The "add a book by scanning its barcode" experience — camera permission,
 * EAN-13/UPC-A scanning, ISBN validation, the Open Library lookup, and adding to
 * a shelf. The scanning logic is deliberately defensive; the UI around it is
 * tuned to feel tactile and calm (DESIGN-UI.md: "a well-made paperback"): a
 * dimmed reticle with corner brackets and a slow sweep line, a light haptic the
 * instant a barcode is caught, a spring "pop" on the frame, and a result card
 * that slides up with the real cover. It exposes `onAdded` / `onClose` callbacks
 * so a route or modal can host it.
 *
 * Behaviour:
 *  - Ignores non-ISBN barcodes (validates the checksum before any network call).
 *  - De-dupes: each ISBN is processed once per mount, so holding the camera on a
 *    barcode won't add the same book repeatedly. A different book still scans.
 *  - After a result, the frame returns to scanning on its own so several books
 *    can be added in one sitting; the running count stays in the corner.
 *  - Transient lookup errors are retryable (the code is released on error).
 */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { PaperBackground } from '@/components/paper';
import { FontFamily, Motion, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import { SHELF_LABELS, type Shelf } from '@/lib/books';
import { logError, toUserMessage } from '@/lib/errors';
import { isValidIsbn, normalizeIsbn } from '@/lib/isbn';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Haptics are great on device, a no-op risk on web — gate to native platforms.
const CAN_HAPTIC = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';
const impact = (style: Haptics.ImpactFeedbackStyle) => {
  if (CAN_HAPTIC) Haptics.impactAsync(style).catch(() => {});
};
const notify = (type: Haptics.NotificationFeedbackType) => {
  if (CAN_HAPTIC) Haptics.notificationAsync(type).catch(() => {});
};

const WINDOW_H = 156; // reticle window height (barcodes are wide and short)
const BRACKET = 30; // corner bracket arm length
const BRACKET_W = 3;
const RETICLE_RADIUS = 16;
const WARN_COLOR = '#E0A35E'; // warm amber for "no match" — never a cold red

interface Props {
  /** Called after a book is successfully looked up and added. */
  onAdded?: (book: Book) => void;
  /** Called when the user dismisses the scanner. */
  onClose?: () => void;
  /** Shelf scanned books land on (default: Want to Read). */
  defaultShelf?: Shelf;
}

type ScanStatus =
  | { kind: 'scanning' }
  | { kind: 'looking'; isbn: string }
  | { kind: 'added'; book: Book }
  | { kind: 'notFound'; isbn: string }
  | { kind: 'error'; message: string };

export function IsbnScanner({ onAdded, onClose, defaultShelf = 'want_to_read' }: Props) {
  const { addBookByIsbn } = useAppData();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<ScanStatus>({ kind: 'scanning' });
  const [addedCount, setAddedCount] = useState(0);
  const [torch, setTorch] = useState(false);

  // Guards against the continuous onBarcodeScanned firing: one in-flight lookup
  // at a time, and each ISBN handled once.
  const busyRef = useRef(false);
  const handledRef = useRef<Set<string>>(new Set());

  // Reticle motion. `tone` drives the bracket colour (0 idle → 1 looking →
  // 2 added → 3 notice); `pop` is the spring scale on capture; `sweep` is the
  // looping scan line. `accent` is read inside the colour worklet.
  const accent = theme.accent;
  const tone = useSharedValue(0);
  const pop = useSharedValue(1);
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [sweep]);

  useEffect(() => {
    switch (status.kind) {
      case 'scanning':
        tone.value = withTiming(0, { duration: 320 });
        break;
      case 'looking':
        tone.value = withTiming(1, { duration: 200 });
        break;
      case 'added':
        tone.value = withTiming(2, { duration: 160 });
        pop.value = withSequence(
          withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }),
          withSpring(1, Motion.successSpring)
        );
        break;
      case 'notFound':
      case 'error':
        tone.value = withTiming(3, { duration: 200 });
        break;
    }
  }, [status.kind, tone, pop]);

  // After any result, return to scanning on its own so the next book is ready.
  useEffect(() => {
    if (status.kind === 'scanning' || status.kind === 'looking') return;
    const t = setTimeout(
      () => setStatus({ kind: 'scanning' }),
      status.kind === 'added' ? 2200 : 2800
    );
    return () => clearTimeout(t);
  }, [status]);

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      const isbn = normalizeIsbn(result.data);
      if (busyRef.current) return;
      if (!isValidIsbn(isbn)) return; // not a book barcode — keep scanning
      if (handledRef.current.has(isbn)) return; // already processed this one

      busyRef.current = true;
      handledRef.current.add(isbn);
      // The "catch" — a light tap the instant a real barcode locks in, before
      // the network round-trip, so the scan feels instantaneous.
      impact(Haptics.ImpactFeedbackStyle.Light);
      setStatus({ kind: 'looking', isbn });

      try {
        const book = await addBookByIsbn(isbn, defaultShelf);
        if (book) {
          setStatus({ kind: 'added', book });
          setAddedCount((c) => c + 1);
          onAdded?.(book);
          notify(Haptics.NotificationFeedbackType.Success);
        } else {
          setStatus({ kind: 'notFound', isbn });
          notify(Haptics.NotificationFeedbackType.Warning);
        }
      } catch (err) {
        handledRef.current.delete(isbn); // let the user retry a transient failure
        logError('isbnScanner.handleScan', err);
        // Never surface a raw HTTP status to the user — map to friendly copy.
        setStatus({
          kind: 'error',
          message: toUserMessage(err, 'Lookup failed. Point the camera at the barcode again.'),
        });
        notify(Haptics.NotificationFeedbackType.Error);
      } finally {
        busyRef.current = false;
      }
    },
    [addBookByIsbn, defaultShelf, onAdded]
  );

  const reticleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const bracketStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      tone.value,
      [0, 1, 2, 3],
      ['rgba(255,255,255,0.92)', accent, accent, WARN_COLOR]
    ),
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [8, WINDOW_H - 8]) }],
    opacity: interpolate(sweep.value, [0, 0.12, 0.88, 1], [0, 1, 1, 0]),
  }));

  // Permissions still resolving.
  if (!permission) {
    return (
      <PaperBackground style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </PaperBackground>
    );
  }

  // Permission not granted yet.
  if (!permission.granted) {
    return (
      <PaperBackground style={styles.centered}>
        <View style={[styles.permIcon, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="barcode-outline" size={36} color={theme.accent} />
        </View>
        <Text style={[styles.permTitle, { color: theme.text }]}>Scan a barcode</Text>
        <Text style={[styles.permBody, { color: theme.textSecondary }]}>
          Point your camera at the barcode on a book’s back cover to add it in a tap. We’ll need
          camera access first.
        </Text>
        <BounceButton
          onPress={requestPermission}
          accessibilityLabel="Grant camera access"
          style={[styles.permButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.permButtonText}>Allow camera</Text>
        </BounceButton>
        {onClose ? (
          <BounceButton onPress={onClose} accessibilityLabel="Not now" style={styles.permLink}>
            <Text style={[styles.permLinkText, { color: theme.textSecondary }]}>Not now</Text>
          </BounceButton>
        ) : null}
      </PaperBackground>
    );
  }

  const windowW = Math.min(width - 72, 320);
  const showHint = status.kind === 'scanning' || status.kind === 'looking';

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a'] }}
        onBarcodeScanned={handleScan}
      />

      {/* Dim everything outside the reticle so the eye lands on the window. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.mask} />
        <View style={{ flexDirection: 'row', height: WINDOW_H }}>
          <View style={styles.mask} />
          <View style={{ width: windowW }} />
          <View style={styles.mask} />
        </View>
        <View style={styles.mask} />
      </View>

      {/* Reticle: corner brackets + sweep line, centred over the window. */}
      <View style={styles.reticleLayer} pointerEvents="none">
        <Animated.View style={[styles.window, { width: windowW, height: WINDOW_H }, reticleStyle]}>
          <Animated.View style={[styles.corner, styles.cornerTL, bracketStyle]} />
          <Animated.View style={[styles.corner, styles.cornerTR, bracketStyle]} />
          <Animated.View style={[styles.corner, styles.cornerBL, bracketStyle]} />
          <Animated.View style={[styles.corner, styles.cornerBR, bracketStyle]} />
          {status.kind === 'scanning' ? (
            <Animated.View
              style={[styles.sweep, { backgroundColor: accent }, sweepStyle]}
            />
          ) : null}
        </Animated.View>
      </View>

      {/* Top controls — dismiss, running count, torch. */}
      <View style={[styles.topBar, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
        <BounceButton
          onPress={onClose}
          accessibilityLabel="Close scanner"
          style={styles.circleButton}>
          <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
        </BounceButton>

        {addedCount > 0 ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.countPill, { backgroundColor: accent }]}>
            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            <Text style={styles.countText}>
              {addedCount} added
            </Text>
          </Animated.View>
        ) : (
          <View />
        )}

        <BounceButton
          onPress={() => setTorch((t) => !t)}
          accessibilityLabel={torch ? 'Turn off flashlight' : 'Turn on flashlight'}
          style={[styles.circleButton, torch && { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
          <Ionicons
            name={torch ? 'flash' : 'flash-off'}
            size={20}
            color={torch ? '#1A1611' : '#FFFFFF'}
          />
        </BounceButton>
      </View>

      {/* Bottom: live hint while scanning, result card after, Done above all. */}
      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.three }]}
        pointerEvents="box-none">
        {showHint ? (
          <Animated.View
            key={status.kind}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(160)}
            style={styles.hintPill}>
            {status.kind === 'looking' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="scan-outline" size={17} color="rgba(255,255,255,0.9)" />
            )}
            <Text style={styles.hintText}>
              {status.kind === 'looking'
                ? 'Looking it up…'
                : 'Line up the barcode on the back cover'}
            </Text>
          </Animated.View>
        ) : null}

        {status.kind === 'added' ? (
          <ResultCard book={status.book} shelf={defaultShelf} theme={theme} />
        ) : null}

        {status.kind === 'notFound' || status.kind === 'error' ? (
          <NoticeCard
            theme={theme}
            message={
              status.kind === 'notFound'
                ? 'No match found — try searching by title instead.'
                : status.message
            }
          />
        ) : null}

        {onClose ? (
          <BounceButton
            onPress={onClose}
            accessibilityLabel={addedCount > 0 ? `Done, ${addedCount} added` : 'Done'}
            style={[styles.doneButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.doneText}>Done</Text>
          </BounceButton>
        ) : null}
      </View>
    </View>
  );
}

/** Slide-up card for a freshly-added book — real cover, title, and shelf. */
function ResultCard({
  book,
  shelf,
  theme,
}: {
  book: Book;
  shelf: Shelf;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(180).reduceMotion(ReduceMotion.System)}
      exiting={SlideOutDown.duration(220)}
      style={[styles.card, { backgroundColor: theme.background }]}>
      <BookCover
        coverUrl={book.coverUrl}
        coverWidth={book.coverWidth}
        coverHeight={book.coverHeight}
        height={68}
        elevation="rest"
      />
      <View style={styles.cardMeta}>
        <Text style={[styles.cardLabel, { color: theme.accent }]}>
          Added to {SHELF_LABELS[shelf]}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
          {book.title}
        </Text>
        {book.author ? (
          <Text style={[styles.cardAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
            {book.author}
          </Text>
        ) : null}
      </View>
      <Ionicons name="checkmark-circle" size={26} color={theme.accent} />
    </Animated.View>
  );
}

/** Slide-up card for a miss (no match / transient error). */
function NoticeCard({
  message,
  theme,
}: {
  message: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(180).reduceMotion(ReduceMotion.System)}
      exiting={SlideOutDown.duration(220)}
      style={[styles.card, { backgroundColor: theme.background }]}>
      <View style={[styles.noticeIcon, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search-outline" size={22} color={WARN_COLOR} />
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

/** Pressable with an interruptible scale-to-0.96 on press. */
function BounceButton({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: object | object[];
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.set(withTiming(0.96, { duration: 110 }));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, Motion.pressSpring));
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[style as object, animated]}>
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three },

  // Permission / loading
  permIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  permTitle: { fontFamily: FontFamily.semibold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  permBody: {
    fontSize: Type.body.fontSize,
    lineHeight: Type.body.lineHeight,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 320,
  },
  permButton: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    boxShadow: '0px 4px 12px rgba(60, 40, 25, 0.18)',
  },
  permButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  permLink: { padding: Spacing.two },
  permLinkText: { fontSize: 15, fontWeight: '600' },

  // Mask + reticle
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  reticleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  window: { alignItems: 'stretch', justifyContent: 'flex-start' },
  corner: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderTopLeftRadius: RETICLE_RADIUS,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderTopRightRadius: RETICLE_RADIUS,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: BRACKET_W,
    borderLeftWidth: BRACKET_W,
    borderBottomLeftRadius: RETICLE_RADIUS,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: BRACKET_W,
    borderRightWidth: BRACKET_W,
    borderBottomRightRadius: RETICLE_RADIUS,
  },
  sweep: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 2,
    boxShadow: '0px 0px 8px rgba(192, 105, 74, 0.9)',
  },

  // Top bar
  topBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    height: 36,
    borderRadius: 18,
    boxShadow: '0px 2px 8px rgba(60, 40, 25, 0.28)',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Bottom area
  bottom: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: 0,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  hintPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  hintText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three + Spacing.two,
    borderCurve: 'continuous',
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.4)',
  },
  cardMeta: { flex: 1, gap: 1 },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardTitle: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 21 },
  cardAuthor: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    boxShadow: '0px 4px 12px rgba(60, 40, 25, 0.3)',
  },
  doneText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
