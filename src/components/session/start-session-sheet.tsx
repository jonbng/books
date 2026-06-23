import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { useToast } from '@/components/toast/toast-provider';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { logError, toUserMessage } from '@/lib/errors';

/**
 * Picks which book a new reading session is for (a session is always tied to a
 * book). A cross-platform bottom sheet like BookActionSheet. Branches on how many
 * books are on the Reading shelf:
 *  - 0 → nudge toward adding/starting a book; no session can begin,
 *  - 1 → started immediately by the caller (this sheet never shows for one book),
 *  - 2+ → list to choose from.
 *
 * The single-book shortcut lives in {@link useStartSession} so every entry point
 * (Today, action sheet) gets the same behavior.
 */
export function StartSessionSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const data = useAppData();
  const theme = useTheme();
  const { show: showToast } = useToast();
  const insets = useSafeAreaInsets();
  const reading = data.booksByShelf.reading;

  const choose = async (bookId: number) => {
    onClose();
    try {
      await data.startSession(bookId);
      router.push('/session');
    } catch (err) {
      logError('startSessionSheet.choose', err);
      showToast(toUserMessage(err, 'Couldn’t start a session. Please try again.'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
        <Text style={[styles.title, { color: theme.text }]}>Start a reading session</Text>

        {reading.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Move a book to your Reading shelf first, then start its timer.
            </Text>
            <Pressable
              onPress={() => {
                onClose();
                router.push('/add');
              }}
              accessibilityRole="button"
              accessibilityLabel="Add a book"
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.addText}>Add a book</Text>
            </Pressable>
          </View>
        ) : (
          reading.map((book) => (
            <Pressable
              key={book.id}
              onPress={() => choose(book.id)}
              accessibilityRole="button"
              accessibilityLabel={`Start a session for ${book.title}`}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <BookCover
                coverUrl={book.coverUrl}
                coverWidth={book.coverWidth}
                coverHeight={book.coverHeight}
                height={56}
              />
              <View style={styles.meta}>
                <Text style={[styles.bookTitle, { color: theme.text }]} numberOfLines={2}>
                  {book.title}
                </Text>
                {book.author ? (
                  <Text style={[styles.bookAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                    {book.author}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <Text style={[styles.cancelLabel, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30, 22, 14, 0.35)' },
  sheet: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    gap: Spacing.two,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  empty: { gap: Spacing.three, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  emptyText: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
  addButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  addText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
  },
  meta: { flex: 1, gap: 2 },
  bookTitle: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 21 },
  bookAuthor: { fontSize: 14, fontWeight: '500' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three, marginTop: Spacing.one },
  cancelLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
