import { router } from 'expo-router';

import { IsbnScanner } from '@/components/isbn-scanner';

/**
 * Full-screen barcode scanner route. Hosts the self-contained `IsbnScanner`
 * (camera permission, EAN-13/UPC-A → ISBN → Open Library lookup → add). Reached
 * from the Add sheet; closing returns to it. Scanned books land on Want to Read.
 */
export default function ScanScreen() {
  return <IsbnScanner onClose={() => router.back()} />;
}
