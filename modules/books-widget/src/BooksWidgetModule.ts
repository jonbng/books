import { requireOptionalNativeModule } from 'expo';

/**
 * The native bridge to the Android home-screen widget. Backed by Kotlin
 * (`BooksWidgetModule.kt`); present only on Android. `requireOptionalNativeModule`
 * returns `null` on iOS/web/Expo Go so callers can no-op without crashing.
 */
export interface BooksWidgetNativeModule {
  /** Persist the JSON widget snapshot the Glance widget renders from. */
  writeSnapshot(json: string): Promise<void>;
  /** Re-render all live widget instances from the current snapshot. */
  refreshWidget(): Promise<void>;
  /**
   * Return and clear the queue of "marked read from the widget" dates as a JSON
   * array string (e.g. `["2026-06-22"]`). Used to reconcile widget taps into the
   * database on app launch.
   */
  getPendingMarks(): Promise<string>;
}

export default requireOptionalNativeModule<BooksWidgetNativeModule>('BooksWidget');
