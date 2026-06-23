import { Image, type ImageLoadEventData } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Elevated = keyof typeof Elevation;

export type BookCoverProps = {
  coverUrl?: string | null;
  coverWidth?: number | null;
  coverHeight?: number | null;
  /** Rendered height; width follows real cover proportions. */
  height?: number;
  elevation?: Elevated;
  radius?: number;
  /** Draw a binding spine on the left edge — for standing shelf books, not for
   *  small thumbnails where it would read as a stripe. */
  spine?: boolean;
  style?: ViewStyle;
};

/**
 * A book cover as a real object (DESIGN-UI.md §6): a warm contact shadow so it
 * rests with weight, and a hairline outline so the edge reads cleanly against
 * warm paper. The frame is sized to the image's true aspect ratio — known from
 * Open Library dimensions, then corrected to the loaded image's own ratio — so
 * the cover fills the frame edge-to-edge with no cropping and no letterbox gaps.
 */
export function BookCover({
  coverUrl,
  coverWidth,
  coverHeight,
  height = 132,
  elevation = 'raised',
  radius = Spacing.two,
  spine = false,
  style,
}: BookCoverProps) {
  const theme = useTheme();
  const [loadedAspect, setLoadedAspect] = useState<number | null>(null);
  const aspect =
    loadedAspect ?? (coverWidth && coverHeight ? coverWidth / coverHeight : 2 / 3);
  const width = height * aspect;

  const onLoad = (e: ImageLoadEventData) => {
    const { width: w, height: h } = e.source;
    if (w && h) setLoadedAspect(w / h);
  };

  // Spine side reads as a bound edge with a slightly rounder corner than the
  // fore-edge, like a real book's hinge.
  const leftRadius = spine ? radius + 2 : radius;
  const corners = {
    borderTopLeftRadius: leftRadius,
    borderBottomLeftRadius: leftRadius,
    borderTopRightRadius: radius,
    borderBottomRightRadius: radius,
  };

  return (
    <View
      style={[{ width, height, borderCurve: 'continuous', boxShadow: Elevation[elevation] }, corners, style]}>
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={[styles.fill, corners]}
          contentFit="cover"
          transition={220}
          onLoad={onLoad}
        />
      ) : (
        <View style={[styles.fill, corners, { backgroundColor: theme.backgroundSelected }]} />
      )}
      {/* Binding spine on the left edge: a dark recess where the pages bind, plus
          a thin bright line for the page block catching light. */}
      {spine ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.spineShade,
              { borderTopLeftRadius: leftRadius, borderBottomLeftRadius: leftRadius },
            ]}
          />
          <View pointerEvents="none" style={styles.spineLine} />
        </>
      ) : null}
      {/* Printed-cover sheen — a soft diagonal highlight so the cover catches
          light like a glossy jacket rather than reading as a flat sticker. */}
      <View pointerEvents="none" style={[styles.fill, styles.sheen, corners]} />
      {/* Hairline edge — pure black at low alpha so it never tints. */}
      <View pointerEvents="none" style={[styles.fill, styles.outline, corners]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheen: {
    backgroundImage:
      'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 22%, rgba(255,255,255,0) 45%)',
  },
  // Binding recess: darkest at the very edge, fading into the cover art.
  spineShade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 7,
    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.34), rgba(0,0,0,0))',
  },
  // Page-block highlight just inboard of the recess.
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 7,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.10)',
  },
});
