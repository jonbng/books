import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookActionSheet } from '@/components/book-action-sheet';
import { PaperBackground } from '@/components/paper';
import { BookShelf } from '@/components/shelf-scene';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import { useStatusBarInset } from '@/hooks/use-status-bar-inset';
import { useTheme } from '@/hooks/use-theme';

export default function ShelfScreen() {
  const data = useAppData();
  const theme = useTheme();
  const topInset = useStatusBarInset();
  const [actionBook, setActionBook] = useState<Book | null>(null);

  const { reading, want_to_read, finished } = data.booksByShelf;
  const isEmpty = reading.length === 0 && want_to_read.length === 0 && finished.length === 0;

  return (
    <PaperBackground>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: Spacing.four + topInset }]}>
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>Shelf</Text>
          <Pressable
            onPress={() => router.push('/add')}
            accessibilityRole="button"
            accessibilityLabel="Add a book"
            style={({ pressed }) => [
              styles.addHeaderButton,
              { backgroundColor: theme.accent },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addHeaderLabel}>Add</Text>
          </Pressable>
        </View>

        {isEmpty ? (
          <EmptyLibrary onAdd={() => router.push('/add')} />
        ) : (
          <>
            <ShelfSection
              title="Reading"
              books={reading}
              coverHeight={190}
              showProgress
              onLongPress={setActionBook}
              emptyHint="Start a book to see it here."
            />
            <ShelfSection
              title="Want to Read"
              books={want_to_read}
              coverHeight={168}
              onLongPress={setActionBook}
              emptyHint="Tap Add to line up your next read."
            />
            <ShelfSection
              title="Finished"
              books={finished}
              coverHeight={150}
              onLongPress={setActionBook}
              emptyHint="Your Finished shelf is empty — finish your first book to start filling it."
            />
          </>
        )}
      </ScrollView>

      <BookActionSheet book={actionBook} onClose={() => setActionBook(null)} />
    </PaperBackground>
  );
}

/** First-run state — a single guiding CTA instead of three blank shelves. */
function EmptyLibrary({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name="library-outline" size={52} color={theme.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Your shelf is empty</Text>
      <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
        Add a book to start your library — then mark the days you read and watch the Finished
        shelf fill up.
      </Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Add your first book"
        style={({ pressed }) => [
          styles.emptyCta,
          { backgroundColor: theme.accent },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.emptyCtaLabel}>Add your first book</Text>
      </Pressable>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>{count}</Text>
    </View>
  );
}

/** A titled shelf — header, then books standing on a dimensional ledge. */
function ShelfSection({
  title,
  books,
  coverHeight,
  showProgress,
  onLongPress,
  emptyHint,
}: {
  title: string;
  books: Book[];
  coverHeight: number;
  showProgress?: boolean;
  onLongPress?: (book: Book) => void;
  emptyHint: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <SectionHeader title={title} count={books.length} />
      {books.length === 0 ? (
        <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>{emptyHint}</Text>
      ) : (
        <BookShelf
          books={books}
          coverHeight={coverHeight}
          showProgress={showProgress}
          onLongPress={onLongPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.display.fontSize,
    lineHeight: Type.display.lineHeight,
  },
  addHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderCurve: 'continuous',
    boxShadow: '0px 3px 8px rgba(60, 40, 25, 0.16)',
  },
  addHeaderLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  section: { gap: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  sectionTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
  },
  sectionCount: {
    fontFamily: FontFamily.regular,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  emptyHint: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.six,
  },
  emptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: Type.headline.fontSize,
    lineHeight: Type.headline.lineHeight,
    marginTop: Spacing.one,
  },
  emptyBody: { fontSize: 15, lineHeight: 22, fontWeight: '500', textAlign: 'center' },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    borderCurve: 'continuous',
    marginTop: Spacing.two,
    boxShadow: '0px 4px 12px rgba(60, 40, 25, 0.18)',
  },
  emptyCtaLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
