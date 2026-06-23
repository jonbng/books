import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { OnboardingButton } from '@/components/onboarding/onboarding-button';
import { OnboardingScaffold } from '@/components/onboarding/onboarding-scaffold';
import { enter } from '@/components/onboarding/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { logError } from '@/lib/errors';
import type { BookSearchResult } from '@/services/open-library';

export default function Book() {
  const theme = useTheme();
  const { searchBooks, addBookFromSearch, completeOnboarding } = useAppData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus the field once the entrance stagger has settled, so the keyboard
  // doesn't race the title in. enter(1) ≈ 45ms delay + 260ms duration.
  useEffect(() => {
    const handle = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(handle);
  }, []);

  // Debounced Open Library search. All state updates live inside the timer
  // callback (never synchronously in the effect body) per react-hooks rules.
  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    const handle = setTimeout(
      async () => {
        if (!trimmed) {
          if (!cancelled) {
            setResults([]);
            setError(false);
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setLoading(true);
          setError(false);
        }
        try {
          const found = await searchBooks(trimmed);
          if (!cancelled) setResults(found);
        } catch {
          if (!cancelled) {
            setResults([]);
            setError(true);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      },
      trimmed ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, searchBooks, retry]);

  const finish = () => {
    setFinishing(true);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Hold the celebratory beat, then flip the gate into the main app.
    setTimeout(() => void completeOnboarding(), 750);
  };

  const onAdd = async (result: BookSearchResult) => {
    // No add-impact here: finish() fires the Success thunk ~immediately after,
    // and two haptics back-to-back read as one buzz. The finish is the moment.
    try {
      await addBookFromSearch(result, 'reading');
    } catch (err) {
      // Onboarding should never get stuck on a flaky add — log it and finish
      // anyway; the user can add the book later from the Shelf.
      logError('onboarding.onAdd', err);
    } finally {
      finish();
    }
  };

  return (
    <>
      <OnboardingScaffold
        step={3}
        footer={<OnboardingButton label="Skip for now" variant="ghost" onPress={finish} />}>
        <Animated.View entering={enter(0)} style={styles.intro}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.kicker}>
            What are you reading?
          </ThemedText>
          <ThemedText style={styles.title}>Add your current book</ThemedText>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by title or author"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={theme.accent}
            cursorColor={theme.accent}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </Animated.View>

        <View style={styles.results}>
          {loading && <ActivityIndicator color={theme.accent} style={styles.loading} />}
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              !loading && query.trim() ? (
                <Animated.View entering={FadeIn.duration(200)}>
                  {error ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Retry search"
                      onPress={() => setRetry((n) => n + 1)}
                      style={styles.empty}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                        Couldn&apos;t reach Open Library. Tap to try again.
                      </ThemedText>
                    </Pressable>
                  ) : (
                    <View style={styles.empty}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                        No matches for “{query.trim()}”.
                      </ThemedText>
                    </View>
                  )}
                </Animated.View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(Math.min(index, 8) * 40)}>
                <Pressable accessibilityRole="button" onPress={() => onAdd(item)} style={styles.row}>
                  <Cover url={item.coverUrl} />
                  <View style={styles.rowText}>
                    <ThemedText numberOfLines={1} style={styles.rowTitle}>
                      {item.title}
                    </ThemedText>
                    {item.author && (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {item.author}
                      </ThemedText>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            )}
          />
        </View>
      </OnboardingScaffold>

      {finishing && <FinishOverlay />}
    </>
  );
}

function Cover({ url }: { url: string | null }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.cover,
        { backgroundColor: theme.backgroundSelected, boxShadow: '0 4px 10px rgba(60, 40, 25, 0.18)' },
      ]}>
      {url && <Image source={url} style={styles.coverImage} contentFit="cover" transition={150} />}
    </View>
  );
}

function FinishOverlay() {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
      <ThemedView style={styles.finish}>
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(160)}>
          <View style={[styles.glow, { backgroundColor: theme.accent }]} />
          <Image
            source="sf:checkmark.circle.fill"
            tintColor={theme.accent}
            style={styles.check}
          />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150).duration(260)}>
          <ThemedText style={styles.finishText}>You&apos;re all set.</ThemedText>
        </Animated.View>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: Spacing.two,
  },
  kicker: {
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
  },
  input: {
    height: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
    fontSize: 16,
  },
  results: {
    flex: 1,
  },
  loading: {
    marginTop: Spacing.four,
  },
  list: {
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  empty: {
    paddingTop: Spacing.four,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cover: {
    width: 44,
    height: 64,
    borderRadius: 6,
    borderCurve: 'continuous',
    overflow: 'hidden',
    outlineWidth: 1,
    outlineColor: 'rgba(0, 0, 0, 0.1)',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  finish: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: -44,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.12,
  },
  check: {
    width: 72,
    height: 72,
  },
  finishText: {
    fontFamily: FontFamily.semibold,
    fontSize: 28,
    fontWeight: '600',
  },
});
