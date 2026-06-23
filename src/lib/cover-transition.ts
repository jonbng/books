import { router } from 'expo-router';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Open the book detail screen, measuring the tapped cover's on-screen rect first
 * so the detail screen can fly its hero cover from this exact spot — a
 * cross-platform shared-element transition (works on Android, unlike the
 * iOS-only `Link.AppleZoom`). Falls back to a plain push if measurement fails.
 */
export function openBook(bookId: number, coverRef: RefObject<View | null>) {
  const node = coverRef.current;
  if (!node) {
    router.push(`/book/${bookId}`);
    return;
  }
  // measureInWindow reports the pre-transform layout box in window coordinates,
  // so a tilted/leaning shelf cover still yields an upright rect that matches the
  // detail page's cover orientation.
  node.measureInWindow((x, y, w, h) => {
    if (!w || !h) {
      router.push(`/book/${bookId}`);
      return;
    }
    router.push({
      pathname: '/book/[id]',
      params: {
        id: String(bookId),
        ox: String(Math.round(x)),
        oy: String(Math.round(y)),
        ow: String(Math.round(w)),
        oh: String(Math.round(h)),
      },
    });
  });
}
