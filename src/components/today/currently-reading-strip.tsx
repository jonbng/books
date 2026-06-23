import { Link, type Href } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Paper } from '@/components/paper';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useTheme } from '@/hooks/use-theme';
import { dayOfReading, readingPercent } from '@/lib/books';
import { openBook } from '@/lib/cover-transition';
import { todayISO } from '@/lib/dates';

export type CurrentlyReadingStripProps = {
  books: Book[];
};

/**
 * The active book(s) on Today — closes the loop between "I read" and "…this"
 * (DESIGN-UI.md §7a). Real-proportion cover, title/author, and a clay progress
 * fill. Empty state nudges toward adding a first book.
 */
export function CurrentlyReadingStrip({ books }: CurrentlyReadingStripProps) {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>CURRENTLY READING</Text>
        {books.length > 0 ? (
          <Link href={'/shelf' as Href} asChild>
            <Pressable hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
              <Text style={[styles.seeAll, { color: theme.accent }]}>See all</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
      {books.length === 0 ? (
        <Paper style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No book on the go yet — add one from your Shelf to track its progress.
          </Text>
        </Paper>
      ) : (
        books.map((book) => <ReadingRow key={book.id} book={book} />)
      )}
    </View>
  );
}

function ReadingRow({ book }: { book: Book }) {
  const theme = useTheme();
  const percent = readingPercent(book.currentPage, book.totalPages);
  const day = dayOfReading(book.startedAt, todayISO());
  const pageText = book.totalPages
    ? `p. ${book.currentPage} of ${book.totalPages} · ${percent}%`
    : `p. ${book.currentPage}`;
  const progressText = day ? `Day ${day} · ${pageText}` : pageText;
  // Measured on tap so the detail screen flies its hero cover from this row.
  const coverRef = useRef<View>(null);

  return (
    <Pressable
      onPress={() => openBook(book.id, coverRef)}
      style={({ pressed }) => pressed && styles.pressed}>
      <Paper style={styles.row}>
        <View ref={coverRef} collapsable={false}>
          <BookCover
            coverUrl={book.coverUrl}
            coverWidth={book.coverWidth}
            coverHeight={book.coverHeight}
            height={COVER_HEIGHT}
          />
        </View>

        <View style={styles.meta}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {book.title}
            </Text>
            {book.author ? (
              <Text style={[styles.author, { color: theme.textSecondary }]} numberOfLines={1}>
                {book.author}
              </Text>
            ) : null}

            <View style={styles.progressBlock}>
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: theme.accent, width: `${percent}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: theme.textSecondary }]}>
                {progressText}
              </Text>
            </View>
        </View>
      </Paper>
    </Pressable>
  );
}

const COVER_HEIGHT = 84;

const styles = StyleSheet.create({
  block: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: { fontFamily: FontFamily.medium, fontSize: 14 },
  label: {
    fontSize: Type.label.fontSize,
    lineHeight: Type.label.lineHeight,
    fontWeight: '700',
    letterSpacing: Type.label.letterSpacing,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
  },
  pressed: { opacity: 0.85 },
  empty: {
    padding: Spacing.four,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  meta: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    lineHeight: 22,
  },
  author: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  progressBlock: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
