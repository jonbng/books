import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { IconButton } from '@/components/icon-button';
import { Paper, PaperBackground } from '@/components/paper';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import type { BookSearchResult } from '@/services/open-library';

/**
 * "Add a book" — the single entry point for growing the library, presented as a
 * modal over the Shelf (DESIGN-UI.md §7: add is an *action*, not a tab or a
 * permanent search bar). Two paths: scan a barcode (camera) or search Open
 * Library by title/author. Before a search runs, the space below shows books
 * trending on Open Library so there's always something to add. Added books drop
 * onto the Want to Read shelf; the sheet stays open so several can be added in
 * one sitting, then dismissed.
 */
export default function AddBookScreen() {
  const data = useAppData();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const searchRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [trending, setTrending] = useState<BookSearchResult[] | null>(null);
  // Books just tapped this session — an optimistic flag so the row flips to
  // "In library" instantly, before the reload that adds them to `data.books`.
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  // Open Library keys already on a shelf, so results for books the user owns
  // show as "In library" and can't be added again. Updates as `data.books` does.
  const libraryKeys = useMemo(
    () => new Set(data.books.map((b) => b.openLibraryKey).filter((k): k is string => !!k)),
    [data.books]
  );

  // Load trending once on mount; a failure just leaves the section empty.
  // Depend on the stable `trendingBooks` callback (not the whole `data` object,
  // which is rebuilt on every provider render) so adding a book — which triggers
  // a reload and a new `data` — doesn't re-fetch and swap the list mid-tap.
  const { trendingBooks } = data;
  useEffect(() => {
    let alive = true;
    trendingBooks()
      .then((books) => alive && setTrending(books))
      .catch(() => alive && setTrending([]));
    return () => {
      alive = false;
    };
  }, [trendingBooks]);

  async function onSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await data.searchBooks(query));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function onAdd(result: BookSearchResult) {
    setAddedKeys((prev) => new Set(prev).add(result.key)); // optimistic
    await data.addBookFromSearch(result, 'want_to_read');
  }

  // Before a search, fill the space with trending picks; after, show results.
  const showingTrending = !searched && !searching;
  const list = showingTrending ? (trending ?? []) : results;

  return (
    <PaperBackground>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <Text style={[styles.title, { color: theme.text }]}>Add a book</Text>
        <IconButton
          name="close"
          accessibilityLabel="Close"
          color={theme.textSecondary}
          onPress={() => router.back()}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {/* Scan path */}
        <Pressable
          onPress={() => router.push('/scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan a barcode"
          style={({ pressed }) => [
            styles.scanCta,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="barcode-outline" size={26} color="#FFFFFF" />
          <View style={styles.scanCtaText}>
            <Text style={styles.scanCtaTitle}>Scan a barcode</Text>
            <Text style={styles.scanCtaSub}>Point your camera at the back cover</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
        </Pressable>

        <View style={styles.orRow}>
          <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
          <Text style={[styles.orText, { color: theme.textSecondary }]}>or search</Text>
          <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
        </View>

        {/* Search path */}
        <View style={styles.searchRow}>
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            placeholder="Title or author…"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={theme.accent}
            cursorColor={theme.accent}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
          <Pressable
            onPress={onSearch}
            style={({ pressed }) => [
              styles.searchButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            {searching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </Pressable>
        </View>

        {/* Trending header — only before a search. */}
        {showingTrending && (trending === null || trending.length > 0) ? (
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            Popular this week
          </Text>
        ) : null}

        {/* Trending still loading. */}
        {showingTrending && trending === null ? (
          <ActivityIndicator color={theme.accent} style={styles.loading} />
        ) : null}

        {list.map((r) => {
          const inLibrary = libraryKeys.has(r.key) || addedKeys.has(r.key);
          return (
            <Paper key={r.key} style={styles.resultRow}>
              <BookCover coverUrl={r.coverUrl} height={64} elevation="rest" />
              <View style={styles.resultMeta}>
                <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text
                  style={[styles.resultAuthor, { color: theme.textSecondary }]}
                  numberOfLines={1}>
                  {r.author ?? 'Unknown'}
                  {r.pageCount ? ` · ${r.pageCount}p` : ''}
                </Text>
              </View>
              {inLibrary ? (
                <View style={styles.addedBadge} accessibilityLabel="Already in your library">
                  <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                  <Text style={[styles.addedText, { color: theme.textSecondary }]}>In library</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onAdd(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${r.title}`}
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.addButtonText, { color: theme.accent }]}>Add</Text>
                </Pressable>
              )}
            </Paper>
          );
        })}

        {searched && !searching && results.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            No matches for “{query.trim()}”. Try a different title or author.
          </Text>
        ) : null}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
  },
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  scanCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    boxShadow: '0px 4px 12px rgba(60, 40, 25, 0.18)',
  },
  scanCtaText: { flex: 1, gap: 2 },
  scanCtaTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  scanCtaSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.one },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2, borderRadius: 1 },
  orText: { fontSize: 13, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
  },
  searchButton: {
    paddingHorizontal: Spacing.four,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
  },
  searchButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  sectionLabel: {
    ...Type.label,
    textTransform: 'uppercase',
    paddingTop: Spacing.one,
  },
  loading: { paddingVertical: Spacing.five },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  resultMeta: { flex: 1, gap: 2 },
  resultTitle: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 21 },
  resultAuthor: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  addButton: {
    minWidth: 64,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
  },
  addButtonText: { fontSize: 15, fontWeight: '700' },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  addedText: { fontSize: 13, fontWeight: '600' },
  empty: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    paddingTop: Spacing.two,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});
