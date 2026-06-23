import * as Haptics from 'expo-haptics';
import { Link, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';

import { BookCover } from '@/components/book-cover';
import { Spacing } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useTheme } from '@/hooks/use-theme';
import { readingPercent } from '@/lib/books';

// Soft page-colored fade at a scroll edge: solid background color at the screen
// edge, clearing inward, so books dissolve into the margin instead of being
// hard-cut — and the fade doubles as a "there's more" affordance over a
// half-shown book at the trailing edge.
function fadeGradient(hex: string, edge: 'left' | 'right') {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const direction = edge === 'left' ? 'to right' : 'to left';
  return `linear-gradient(${direction}, rgb(${r}, ${g}, ${b}), rgba(${r}, ${g}, ${b}, 0))`;
}

// Scroll distance over which an edge fade ramps in/out as you approach it.
const FADE_RAMP = 24;

// Snappy spring for the press-in of a book — a quick scale dip and settle, so a
// tap feels like pressing a real object rather than a flat button.
const PRESS_SPRING = { mass: 0.6, stiffness: 400, damping: 28 } as const;

// A newly added book drops in from above and settles with a soft bounce — the
// low damping is what gives the landing its weight.
const ENTER_DROP = 26;
const ENTER_SPRING = { mass: 0.9, stiffness: 220, damping: 11 } as const;

// Ledge geometry. The top face is a trapezoid: full width at the front edge,
// inset by BOARD_INSET on each side at the back, so the board recedes toward the
// wall in perspective (the SVG version of the web reference's clipPath).
const BOARD_INSET = 26;
const BOARD_FACE_HEIGHT = 13;
// Warm targets the board surface is blended toward for the lit front edge and
// the shadowed back edge — kept off the theme surface so it adapts to dark mode.
const WARM_HIGHLIGHT = [255, 244, 224] as const;
const WARM_SHADOW = [38, 24, 12] as const;

// Mix a #rrggbb color toward an [r,g,b] target by t (0..1), returning #rrggbb.
function mixHex(hex: string, target: readonly [number, number, number], t: number) {
  const c = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const out = c.map((v, i) => Math.round(v + (target[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A real shelf (DESIGN-UI.md §6, pushed toward tactility per request): books
 * stand face-out on a dimensional ledge, each with a slight perspective tilt, a
 * page-edge for thickness, an organic lean, and a grounding contact shadow so
 * they read as objects resting on something with weight.
 */
export function BookShelf({
  books,
  coverHeight,
  showProgress,
  onLongPress,
  justAddedId,
}: {
  books: Book[];
  coverHeight: number;
  showProgress?: boolean;
  onLongPress?: (book: Book) => void;
  justAddedId?: number | null;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const theme = useTheme();

  // Scroll metrics live on the UI thread so the edge fades track the finger with
  // no JS round-trip. Content/layout width are seeded on mount (below) so the
  // trailing fade shows at rest, before the first scroll event fires.
  const scrollX = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const layoutWidth = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    contentWidth.value = e.contentSize.width;
    layoutWidth.value = e.layoutMeasurement.width;
  });

  // Leading fade: hidden at rest, ramps in once scrolled off the start.
  const leadingFade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, [0, FADE_RAMP], [0, 1], Extrapolation.CLAMP),
  }));
  // Trailing fade: shown whenever there's more to the right, fading out as the
  // end comes into view. Collapses to hidden when nothing overflows.
  const trailingFade = useAnimatedStyle(() => {
    const max = Math.max(0, contentWidth.value - layoutWidth.value);
    return {
      opacity: interpolate(scrollX.value, [max - FADE_RAMP, max], [1, 0], Extrapolation.CLAMP),
    };
  });

  const leadingGradient = useMemo(() => fadeGradient(theme.background, 'left'), [theme.background]);
  const trailingGradient = useMemo(() => fadeGradient(theme.background, 'right'), [theme.background]);

  return (
    <View style={styles.bleed}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(w) => {
          contentWidth.value = w;
        }}
        onLayout={(e) => {
          layoutWidth.value = e.nativeEvent.layout.width;
        }}>
        {/* The board spans at least the screen — a real shelf doesn't shrink to fit
            a few books; it just sits emptier. It grows + scrolls once books overflow. */}
        <View style={[styles.inner, { minWidth: screenWidth }]}>
          <View style={styles.row}>
            {books.map((book) => (
              <StandingBook
                key={book.id}
                book={book}
                coverHeight={coverHeight}
                showProgress={showProgress}
                onLongPress={onLongPress}
                justAdded={book.id === justAddedId}
              />
            ))}
          </View>
          <Ledge />
        </View>
      </Animated.ScrollView>
      {/* Edge fades sit at the true screen edges (the bleed reaches them) and
          never intercept touches, so the scroll/long-press gestures pass through. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.fade, styles.fadeLeft, { backgroundImage: leadingGradient }, leadingFade]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.fade, styles.fadeRight, { backgroundImage: trailingGradient }, trailingFade]}
      />
    </View>
  );
}

function StandingBook({
  book,
  coverHeight,
  showProgress,
  onLongPress,
  justAdded,
}: {
  book: Book;
  coverHeight: number;
  showProgress?: boolean;
  onLongPress?: (book: Book) => void;
  justAdded?: boolean;
}) {
  const theme = useTheme();
  const percent = readingPercent(book.currentPage, book.totalPages);
  // The cover frame sizes itself to the loaded image's true ratio, so measure the
  // rendered width rather than precomputing it — keeps the contact shadow and the
  // progress track aligned to whatever width the cover settles on.
  const [coverWidth, setCoverWidth] = useState(0);
  // Deterministic, subtle lean so the row feels hand-arranged, not pasted.
  const lean = (((book.id * 37) % 5) - 2) * 0.5; // ~ -1°..+1°

  // Spring scale on press — driven on the UI thread, dips in on touch and
  // settles back on release.
  const scale = useSharedValue(1);
  // Entrance offset: a just-added book starts lifted and drops into place.
  const enterY = useSharedValue(justAdded ? -ENTER_DROP : 0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: enterY.value }, { scale: scale.value }],
  }));

  // On mount of a freshly added book: drop it onto the shelf with a bounce and a
  // haptic thunk as it lands. Runs once; existing books mount with enterY at 0.
  useEffect(() => {
    if (!justAdded) return;
    enterY.value = withSpring(0, ENTER_SPRING);
    if (process.env.EXPO_OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Mount-only landing; deliberately not re-run on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link href={`/book/${book.id}` as Href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={book.author ? `${book.title}, ${book.author}` : book.title}
        accessibilityHint="Opens the book. Long press for quick actions."
        onPressIn={() => {
          scale.value = withSpring(0.96, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        onLongPress={onLongPress ? () => onLongPress(book) : undefined}
        delayLongPress={280}>
        <Animated.View style={[styles.book, pressStyle]}>
          <View style={styles.stage}>
            {/* grounding contact shadow, pinned to where the book meets the ledge */}
            {coverWidth > 0 ? <View style={[styles.contact, { width: coverWidth * 0.86 }]} /> : null}
            <View
              onLayout={(e) => setCoverWidth(e.nativeEvent.layout.width)}
              style={{
                // Pivot at the base so the book leans straight back onto the shelf,
                // foot planted — face-on, no sideways yaw. The recline alone makes
                // it read as a standing object while keeping the cover square to the
                // reader, and lets you look slightly down onto the page tops.
                transformOrigin: '50% 100%',
                transform: [
                  { perspective: 800 },
                  { rotateX: '12deg' },
                  { rotateZ: `${lean}deg` },
                ],
              }}>
              <BookCover
                coverUrl={book.coverUrl}
                coverWidth={book.coverWidth}
                coverHeight={book.coverHeight}
                height={coverHeight}
                elevation="raised"
                spine
              />
              {/* Clay progress strip across the cover's base — overlaid (absolute)
                  so it never lifts the book off the shelf. Reading-shelf only. */}
              {showProgress ? (
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${percent}%`, backgroundColor: theme.accent }]} />
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Link>
  );
}

/**
 * The shelf board, in three layers (after the web reference's ledge):
 *  - top face: the board's upper surface in perspective — lit warm at the front
 *    edge, falling into shadow at the back where it meets the wall.
 *  - front lip: the rounded wooden edge protruding toward the viewer, with a lit
 *    top highlight and a wide soft shadow it casts onto the row below.
 *  - spacer: empty room so that cast shadow can breathe before the next shelf.
 * Translucent warm highlight/shadow gradients sit over the theme surface colors,
 * so the same geometry reads correctly in both light and dark.
 */
function Ledge() {
  const theme = useTheme();
  // Measure the board width so the trapezoid's back-edge inset stays a constant
  // number of pixels (true perspective) rather than scaling with the board.
  const [width, setWidth] = useState(0);

  const frontColor = useMemo(
    () => mixHex(theme.backgroundElement, WARM_HIGHLIGHT, 0.32),
    [theme.backgroundElement]
  );
  const backColor = useMemo(
    () => mixHex(theme.backgroundElement, WARM_SHADOW, 0.42),
    [theme.backgroundElement]
  );

  const h = BOARD_FACE_HEIGHT;
  const inset = Math.min(BOARD_INSET, width / 2);

  return (
    <View style={styles.ledgeWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Top face — a perspective trapezoid: wide at the lit front edge (bottom),
          narrowing toward the shadowed back wall (top). */}
      {width > 0 ? (
        <Svg width={width} height={h}>
          <Defs>
            <SvgLinearGradient
              id="ledgeTop"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={h}
              x2="0"
              y2="0">
              <Stop offset="0" stopColor={frontColor} />
              <Stop offset="1" stopColor={backColor} />
            </SvgLinearGradient>
          </Defs>
          <Polygon
            points={`${inset},0 ${width - inset},0 ${width},${h} 0,${h}`}
            fill="url(#ledgeTop)"
          />
        </Svg>
      ) : (
        <View style={{ height: h }} />
      )}
      <View style={[styles.ledgeFront, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.ledgeShadowSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-bleed to the screen edges — cancels the parent content padding so the
  // board runs edge to edge like a real shelf. Wraps the scroller so the edge
  // fades can pin to the screen edges.
  bleed: { marginHorizontal: -Spacing.four },
  inner: { alignItems: 'stretch' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: Spacing.five },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.four,
    paddingLeft: Spacing.five,
    paddingRight: Spacing.five,
    paddingBottom: Spacing.one,
    // Lift the books above the ledge so a leaning cover is never clipped by the
    // shelf's top face or its cast shadow — the books always read in front.
    zIndex: 1,
  },
  book: { alignItems: 'center', gap: Spacing.two },
  stage: { justifyContent: 'flex-end', alignItems: 'center' },
  contact: {
    position: 'absolute',
    bottom: 2,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(50, 33, 20, 0.26)',
    boxShadow: '0px 3px 7px rgba(50, 33, 20, 0.28)',
  },
  // Overlaid on the cover's lower edge so it adds no vertical footprint — both
  // shelves keep their covers resting on the ledge.
  miniTrack: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  miniFill: { height: '100%', borderRadius: 2 },
  ledgeWrap: {
    marginTop: -6, // books' feet overlap the front edge of the board
  },
  // Front lip: protrudes toward the viewer with a lit top highlight. A single
  // soft, wide grounding shadow (low alpha, no tight spread) so it never reads as
  // a hard band — and it stays faint where the scroll edge clips it.
  ledgeFront: {
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundImage:
      'linear-gradient(to bottom, rgba(255,244,224,0.4), rgba(38,24,12,0.28))',
    boxShadow:
      '0px 4px 14px rgba(50, 33, 20, 0.14), inset 0px 1px 1px rgba(255, 244, 224, 0.55)',
  },
  // Room for the soft cast shadow to fully resolve before the next row, so the
  // edge fades (which span this wrapper) keep it from ever being cut off square.
  ledgeShadowSpacer: { height: 18 },
});
