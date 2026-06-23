import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCelebration } from '@/components/celebration/celebration-provider';
import { FontFamily, Spacing } from '@/constants/theme';
import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';

type Action = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  run: () => void | Promise<void>;
};

/**
 * Quick actions for a book without opening detail (long-press on a cover). A
 * cross-platform bottom sheet (RN Modal) so it works the same on Android and iOS.
 */
export function BookActionSheet({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const data = useAppData();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { celebrate } = useCelebration();

  const actions: Action[] = [];
  if (book) {
    actions.push({
      label: 'Open',
      icon: 'book-outline',
      run: () => router.push(`/book/${book.id}`),
    });
    if (book.shelf === 'want_to_read') {
      actions.push({
        label: 'Start reading',
        icon: 'play',
        run: () => data.moveBookToShelf(book.id, 'reading'),
      });
    }
    if (book.shelf === 'reading' && !data.activeSession) {
      actions.push({
        label: 'Start session',
        icon: 'timer-outline',
        run: async () => {
          await data.startSession(book.id);
          router.push('/session');
        },
      });
    }
    if (book.shelf === 'reading') {
      actions.push({
        label: 'Mark finished',
        icon: 'checkmark-circle',
        run: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await data.finishBook(book.id);
          // Defer until the sheet's slide-out finishes — two RN Modals presenting
          // at once can drop the second on Android.
          setTimeout(() => celebrate({ kind: 'book-finished', book }), 350);
        },
      });
    }
    if (book.shelf !== 'want_to_read') {
      actions.push({
        label: 'Move to Want to Read',
        icon: 'bookmark-outline',
        run: () => data.moveBookToShelf(book.id, 'want_to_read'),
      });
    }
    if (book.shelf === 'finished') {
      actions.push({
        label: 'Move to Reading',
        icon: 'book',
        run: () => data.moveBookToShelf(book.id, 'reading'),
      });
    }
    actions.push({
      label: 'Remove from library',
      icon: 'trash-outline',
      destructive: true,
      run: () => data.deleteBook(book.id),
    });
  }

  const handle = async (run: Action['run']) => {
    onClose();
    await run();
  };

  return (
    <Modal visible={!!book} transparent animationType="slide" onRequestClose={onClose}>
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
        {book ? (
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {book.title}
          </Text>
        ) : null}
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => handle(a.run)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={a.icon}
              size={20}
              color={a.destructive ? '#B4442E' : theme.accent}
            />
            <Text
              style={[styles.rowLabel, { color: a.destructive ? '#B4442E' : theme.text }]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
  },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: Spacing.three, marginTop: Spacing.one },
  cancelLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
