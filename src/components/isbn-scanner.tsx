/**
 * Self-contained ISBN barcode scanner (expo-camera).
 *
 * Functional building block for "add a book by scanning its barcode" — handles
 * camera permission, EAN-13/UPC-A scanning, ISBN validation, the Open Library
 * lookup, and adding to a shelf. Deliberately plain visually: it exposes
 * callbacks (`onAdded`, `onClose`) so the redesigned UI can host/style it in a
 * route or modal without changing any of this logic.
 *
 * Behaviour:
 *  - Ignores non-ISBN barcodes (validates the checksum before any network call).
 *  - De-dupes: each ISBN is processed once per mount, so holding the camera on a
 *    barcode won't add the same book repeatedly. A different book still scans.
 *  - Transient lookup errors are retryable (the code is released on error).
 */

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Book } from '@/db/books-repo';
import { useAppData } from '@/hooks/use-app-data';
import type { Shelf } from '@/lib/books';
import { isValidIsbn, normalizeIsbn } from '@/lib/isbn';

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
  | { kind: 'added'; title: string }
  | { kind: 'notFound'; isbn: string }
  | { kind: 'error'; message: string };

export function IsbnScanner({ onAdded, onClose, defaultShelf = 'want_to_read' }: Props) {
  const { addBookByIsbn } = useAppData();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<ScanStatus>({ kind: 'scanning' });
  const [addedCount, setAddedCount] = useState(0);

  // Guards against the continuous onBarcodeScanned firing: one in-flight lookup
  // at a time, and each ISBN handled once.
  const busyRef = useRef(false);
  const handledRef = useRef<Set<string>>(new Set());

  const handleScan = useCallback(
    async (result: BarcodeScanningResult) => {
      const isbn = normalizeIsbn(result.data);
      if (busyRef.current) return;
      if (!isValidIsbn(isbn)) return; // not a book barcode — keep scanning
      if (handledRef.current.has(isbn)) return; // already processed this one

      busyRef.current = true;
      handledRef.current.add(isbn);
      setStatus({ kind: 'looking', isbn });

      try {
        const book = await addBookByIsbn(isbn, defaultShelf);
        if (book) {
          setStatus({ kind: 'added', title: book.title });
          setAddedCount((c) => c + 1);
          onAdded?.(book);
          if (process.env.EXPO_OS === 'ios') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          setStatus({ kind: 'notFound', isbn });
          if (process.env.EXPO_OS === 'ios') {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
      } catch (err) {
        handledRef.current.delete(isbn); // let the user retry a transient failure
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Lookup failed',
        });
      } finally {
        busyRef.current = false;
      }
    },
    [addBookByIsbn, defaultShelf, onAdded]
  );

  // Permissions still resolving.
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  // Permission not granted yet.
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Camera access is needed to scan book barcodes.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </Pressable>
        {onClose ? (
          <Pressable style={styles.linkButton} onPress={onClose}>
            <Text style={styles.linkText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a'] }}
        onBarcodeScanned={handleScan}
      />

      {/* Aiming frame */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.frame} />
      </View>

      {/* Status + controls */}
      <View style={styles.hud}>
        <Text style={styles.hudText}>{statusLine(status)}</Text>
        {addedCount > 0 ? (
          <Text style={styles.hudSub}>
            {addedCount} book{addedCount === 1 ? '' : 's'} added
          </Text>
        ) : null}
      </View>

      {onClose ? (
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function statusLine(status: ScanStatus): string {
  switch (status.kind) {
    case 'scanning':
      return 'Point the camera at a book’s barcode';
    case 'looking':
      return `Looking up ${status.isbn}…`;
    case 'added':
      return `Added “${status.title}”`;
    case 'notFound':
      return `No match for ${status.isbn} — try searching by title`;
    case 'error':
      return status.message;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: { textAlign: 'center', fontSize: 16 },
  button: {
    backgroundColor: '#C8794A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  linkButton: { padding: 8 },
  linkText: { color: '#888' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '70%',
    height: 140,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  hudSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  closeText: { color: '#FFFFFF', fontWeight: '700' },
});
